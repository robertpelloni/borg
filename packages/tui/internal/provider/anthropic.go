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

type AnthropicProvider struct {
	config     ProviderConfig
	client     *http.Client
	mu         sync.RWMutex
	metrics    ProviderMetrics
	lastHealth HealthStatus
}

func NewAnthropicProvider(config ProviderConfig) (*AnthropicProvider, error) {
	p := &AnthropicProvider{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
	}
	return p, nil
}

func init() {
	RegisterProviderFactory(ProviderTypeAnthropic, func(config ProviderConfig) (Provider, error) {
		return NewAnthropicProvider(config)
	})
}

func (p *AnthropicProvider) Info() ProviderInfo {
	return ProviderInfo{
		Type:        ProviderTypeAnthropic,
		Name:        p.config.Name,
		DisplayName: "Anthropic",
		Description: "Anthropic Claude models including Claude 3.5 Sonnet, Claude 3 Opus",
		Website:     "https://anthropic.com",
		DocsURL:     "https://docs.anthropic.com",
		Status:      p.lastHealth.Status,
		Models: []string{
			"claude-sonnet-4-20250514",
			"claude-3-7-sonnet-20250219",
			"claude-3-5-sonnet-20241022",
			"claude-3-5-haiku-20241022",
			"claude-3-opus-20240229",
			"claude-3-sonnet-20240229",
			"claude-3-haiku-20240307",
		},
		Capabilities: []Capability{
			CapabilityChat, CapabilityToolUse, CapabilityVision,
			CapabilityStreaming, CapabilityJSON,
		},
		Pricing: &Pricing{
			InputPerMillion:  3.00,
			OutputPerMillion: 15.00,
			Currency:         "USD",
		},
	}
}

func (p *AnthropicProvider) Configure(config ProviderConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.config = config
	if config.Timeout > 0 {
		p.client.Timeout = config.Timeout
	}
	return nil
}

type anthropicRequest struct {
	Model       string             `json:"model"`
	Messages    []anthropicMessage `json:"messages"`
	System      string             `json:"system,omitempty"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature float64            `json:"temperature,omitempty"`
	TopP        float64            `json:"top_p,omitempty"`
	TopK        int                `json:"top_k,omitempty"`
	Stop        []string           `json:"stop_sequences,omitempty"`
	Stream      bool               `json:"stream,omitempty"`
	Tools       []anthropicTool    `json:"tools,omitempty"`
	ToolChoice  interface{}        `json:"tool_choice,omitempty"`
	Metadata    map[string]string  `json:"metadata,omitempty"`
}

type anthropicMessage struct {
	Role    string         `json:"role"`
	Content []contentBlock `json:"content"`
}

type contentBlock struct {
	Type      string       `json:"type"`
	Text      string       `json:"text,omitempty"`
	ID        string       `json:"id,omitempty"`
	Name      string       `json:"name,omitempty"`
	Input     interface{}  `json:"input,omitempty"`
	ToolUseID string       `json:"tool_use_id,omitempty"`
	Content   string       `json:"content,omitempty"`
	Source    *imageSource `json:"source,omitempty"`
}

type imageSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

type anthropicTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

type anthropicResponse struct {
	ID           string         `json:"id"`
	Type         string         `json:"type"`
	Role         string         `json:"role"`
	Content      []contentBlock `json:"content"`
	Model        string         `json:"model"`
	StopReason   string         `json:"stop_reason"`
	StopSequence string         `json:"stop_sequence,omitempty"`
	Usage        struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type anthropicStreamEvent struct {
	Type         string `json:"type"`
	Index        int    `json:"index,omitempty"`
	ContentBlock *struct {
		Type string `json:"type"`
		Text string `json:"text,omitempty"`
		ID   string `json:"id,omitempty"`
		Name string `json:"name,omitempty"`
	} `json:"content_block,omitempty"`
	Delta *struct {
		Type        string `json:"type"`
		Text        string `json:"text,omitempty"`
		PartialJSON string `json:"partial_json,omitempty"`
	} `json:"delta,omitempty"`
	Message *anthropicResponse `json:"message,omitempty"`
	Usage   *struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage,omitempty"`
}

func (p *AnthropicProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	start := time.Now()

	anthReq := p.convertRequest(req)
	anthReq.Stream = false

	body, err := json.Marshal(anthReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
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

	var anthResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthResp); err != nil {
		p.recordFailure()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	latency := time.Since(start)
	result := p.convertResponse(anthResp, latency)
	p.recordSuccess(result.Usage, latency)

	return result, nil
}

func (p *AnthropicProvider) Stream(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	anthReq := p.convertRequest(req)
	anthReq.Stream = true

	body, err := json.Marshal(anthReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
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
	go p.readStream(ctx, resp.Body, ch)

	return ch, nil
}

func (p *AnthropicProvider) readStream(ctx context.Context, body io.ReadCloser, ch chan<- StreamChunk) {
	defer close(ch)
	defer body.Close()

	buf := make([]byte, 4096)
	var partial string
	var currentToolID string
	var currentToolName string

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
			if line == "" || strings.HasPrefix(line, ":") {
				continue
			}
			if strings.HasPrefix(line, "event:") {
				continue
			}
			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")
			var event anthropicStreamEvent
			if err := json.Unmarshal([]byte(data), &event); err != nil {
				continue
			}

			switch event.Type {
			case "content_block_start":
				if event.ContentBlock != nil {
					if event.ContentBlock.Type == "tool_use" {
						currentToolID = event.ContentBlock.ID
						currentToolName = event.ContentBlock.Name
					}
				}
			case "content_block_delta":
				if event.Delta != nil {
					sc := StreamChunk{Model: p.config.Name}
					if event.Delta.Type == "text_delta" {
						sc.Delta = Message{
							Role:    RoleAssistant,
							Content: event.Delta.Text,
						}
					} else if event.Delta.Type == "input_json_delta" {
						sc.Delta = Message{
							Role: RoleAssistant,
							ToolCalls: []ToolCall{{
								ID:   currentToolID,
								Type: "function",
								Function: FunctionCall{
									Name:      currentToolName,
									Arguments: event.Delta.PartialJSON,
								},
							}},
						}
					}
					ch <- sc
				}
			case "message_delta":
				if event.Usage != nil {
					ch <- StreamChunk{
						FinishReason: "stop",
						Usage: &Usage{
							PromptTokens:     event.Usage.InputTokens,
							CompletionTokens: event.Usage.OutputTokens,
							TotalTokens:      event.Usage.InputTokens + event.Usage.OutputTokens,
						},
					}
				}
			case "message_stop":
				return
			}
		}
	}
}

func (p *AnthropicProvider) Embed(ctx context.Context, req EmbeddingRequest) (*EmbeddingResponse, error) {
	return nil, NewProviderError("anthropic", "unsupported", "Anthropic does not support embeddings", false)
}

func (p *AnthropicProvider) Health(ctx context.Context) HealthStatus {
	start := time.Now()

	testReq := anthropicRequest{
		Model:     "claude-3-haiku-20240307",
		MaxTokens: 1,
		Messages: []anthropicMessage{{
			Role:    "user",
			Content: []contentBlock{{Type: "text", Text: "hi"}},
		}},
	}
	body, _ := json.Marshal(testReq)

	req, _ := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.config.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

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

func (p *AnthropicProvider) Metrics() ProviderMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.metrics
}

func (p *AnthropicProvider) Close() error {
	return nil
}

func (p *AnthropicProvider) convertRequest(req CompletionRequest) anthropicRequest {
	var systemPrompt string
	var messages []anthropicMessage

	for _, m := range req.Messages {
		if m.Role == RoleSystem {
			systemPrompt = m.Content
			continue
		}

		var content []contentBlock
		if m.Content != "" {
			content = append(content, contentBlock{Type: "text", Text: m.Content})
		}
		for _, tc := range m.ToolCalls {
			var input interface{}
			json.Unmarshal([]byte(tc.Function.Arguments), &input)
			content = append(content, contentBlock{
				Type:  "tool_use",
				ID:    tc.ID,
				Name:  tc.Function.Name,
				Input: input,
			})
		}
		if m.ToolCallID != "" {
			content = append(content, contentBlock{
				Type:      "tool_result",
				ToolUseID: m.ToolCallID,
				Content:   m.Content,
			})
		}

		role := string(m.Role)
		if role == "tool" {
			role = "user"
		}

		messages = append(messages, anthropicMessage{
			Role:    role,
			Content: content,
		})
	}

	var tools []anthropicTool
	for _, t := range req.Tools {
		tools = append(tools, anthropicTool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.Parameters,
		})
	}

	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	return anthropicRequest{
		Model:       req.Model,
		Messages:    messages,
		System:      systemPrompt,
		MaxTokens:   maxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		TopK:        req.TopK,
		Stop:        req.Stop,
		Tools:       tools,
		ToolChoice:  req.ToolChoice,
	}
}

func (p *AnthropicProvider) convertResponse(resp anthropicResponse, latency time.Duration) *CompletionResponse {
	result := &CompletionResponse{
		ID:           resp.ID,
		Model:        resp.Model,
		Created:      time.Now(),
		Provider:     "anthropic",
		Latency:      latency,
		FinishReason: resp.StopReason,
		Usage: Usage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}

	var textContent strings.Builder
	var toolCalls []ToolCall

	for _, block := range resp.Content {
		switch block.Type {
		case "text":
			textContent.WriteString(block.Text)
		case "tool_use":
			args, _ := json.Marshal(block.Input)
			toolCalls = append(toolCalls, ToolCall{
				ID:   block.ID,
				Type: "function",
				Function: FunctionCall{
					Name:      block.Name,
					Arguments: string(args),
				},
			})
		}
	}

	result.Message = Message{
		Role:      RoleAssistant,
		Content:   textContent.String(),
		ToolCalls: toolCalls,
	}

	result.Usage.Cost = p.calculateCost(result.Usage, resp.Model)
	return result
}

func (p *AnthropicProvider) calculateCost(usage Usage, model string) float64 {
	pricing := map[string][2]float64{
		"claude-sonnet-4-20250514":   {3.00, 15.00},
		"claude-3-7-sonnet-20250219": {3.00, 15.00},
		"claude-3-5-sonnet-20241022": {3.00, 15.00},
		"claude-3-5-haiku-20241022":  {0.80, 4.00},
		"claude-3-opus-20240229":     {15.00, 75.00},
		"claude-3-sonnet-20240229":   {3.00, 15.00},
		"claude-3-haiku-20240307":    {0.25, 1.25},
	}

	if rates, ok := pricing[model]; ok {
		input := float64(usage.PromptTokens) / 1_000_000 * rates[0]
		output := float64(usage.CompletionTokens) / 1_000_000 * rates[1]
		return input + output
	}
	return 0
}

func (p *AnthropicProvider) handleError(status int, body []byte) error {
	var errResp struct {
		Error struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	json.Unmarshal(body, &errResp)

	msg := errResp.Error.Message
	if msg == "" {
		msg = string(body)
	}

	switch status {
	case http.StatusUnauthorized:
		return &ProviderError{Provider: "anthropic", Code: "invalid_api_key", Message: msg, Status: status, Retry: false}
	case http.StatusTooManyRequests:
		return &ProviderError{Provider: "anthropic", Code: "rate_limited", Message: msg, Status: status, Retry: true}
	case http.StatusBadRequest:
		return &ProviderError{Provider: "anthropic", Code: "invalid_request", Message: msg, Status: status, Retry: false}
	default:
		return &ProviderError{Provider: "anthropic", Code: "api_error", Message: msg, Status: status, Retry: status >= 500}
	}
}

func (p *AnthropicProvider) recordSuccess(usage Usage, latency time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.SuccessfulReqs++
	p.metrics.TotalTokens += int64(usage.TotalTokens)
	p.metrics.TotalCost += usage.Cost
	p.metrics.LastRequestTime = time.Now()
}

func (p *AnthropicProvider) recordFailure() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.FailedRequests++
	p.metrics.LastRequestTime = time.Now()
	if p.metrics.TotalRequests > 0 {
		p.metrics.ErrorRate = float64(p.metrics.FailedRequests) / float64(p.metrics.TotalRequests)
	}
}

var _ Provider = (*AnthropicProvider)(nil)
