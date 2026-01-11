package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type GoogleProvider struct {
	config     ProviderConfig
	client     *http.Client
	mu         sync.RWMutex
	metrics    ProviderMetrics
	lastHealth HealthStatus
}

func NewGoogleProvider(config ProviderConfig) (*GoogleProvider, error) {
	if config.BaseURL == "" {
		config.BaseURL = "https://generativelanguage.googleapis.com/v1beta"
	}
	if config.Timeout == 0 {
		config.Timeout = 120 * time.Second
	}
	p := &GoogleProvider{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
	}
	return p, nil
}

func init() {
	RegisterProviderFactory(ProviderTypeGoogle, func(config ProviderConfig) (Provider, error) {
		return NewGoogleProvider(config)
	})
}

func (p *GoogleProvider) Info() ProviderInfo {
	return ProviderInfo{
		Type:        ProviderTypeGoogle,
		Name:        p.config.Name,
		DisplayName: "Google AI",
		Description: "Google Gemini models including Gemini 2.0, 1.5 Pro, and Flash",
		Website:     "https://ai.google.dev",
		DocsURL:     "https://ai.google.dev/docs",
		Status:      p.lastHealth.Status,
		Models: []string{
			"gemini-2.0-flash-exp", "gemini-2.0-flash-thinking-exp",
			"gemini-1.5-pro", "gemini-1.5-pro-latest",
			"gemini-1.5-flash", "gemini-1.5-flash-latest",
			"gemini-1.5-flash-8b",
			"gemini-pro", "gemini-pro-vision",
		},
		Capabilities: []Capability{
			CapabilityChat, CapabilityCompletion, CapabilityEmbedding,
			CapabilityToolUse, CapabilityVision, CapabilityStreaming,
			CapabilityJSON, CapabilityAudio, CapabilityVideo,
		},
		Pricing: &Pricing{
			InputPerMillion:  0.075,
			OutputPerMillion: 0.30,
			Currency:         "USD",
		},
	}
}

func (p *GoogleProvider) Configure(config ProviderConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.config = config
	if config.BaseURL == "" {
		p.config.BaseURL = "https://generativelanguage.googleapis.com/v1beta"
	}
	if config.Timeout > 0 {
		p.client.Timeout = config.Timeout
	}
	return nil
}

type geminiRequest struct {
	Contents         []geminiContent         `json:"contents"`
	SystemInstruct   *geminiContent          `json:"systemInstruction,omitempty"`
	Tools            []geminiTool            `json:"tools,omitempty"`
	ToolConfig       *geminiToolConfig       `json:"toolConfig,omitempty"`
	SafetySettings   []geminiSafetySetting   `json:"safetySettings,omitempty"`
	GenerationConfig *geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text             string                `json:"text,omitempty"`
	InlineData       *geminiInlineData     `json:"inlineData,omitempty"`
	FunctionCall     *geminiFunctionCall   `json:"functionCall,omitempty"`
	FunctionResponse *geminiFunctionResult `json:"functionResponse,omitempty"`
}

type geminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

type geminiFunctionCall struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

type geminiFunctionResult struct {
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

type geminiTool struct {
	FunctionDeclarations []geminiFunctionDecl `json:"functionDeclarations,omitempty"`
}

type geminiFunctionDecl struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

type geminiToolConfig struct {
	FunctionCallingConfig *geminiFunctionCallingConfig `json:"functionCallingConfig,omitempty"`
}

type geminiFunctionCallingConfig struct {
	Mode string `json:"mode"`
}

type geminiSafetySetting struct {
	Category  string `json:"category"`
	Threshold string `json:"threshold"`
}

type geminiGenerationConfig struct {
	Temperature      float64  `json:"temperature,omitempty"`
	TopP             float64  `json:"topP,omitempty"`
	TopK             int      `json:"topK,omitempty"`
	MaxOutputTokens  int      `json:"maxOutputTokens,omitempty"`
	StopSequences    []string `json:"stopSequences,omitempty"`
	ResponseMimeType string   `json:"responseMimeType,omitempty"`
}

type geminiResponse struct {
	Candidates     []geminiCandidate     `json:"candidates"`
	UsageMetadata  *geminiUsage          `json:"usageMetadata,omitempty"`
	PromptFeedback *geminiPromptFeedback `json:"promptFeedback,omitempty"`
}

type geminiCandidate struct {
	Content       geminiContent `json:"content"`
	FinishReason  string        `json:"finishReason"`
	Index         int           `json:"index"`
	SafetyRatings []struct {
		Category    string `json:"category"`
		Probability string `json:"probability"`
	} `json:"safetyRatings,omitempty"`
}

type geminiUsage struct {
	PromptTokenCount     int `json:"promptTokenCount"`
	CandidatesTokenCount int `json:"candidatesTokenCount"`
	TotalTokenCount      int `json:"totalTokenCount"`
}

type geminiPromptFeedback struct {
	BlockReason   string `json:"blockReason,omitempty"`
	SafetyRatings []struct {
		Category    string `json:"category"`
		Probability string `json:"probability"`
	} `json:"safetyRatings,omitempty"`
}

type geminiStreamChunk struct {
	Candidates    []geminiCandidate `json:"candidates"`
	UsageMetadata *geminiUsage      `json:"usageMetadata,omitempty"`
}

func (p *GoogleProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	start := time.Now()

	model := req.Model
	if model == "" {
		model = "gemini-1.5-flash"
	}

	gemReq := p.convertRequest(req)
	body, err := json.Marshal(gemReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", p.config.BaseURL, model, p.config.APIKey)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	for k, v := range p.config.Headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := p.client.Do(httpReq)
	if err != nil {
		p.recordFailure()
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		p.recordFailure()
		return nil, p.handleError(resp.StatusCode, body)
	}

	var gemResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		p.recordFailure()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if gemResp.PromptFeedback != nil && gemResp.PromptFeedback.BlockReason != "" {
		p.recordFailure()
		return nil, &ProviderError{
			Provider: "google",
			Code:     "content_blocked",
			Message:  fmt.Sprintf("Content blocked: %s", gemResp.PromptFeedback.BlockReason),
			Retry:    false,
		}
	}

	latency := time.Since(start)
	result := p.convertResponse(gemResp, model, latency)
	p.recordSuccess(result.Usage, latency)

	return result, nil
}

func (p *GoogleProvider) Stream(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	model := req.Model
	if model == "" {
		model = "gemini-1.5-flash"
	}

	gemReq := p.convertRequest(req)
	body, err := json.Marshal(gemReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?key=%s&alt=sse", p.config.BaseURL, model, p.config.APIKey)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, p.handleError(resp.StatusCode, body)
	}

	ch := make(chan StreamChunk, 100)
	go p.readStream(ctx, resp.Body, model, ch)

	return ch, nil
}

func (p *GoogleProvider) readStream(ctx context.Context, body io.ReadCloser, model string, ch chan<- StreamChunk) {
	defer close(ch)
	defer body.Close()

	buf := make([]byte, 4096)
	var partial string

	for {
		select {
		case <-ctx.Done():
			ch <- StreamChunk{Error: ctx.Err()}
			return
		default:
		}

		n, err := body.Read(buf)
		if err != nil {
			if err != io.EOF {
				ch <- StreamChunk{Error: err}
			}
			return
		}

		partial += string(buf[:n])
		lines := strings.Split(partial, "\n")
		partial = lines[len(lines)-1]

		for _, line := range lines[:len(lines)-1] {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")
			if data == "" {
				continue
			}

			var chunk geminiStreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue
			}

			if len(chunk.Candidates) > 0 {
				candidate := chunk.Candidates[0]
				sc := StreamChunk{
					Model:        model,
					FinishReason: p.mapFinishReason(candidate.FinishReason),
				}

				if len(candidate.Content.Parts) > 0 {
					part := candidate.Content.Parts[0]
					if part.Text != "" {
						sc.Delta = Message{
							Role:    RoleAssistant,
							Content: part.Text,
						}
					}
					if part.FunctionCall != nil {
						argsJSON, _ := json.Marshal(part.FunctionCall.Args)
						sc.Delta.ToolCalls = append(sc.Delta.ToolCalls, ToolCall{
							ID:   fmt.Sprintf("call_%d", time.Now().UnixNano()),
							Type: "function",
							Function: FunctionCall{
								Name:      part.FunctionCall.Name,
								Arguments: string(argsJSON),
							},
						})
					}
				}

				if chunk.UsageMetadata != nil {
					sc.Usage = &Usage{
						PromptTokens:     chunk.UsageMetadata.PromptTokenCount,
						CompletionTokens: chunk.UsageMetadata.CandidatesTokenCount,
						TotalTokens:      chunk.UsageMetadata.TotalTokenCount,
					}
				}

				ch <- sc
			}
		}
	}
}

func (p *GoogleProvider) Embed(ctx context.Context, req EmbeddingRequest) (*EmbeddingResponse, error) {
	model := req.Model
	if model == "" {
		model = "text-embedding-004"
	}

	type embedRequest struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	}

	embeddings := make([][]float64, 0, len(req.Input))
	var totalTokens int

	for _, text := range req.Input {
		eReq := embedRequest{}
		eReq.Content.Parts = []struct {
			Text string `json:"text"`
		}{{Text: text}}

		body, err := json.Marshal(eReq)
		if err != nil {
			return nil, err
		}

		url := fmt.Sprintf("%s/models/%s:embedContent?key=%s", p.config.BaseURL, model, p.config.APIKey)
		httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}

		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := p.client.Do(httpReq)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, p.handleError(resp.StatusCode, respBody)
		}

		var result struct {
			Embedding struct {
				Values []float64 `json:"values"`
			} `json:"embedding"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		embeddings = append(embeddings, result.Embedding.Values)
		totalTokens += len(text) / 4
	}

	return &EmbeddingResponse{
		Model:      model,
		Embeddings: embeddings,
		Usage: Usage{
			PromptTokens: totalTokens,
			TotalTokens:  totalTokens,
		},
	}, nil
}

func (p *GoogleProvider) Health(ctx context.Context) HealthStatus {
	start := time.Now()

	url := fmt.Sprintf("%s/models?key=%s", p.config.BaseURL, p.config.APIKey)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

	resp, err := p.client.Do(req)
	latency := time.Since(start)

	status := HealthStatus{
		LastCheck: time.Now(),
		Latency:   latency,
	}

	if err != nil {
		status.Status = StatusUnavailable
		status.Error = err.Error()
	} else {
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			status.Status = StatusAvailable
		} else if resp.StatusCode == http.StatusTooManyRequests {
			status.Status = StatusRateLimited
		} else {
			status.Status = StatusError
			status.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
	}

	p.mu.Lock()
	p.lastHealth = status
	p.mu.Unlock()

	return status
}

func (p *GoogleProvider) Metrics() ProviderMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.metrics
}

func (p *GoogleProvider) Close() error {
	return nil
}

func (p *GoogleProvider) convertRequest(req CompletionRequest) geminiRequest {
	gemReq := geminiRequest{
		Contents: make([]geminiContent, 0),
	}

	for _, msg := range req.Messages {
		if msg.Role == RoleSystem {
			gemReq.SystemInstruct = &geminiContent{
				Parts: []geminiPart{{Text: msg.Content}},
			}
			continue
		}

		role := "user"
		if msg.Role == RoleAssistant {
			role = "model"
		}

		content := geminiContent{
			Role:  role,
			Parts: make([]geminiPart, 0),
		}

		if msg.Content != "" {
			content.Parts = append(content.Parts, geminiPart{Text: msg.Content})
		}

		if msg.Role == RoleTool && msg.ToolCallID != "" {
			var respData map[string]interface{}
			json.Unmarshal([]byte(msg.Content), &respData)
			if respData == nil {
				respData = map[string]interface{}{"result": msg.Content}
			}
			content.Parts = append(content.Parts, geminiPart{
				FunctionResponse: &geminiFunctionResult{
					Name:     msg.Name,
					Response: respData,
				},
			})
		}

		for _, tc := range msg.ToolCalls {
			var args map[string]interface{}
			json.Unmarshal([]byte(tc.Function.Arguments), &args)
			content.Parts = append(content.Parts, geminiPart{
				FunctionCall: &geminiFunctionCall{
					Name: tc.Function.Name,
					Args: args,
				},
			})
		}

		gemReq.Contents = append(gemReq.Contents, content)
	}

	if len(req.Tools) > 0 {
		tool := geminiTool{
			FunctionDeclarations: make([]geminiFunctionDecl, len(req.Tools)),
		}
		for i, t := range req.Tools {
			tool.FunctionDeclarations[i] = geminiFunctionDecl{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			}
		}
		gemReq.Tools = []geminiTool{tool}
	}

	genConfig := &geminiGenerationConfig{}
	hasConfig := false

	if req.Temperature > 0 {
		genConfig.Temperature = req.Temperature
		hasConfig = true
	}
	if req.TopP > 0 {
		genConfig.TopP = req.TopP
		hasConfig = true
	}
	if req.TopK > 0 {
		genConfig.TopK = req.TopK
		hasConfig = true
	}
	if req.MaxTokens > 0 {
		genConfig.MaxOutputTokens = req.MaxTokens
		hasConfig = true
	}
	if len(req.Stop) > 0 {
		genConfig.StopSequences = req.Stop
		hasConfig = true
	}

	if hasConfig {
		gemReq.GenerationConfig = genConfig
	}

	gemReq.SafetySettings = []geminiSafetySetting{
		{Category: "HARM_CATEGORY_HARASSMENT", Threshold: "BLOCK_NONE"},
		{Category: "HARM_CATEGORY_HATE_SPEECH", Threshold: "BLOCK_NONE"},
		{Category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", Threshold: "BLOCK_NONE"},
		{Category: "HARM_CATEGORY_DANGEROUS_CONTENT", Threshold: "BLOCK_NONE"},
	}

	return gemReq
}

func (p *GoogleProvider) convertResponse(resp geminiResponse, model string, latency time.Duration) *CompletionResponse {
	result := &CompletionResponse{
		ID:       fmt.Sprintf("gemini-%d", time.Now().UnixNano()),
		Model:    model,
		Created:  time.Now(),
		Provider: "google",
		Latency:  latency,
	}

	if resp.UsageMetadata != nil {
		result.Usage = Usage{
			PromptTokens:     resp.UsageMetadata.PromptTokenCount,
			CompletionTokens: resp.UsageMetadata.CandidatesTokenCount,
			TotalTokens:      resp.UsageMetadata.TotalTokenCount,
		}
	}

	if len(resp.Candidates) > 0 {
		candidate := resp.Candidates[0]
		result.FinishReason = p.mapFinishReason(candidate.FinishReason)

		result.Message = Message{
			Role: RoleAssistant,
		}

		for _, part := range candidate.Content.Parts {
			if part.Text != "" {
				result.Message.Content += part.Text
			}
			if part.FunctionCall != nil {
				argsJSON, _ := json.Marshal(part.FunctionCall.Args)
				result.Message.ToolCalls = append(result.Message.ToolCalls, ToolCall{
					ID:   fmt.Sprintf("call_%d", time.Now().UnixNano()),
					Type: "function",
					Function: FunctionCall{
						Name:      part.FunctionCall.Name,
						Arguments: string(argsJSON),
					},
				})
			}
		}
	}

	result.Usage.Cost = p.calculateCost(model, result.Usage)
	return result
}

func (p *GoogleProvider) mapFinishReason(reason string) string {
	switch reason {
	case "STOP":
		return "stop"
	case "MAX_TOKENS":
		return "length"
	case "SAFETY":
		return "content_filter"
	case "RECITATION":
		return "content_filter"
	case "OTHER":
		return "stop"
	default:
		return reason
	}
}

func (p *GoogleProvider) calculateCost(model string, usage Usage) float64 {
	pricing := map[string][2]float64{
		"gemini-2.0-flash-exp":          {0.0, 0.0},
		"gemini-2.0-flash-thinking-exp": {0.0, 0.0},
		"gemini-1.5-pro":                {1.25, 5.00},
		"gemini-1.5-pro-latest":         {1.25, 5.00},
		"gemini-1.5-flash":              {0.075, 0.30},
		"gemini-1.5-flash-latest":       {0.075, 0.30},
		"gemini-1.5-flash-8b":           {0.0375, 0.15},
		"gemini-pro":                    {0.50, 1.50},
	}

	if rates, ok := pricing[model]; ok {
		input := float64(usage.PromptTokens) / 1_000_000 * rates[0]
		output := float64(usage.CompletionTokens) / 1_000_000 * rates[1]
		return input + output
	}

	if rates, ok := pricing["gemini-1.5-flash"]; ok {
		input := float64(usage.PromptTokens) / 1_000_000 * rates[0]
		output := float64(usage.CompletionTokens) / 1_000_000 * rates[1]
		return input + output
	}

	return 0
}

func (p *GoogleProvider) handleError(status int, body []byte) error {
	var errResp struct {
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}
	json.Unmarshal(body, &errResp)

	msg := errResp.Error.Message
	if msg == "" {
		msg = string(body)
	}

	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return &ProviderError{Provider: "google", Code: "invalid_api_key", Message: msg, Status: status, Retry: false}
	case http.StatusTooManyRequests:
		return &ProviderError{Provider: "google", Code: "rate_limited", Message: msg, Status: status, Retry: true}
	case http.StatusBadRequest:
		return &ProviderError{Provider: "google", Code: "invalid_request", Message: msg, Status: status, Retry: false}
	case http.StatusNotFound:
		return &ProviderError{Provider: "google", Code: "model_not_found", Message: msg, Status: status, Retry: false}
	default:
		return &ProviderError{Provider: "google", Code: "api_error", Message: msg, Status: status, Retry: status >= 500}
	}
}

func (p *GoogleProvider) recordSuccess(usage Usage, latency time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.SuccessfulReqs++
	p.metrics.TotalTokens += int64(usage.TotalTokens)
	p.metrics.TotalCost += usage.Cost
	p.metrics.LastRequestTime = time.Now()
	p.updateLatency(latency)
}

func (p *GoogleProvider) recordFailure() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.FailedRequests++
	p.metrics.LastRequestTime = time.Now()
	if p.metrics.TotalRequests > 0 {
		p.metrics.ErrorRate = float64(p.metrics.FailedRequests) / float64(p.metrics.TotalRequests)
	}
}

func (p *GoogleProvider) updateLatency(latency time.Duration) {
	total := p.metrics.SuccessfulReqs
	if total == 1 {
		p.metrics.AvgLatency = latency
		p.metrics.P50Latency = latency
		p.metrics.P95Latency = latency
		p.metrics.P99Latency = latency
	} else {
		p.metrics.AvgLatency = time.Duration((int64(p.metrics.AvgLatency)*(total-1) + int64(latency)) / total)
	}
}

var _ Provider = (*GoogleProvider)(nil)
