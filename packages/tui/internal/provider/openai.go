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
	"sync/atomic"
	"time"
)

type OpenAIProvider struct {
	config     ProviderConfig
	client     *http.Client
	mu         sync.RWMutex
	metrics    ProviderMetrics
	lastHealth HealthStatus
}

func NewOpenAIProvider(config ProviderConfig) (*OpenAIProvider, error) {
	p := &OpenAIProvider{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
	}
	return p, nil
}

func init() {
	RegisterProviderFactory(ProviderTypeOpenAI, func(config ProviderConfig) (Provider, error) {
		return NewOpenAIProvider(config)
	})
}

func (p *OpenAIProvider) Info() ProviderInfo {
	return ProviderInfo{
		Type:        ProviderTypeOpenAI,
		Name:        p.config.Name,
		DisplayName: "OpenAI",
		Description: "OpenAI GPT models including GPT-4o, GPT-4, GPT-3.5",
		Website:     "https://openai.com",
		DocsURL:     "https://platform.openai.com/docs",
		Status:      p.lastHealth.Status,
		Models: []string{
			"gpt-4o", "gpt-4o-mini", "gpt-4o-2024-11-20",
			"gpt-4-turbo", "gpt-4-turbo-preview", "gpt-4",
			"gpt-3.5-turbo", "gpt-3.5-turbo-16k",
			"o1", "o1-mini", "o1-preview",
			"o3-mini",
		},
		Capabilities: []Capability{
			CapabilityChat, CapabilityCompletion, CapabilityEmbedding,
			CapabilityImage, CapabilityAudio, CapabilityToolUse,
			CapabilityVision, CapabilityStreaming, CapabilityJSON,
		},
		Pricing: &Pricing{
			InputPerMillion:  2.50,
			OutputPerMillion: 10.00,
			Currency:         "USD",
		},
	}
}

func (p *OpenAIProvider) Configure(config ProviderConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.config = config
	if config.Timeout > 0 {
		p.client.Timeout = config.Timeout
	}
	return nil
}

type openAIRequest struct {
	Model          string                `json:"model"`
	Messages       []openAIMessage       `json:"messages"`
	Tools          []openAITool          `json:"tools,omitempty"`
	ToolChoice     interface{}           `json:"tool_choice,omitempty"`
	MaxTokens      int                   `json:"max_tokens,omitempty"`
	Temperature    float64               `json:"temperature,omitempty"`
	TopP           float64               `json:"top_p,omitempty"`
	Stop           []string              `json:"stop,omitempty"`
	Stream         bool                  `json:"stream,omitempty"`
	User           string                `json:"user,omitempty"`
	Seed           *int                  `json:"seed,omitempty"`
	ResponseFormat *openAIResponseFormat `json:"response_format,omitempty"`
}

type openAIMessage struct {
	Role       string           `json:"role"`
	Content    interface{}      `json:"content"`
	Name       string           `json:"name,omitempty"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
}

type openAITool struct {
	Type     string         `json:"type"`
	Function openAIFunction `json:"function"`
}

type openAIFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
	Strict      bool                   `json:"strict,omitempty"`
}

type openAIToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type openAIResponseFormat struct {
	Type string `json:"type"`
}

type openAIResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index        int           `json:"index"`
		Message      openAIMessage `json:"message"`
		FinishReason string        `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type openAIStreamChunk struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index int `json:"index"`
		Delta struct {
			Role      string           `json:"role,omitempty"`
			Content   string           `json:"content,omitempty"`
			ToolCalls []openAIToolCall `json:"tool_calls,omitempty"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason,omitempty"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
}

func (p *OpenAIProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	start := time.Now()

	oaiReq := p.convertRequest(req)
	oaiReq.Stream = false

	body, err := json.Marshal(oaiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	if p.config.OrgID != "" {
		httpReq.Header.Set("OpenAI-Organization", p.config.OrgID)
	}
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

	var oaiResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&oaiResp); err != nil {
		p.recordFailure()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	latency := time.Since(start)
	result := p.convertResponse(oaiResp, latency)
	p.recordSuccess(result.Usage, latency)

	return result, nil
}

func (p *OpenAIProvider) Stream(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	oaiReq := p.convertRequest(req)
	oaiReq.Stream = true

	body, err := json.Marshal(oaiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")
	if p.config.OrgID != "" {
		httpReq.Header.Set("OpenAI-Organization", p.config.OrgID)
	}

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
	go p.readStream(ctx, resp.Body, ch)

	return ch, nil
}

func (p *OpenAIProvider) readStream(ctx context.Context, body io.ReadCloser, ch chan<- StreamChunk) {
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
			if line == "" || line == "data: [DONE]" {
				continue
			}
			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")
			var chunk openAIStreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue
			}

			if len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta
				sc := StreamChunk{
					ID:           chunk.ID,
					Model:        chunk.Model,
					FinishReason: chunk.Choices[0].FinishReason,
					Delta: Message{
						Role:    Role(delta.Role),
						Content: delta.Content,
					},
				}
				if len(delta.ToolCalls) > 0 {
					for _, tc := range delta.ToolCalls {
						sc.Delta.ToolCalls = append(sc.Delta.ToolCalls, ToolCall{
							ID:   tc.ID,
							Type: tc.Type,
							Function: FunctionCall{
								Name:      tc.Function.Name,
								Arguments: tc.Function.Arguments,
							},
						})
					}
				}
				if chunk.Usage != nil {
					sc.Usage = &Usage{
						PromptTokens:     chunk.Usage.PromptTokens,
						CompletionTokens: chunk.Usage.CompletionTokens,
						TotalTokens:      chunk.Usage.TotalTokens,
					}
				}
				ch <- sc
			}
		}
	}
}

func (p *OpenAIProvider) Embed(ctx context.Context, req EmbeddingRequest) (*EmbeddingResponse, error) {
	type embedRequest struct {
		Model string   `json:"model"`
		Input []string `json:"input"`
		User  string   `json:"user,omitempty"`
	}

	eReq := embedRequest{
		Model: req.Model,
		Input: req.Input,
		User:  req.User,
	}

	body, err := json.Marshal(eReq)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, p.handleError(resp.StatusCode, body)
	}

	var result struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
		Usage struct {
			PromptTokens int `json:"prompt_tokens"`
			TotalTokens  int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	embeddings := make([][]float64, len(result.Data))
	for i, d := range result.Data {
		embeddings[i] = d.Embedding
	}

	return &EmbeddingResponse{
		Model:      req.Model,
		Embeddings: embeddings,
		Usage: Usage{
			PromptTokens: result.Usage.PromptTokens,
			TotalTokens:  result.Usage.TotalTokens,
		},
	}, nil
}

func (p *OpenAIProvider) Health(ctx context.Context) HealthStatus {
	start := time.Now()

	req, _ := http.NewRequestWithContext(ctx, "GET", p.config.BaseURL+"/models", nil)
	req.Header.Set("Authorization", "Bearer "+p.config.APIKey)

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

func (p *OpenAIProvider) Metrics() ProviderMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.metrics
}

func (p *OpenAIProvider) Close() error {
	return nil
}

func (p *OpenAIProvider) convertRequest(req CompletionRequest) openAIRequest {
	messages := make([]openAIMessage, len(req.Messages))
	for i, m := range req.Messages {
		msg := openAIMessage{
			Role:       string(m.Role),
			Content:    m.Content,
			Name:       m.Name,
			ToolCallID: m.ToolCallID,
		}
		for _, tc := range m.ToolCalls {
			msg.ToolCalls = append(msg.ToolCalls, openAIToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				Function: struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				}{
					Name:      tc.Function.Name,
					Arguments: tc.Function.Arguments,
				},
			})
		}
		messages[i] = msg
	}

	var tools []openAITool
	for _, t := range req.Tools {
		tools = append(tools, openAITool{
			Type: "function",
			Function: openAIFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
				Strict:      t.Strict,
			},
		})
	}

	return openAIRequest{
		Model:       req.Model,
		Messages:    messages,
		Tools:       tools,
		ToolChoice:  req.ToolChoice,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stop:        req.Stop,
		Stream:      req.Stream,
		User:        req.User,
		Seed:        req.Seed,
	}
}

func (p *OpenAIProvider) convertResponse(resp openAIResponse, latency time.Duration) *CompletionResponse {
	result := &CompletionResponse{
		ID:       resp.ID,
		Model:    resp.Model,
		Created:  time.Unix(resp.Created, 0),
		Provider: "openai",
		Latency:  latency,
		Usage: Usage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}

	if len(resp.Choices) > 0 {
		choice := resp.Choices[0]
		result.FinishReason = choice.FinishReason
		result.Message = Message{
			Role:    Role(choice.Message.Role),
			Content: choice.Message.Content.(string),
		}
		for _, tc := range choice.Message.ToolCalls {
			result.Message.ToolCalls = append(result.Message.ToolCalls, ToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				Function: FunctionCall{
					Name:      tc.Function.Name,
					Arguments: tc.Function.Arguments,
				},
			})
		}
	}

	result.Usage.Cost = p.calculateCost(result.Usage)
	return result
}

func (p *OpenAIProvider) calculateCost(usage Usage) float64 {
	pricing := map[string][2]float64{
		"gpt-4o":        {2.50, 10.00},
		"gpt-4o-mini":   {0.15, 0.60},
		"gpt-4-turbo":   {10.00, 30.00},
		"gpt-4":         {30.00, 60.00},
		"gpt-3.5-turbo": {0.50, 1.50},
		"o1":            {15.00, 60.00},
		"o1-mini":       {3.00, 12.00},
		"o3-mini":       {1.10, 4.40},
	}

	if rates, ok := pricing["gpt-4o"]; ok {
		input := float64(usage.PromptTokens) / 1_000_000 * rates[0]
		output := float64(usage.CompletionTokens) / 1_000_000 * rates[1]
		return input + output
	}
	return 0
}

func (p *OpenAIProvider) handleError(status int, body []byte) error {
	var errResp struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	json.Unmarshal(body, &errResp)

	msg := errResp.Error.Message
	if msg == "" {
		msg = string(body)
	}

	switch status {
	case http.StatusUnauthorized:
		return &ProviderError{Provider: "openai", Code: "invalid_api_key", Message: msg, Status: status, Retry: false}
	case http.StatusTooManyRequests:
		return &ProviderError{Provider: "openai", Code: "rate_limited", Message: msg, Status: status, Retry: true}
	case http.StatusBadRequest:
		return &ProviderError{Provider: "openai", Code: "invalid_request", Message: msg, Status: status, Retry: false}
	default:
		return &ProviderError{Provider: "openai", Code: "api_error", Message: msg, Status: status, Retry: status >= 500}
	}
}

func (p *OpenAIProvider) recordSuccess(usage Usage, latency time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.SuccessfulReqs++
	p.metrics.TotalTokens += int64(usage.TotalTokens)
	p.metrics.TotalCost += usage.Cost
	p.metrics.LastRequestTime = time.Now()
	p.updateLatency(latency)
}

func (p *OpenAIProvider) recordFailure() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.FailedRequests++
	p.metrics.LastRequestTime = time.Now()
	if p.metrics.TotalRequests > 0 {
		p.metrics.ErrorRate = float64(p.metrics.FailedRequests) / float64(p.metrics.TotalRequests)
	}
}

func (p *OpenAIProvider) updateLatency(latency time.Duration) {
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

type OpenAICompatibleProvider struct {
	*OpenAIProvider
	providerType ProviderType
	displayName  string
	models       []string
}

func NewOpenAICompatibleProvider(config ProviderConfig, ptype ProviderType, displayName string, models []string) (*OpenAICompatibleProvider, error) {
	base, err := NewOpenAIProvider(config)
	if err != nil {
		return nil, err
	}
	return &OpenAICompatibleProvider{
		OpenAIProvider: base,
		providerType:   ptype,
		displayName:    displayName,
		models:         models,
	}, nil
}

func (p *OpenAICompatibleProvider) Info() ProviderInfo {
	info := p.OpenAIProvider.Info()
	info.Type = p.providerType
	info.DisplayName = p.displayName
	info.Models = p.models
	return info
}

var _ Provider = (*OpenAIProvider)(nil)
var _ Provider = (*OpenAICompatibleProvider)(nil)

type TokenCounter struct {
	counts sync.Map
}

func (tc *TokenCounter) Add(model string, tokens int64) {
	if val, ok := tc.counts.Load(model); ok {
		atomic.AddInt64(val.(*int64), tokens)
	} else {
		var n int64 = tokens
		tc.counts.Store(model, &n)
	}
}

func (tc *TokenCounter) Get(model string) int64 {
	if val, ok := tc.counts.Load(model); ok {
		return atomic.LoadInt64(val.(*int64))
	}
	return 0
}

func (tc *TokenCounter) Total() int64 {
	var total int64
	tc.counts.Range(func(key, value interface{}) bool {
		total += atomic.LoadInt64(value.(*int64))
		return true
	})
	return total
}
