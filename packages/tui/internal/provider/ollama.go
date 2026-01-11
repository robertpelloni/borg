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

type OllamaProvider struct {
	config     ProviderConfig
	client     *http.Client
	mu         sync.RWMutex
	metrics    ProviderMetrics
	lastHealth HealthStatus
	models     []string
}

func NewOllamaProvider(config ProviderConfig) (*OllamaProvider, error) {
	if config.BaseURL == "" {
		config.BaseURL = "http://localhost:11434"
	}
	if config.Timeout == 0 {
		config.Timeout = 300 * time.Second
	}
	p := &OllamaProvider{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
		models: []string{},
	}
	return p, nil
}

func init() {
	RegisterProviderFactory(ProviderTypeOllama, func(config ProviderConfig) (Provider, error) {
		return NewOllamaProvider(config)
	})
}

func (p *OllamaProvider) Info() ProviderInfo {
	models := p.models
	if len(models) == 0 {
		models = []string{
			"llama3.3", "llama3.2", "llama3.1",
			"qwen2.5", "qwen2.5-coder",
			"deepseek-r1", "deepseek-coder-v2",
			"codellama", "mistral", "mixtral",
			"phi3", "gemma2", "command-r",
		}
	}
	return ProviderInfo{
		Type:        ProviderTypeOllama,
		Name:        p.config.Name,
		DisplayName: "Ollama",
		Description: "Local LLM inference with Ollama - run models locally",
		Website:     "https://ollama.ai",
		DocsURL:     "https://github.com/ollama/ollama/blob/main/docs/api.md",
		Status:      p.lastHealth.Status,
		Models:      models,
		Capabilities: []Capability{
			CapabilityChat, CapabilityCompletion, CapabilityEmbedding,
			CapabilityStreaming, CapabilityToolUse,
		},
		Pricing: &Pricing{
			InputPerMillion:  0,
			OutputPerMillion: 0,
			Currency:         "USD",
		},
	}
}

func (p *OllamaProvider) Configure(config ProviderConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.config = config
	if config.BaseURL == "" {
		p.config.BaseURL = "http://localhost:11434"
	}
	if config.Timeout > 0 {
		p.client.Timeout = config.Timeout
	}
	return nil
}

type ollamaRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Tools    []ollamaTool    `json:"tools,omitempty"`
	Format   string          `json:"format,omitempty"`
	Options  *ollamaOptions  `json:"options,omitempty"`
	Stream   bool            `json:"stream"`
}

type ollamaMessage struct {
	Role      string           `json:"role"`
	Content   string           `json:"content"`
	Images    []string         `json:"images,omitempty"`
	ToolCalls []ollamaToolCall `json:"tool_calls,omitempty"`
}

type ollamaTool struct {
	Type     string         `json:"type"`
	Function ollamaFunction `json:"function"`
}

type ollamaFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type ollamaToolCall struct {
	Function struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	} `json:"function"`
}

type ollamaOptions struct {
	Temperature   float64  `json:"temperature,omitempty"`
	TopP          float64  `json:"top_p,omitempty"`
	TopK          int      `json:"top_k,omitempty"`
	NumPredict    int      `json:"num_predict,omitempty"`
	Stop          []string `json:"stop,omitempty"`
	Seed          *int     `json:"seed,omitempty"`
	NumCtx        int      `json:"num_ctx,omitempty"`
	NumGPU        int      `json:"num_gpu,omitempty"`
	RepeatPenalty float64  `json:"repeat_penalty,omitempty"`
}

type ollamaResponse struct {
	Model              string        `json:"model"`
	CreatedAt          string        `json:"created_at"`
	Message            ollamaMessage `json:"message"`
	Done               bool          `json:"done"`
	DoneReason         string        `json:"done_reason,omitempty"`
	TotalDuration      int64         `json:"total_duration,omitempty"`
	LoadDuration       int64         `json:"load_duration,omitempty"`
	PromptEvalCount    int           `json:"prompt_eval_count,omitempty"`
	PromptEvalDuration int64         `json:"prompt_eval_duration,omitempty"`
	EvalCount          int           `json:"eval_count,omitempty"`
	EvalDuration       int64         `json:"eval_duration,omitempty"`
}

type ollamaModelsResponse struct {
	Models []struct {
		Name       string `json:"name"`
		Model      string `json:"model"`
		ModifiedAt string `json:"modified_at"`
		Size       int64  `json:"size"`
		Digest     string `json:"digest"`
		Details    struct {
			ParentModel       string   `json:"parent_model"`
			Format            string   `json:"format"`
			Family            string   `json:"family"`
			Families          []string `json:"families"`
			ParameterSize     string   `json:"parameter_size"`
			QuantizationLevel string   `json:"quantization_level"`
		} `json:"details"`
	} `json:"models"`
}

func (p *OllamaProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	start := time.Now()

	model := req.Model
	if model == "" {
		model = "llama3.2"
	}

	ollamaReq := p.convertRequest(req)
	ollamaReq.Stream = false

	body, err := json.Marshal(ollamaReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/chat", p.config.BaseURL)
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

	var ollamaResp ollamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		p.recordFailure()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	latency := time.Since(start)
	result := p.convertResponse(ollamaResp, model, latency)
	p.recordSuccess(result.Usage, latency)

	return result, nil
}

func (p *OllamaProvider) Stream(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	model := req.Model
	if model == "" {
		model = "llama3.2"
	}

	ollamaReq := p.convertRequest(req)
	ollamaReq.Stream = true

	body, err := json.Marshal(ollamaReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/chat", p.config.BaseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

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

func (p *OllamaProvider) readStream(ctx context.Context, body io.ReadCloser, model string, ch chan<- StreamChunk) {
	defer close(ch)
	defer body.Close()

	decoder := json.NewDecoder(body)

	for {
		select {
		case <-ctx.Done():
			ch <- StreamChunk{Error: ctx.Err()}
			return
		default:
		}

		var chunk ollamaResponse
		if err := decoder.Decode(&chunk); err != nil {
			if err != io.EOF {
				ch <- StreamChunk{Error: err}
			}
			return
		}

		sc := StreamChunk{
			Model: model,
			Delta: Message{
				Role:    RoleAssistant,
				Content: chunk.Message.Content,
			},
		}

		if len(chunk.Message.ToolCalls) > 0 {
			for _, tc := range chunk.Message.ToolCalls {
				argsJSON, _ := json.Marshal(tc.Function.Arguments)
				sc.Delta.ToolCalls = append(sc.Delta.ToolCalls, ToolCall{
					ID:   fmt.Sprintf("call_%d", time.Now().UnixNano()),
					Type: "function",
					Function: FunctionCall{
						Name:      tc.Function.Name,
						Arguments: string(argsJSON),
					},
				})
			}
		}

		if chunk.Done {
			sc.FinishReason = p.mapFinishReason(chunk.DoneReason)
			if chunk.PromptEvalCount > 0 || chunk.EvalCount > 0 {
				sc.Usage = &Usage{
					PromptTokens:     chunk.PromptEvalCount,
					CompletionTokens: chunk.EvalCount,
					TotalTokens:      chunk.PromptEvalCount + chunk.EvalCount,
				}
			}
		}

		ch <- sc

		if chunk.Done {
			return
		}
	}
}

func (p *OllamaProvider) Embed(ctx context.Context, req EmbeddingRequest) (*EmbeddingResponse, error) {
	model := req.Model
	if model == "" {
		model = "nomic-embed-text"
	}

	embeddings := make([][]float64, 0, len(req.Input))
	var totalTokens int

	for _, text := range req.Input {
		eReq := struct {
			Model  string `json:"model"`
			Prompt string `json:"prompt"`
		}{
			Model:  model,
			Prompt: text,
		}

		body, err := json.Marshal(eReq)
		if err != nil {
			return nil, err
		}

		url := fmt.Sprintf("%s/api/embeddings", p.config.BaseURL)
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
			Embedding []float64 `json:"embedding"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		embeddings = append(embeddings, result.Embedding)
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

func (p *OllamaProvider) Health(ctx context.Context) HealthStatus {
	start := time.Now()

	url := fmt.Sprintf("%s/api/tags", p.config.BaseURL)
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
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			status.Status = StatusAvailable

			var modelsResp ollamaModelsResponse
			if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err == nil {
				p.mu.Lock()
				p.models = make([]string, len(modelsResp.Models))
				for i, m := range modelsResp.Models {
					p.models[i] = m.Name
				}
				p.mu.Unlock()
				status.Message = fmt.Sprintf("%d models available", len(modelsResp.Models))
			}
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

func (p *OllamaProvider) Metrics() ProviderMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.metrics
}

func (p *OllamaProvider) Close() error {
	return nil
}

func (p *OllamaProvider) ListModels(ctx context.Context) ([]string, error) {
	url := fmt.Sprintf("%s/api/tags", p.config.BaseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, p.handleError(resp.StatusCode, body)
	}

	var modelsResp ollamaModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err != nil {
		return nil, err
	}

	models := make([]string, len(modelsResp.Models))
	for i, m := range modelsResp.Models {
		models[i] = m.Name
	}

	p.mu.Lock()
	p.models = models
	p.mu.Unlock()

	return models, nil
}

func (p *OllamaProvider) PullModel(ctx context.Context, model string) (<-chan PullProgress, error) {
	pullReq := struct {
		Name   string `json:"name"`
		Stream bool   `json:"stream"`
	}{
		Name:   model,
		Stream: true,
	}

	body, err := json.Marshal(pullReq)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/api/pull", p.config.BaseURL)
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

	ch := make(chan PullProgress, 100)
	go p.readPullProgress(ctx, resp.Body, ch)

	return ch, nil
}

type PullProgress struct {
	Status    string `json:"status"`
	Digest    string `json:"digest,omitempty"`
	Total     int64  `json:"total,omitempty"`
	Completed int64  `json:"completed,omitempty"`
	Error     error  `json:"-"`
	Done      bool   `json:"-"`
}

func (p *OllamaProvider) readPullProgress(ctx context.Context, body io.ReadCloser, ch chan<- PullProgress) {
	defer close(ch)
	defer body.Close()

	decoder := json.NewDecoder(body)

	for {
		select {
		case <-ctx.Done():
			ch <- PullProgress{Error: ctx.Err()}
			return
		default:
		}

		var progress PullProgress
		if err := decoder.Decode(&progress); err != nil {
			if err != io.EOF {
				ch <- PullProgress{Error: err}
			}
			return
		}

		if strings.Contains(progress.Status, "success") {
			progress.Done = true
		}

		ch <- progress

		if progress.Done {
			return
		}
	}
}

func (p *OllamaProvider) DeleteModel(ctx context.Context, model string) error {
	deleteReq := struct {
		Name string `json:"name"`
	}{
		Name: model,
	}

	body, err := json.Marshal(deleteReq)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/delete", p.config.BaseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "DELETE", url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return p.handleError(resp.StatusCode, respBody)
	}

	return nil
}

func (p *OllamaProvider) convertRequest(req CompletionRequest) ollamaRequest {
	messages := make([]ollamaMessage, 0, len(req.Messages))

	for _, msg := range req.Messages {
		ollamaMsg := ollamaMessage{
			Role:    string(msg.Role),
			Content: msg.Content,
		}

		for _, tc := range msg.ToolCalls {
			var args map[string]interface{}
			json.Unmarshal([]byte(tc.Function.Arguments), &args)
			ollamaMsg.ToolCalls = append(ollamaMsg.ToolCalls, ollamaToolCall{
				Function: struct {
					Name      string                 `json:"name"`
					Arguments map[string]interface{} `json:"arguments"`
				}{
					Name:      tc.Function.Name,
					Arguments: args,
				},
			})
		}

		messages = append(messages, ollamaMsg)
	}

	ollamaReq := ollamaRequest{
		Model:    req.Model,
		Messages: messages,
	}

	if len(req.Tools) > 0 {
		tools := make([]ollamaTool, len(req.Tools))
		for i, t := range req.Tools {
			tools[i] = ollamaTool{
				Type: "function",
				Function: ollamaFunction{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.Parameters,
				},
			}
		}
		ollamaReq.Tools = tools
	}

	opts := &ollamaOptions{}
	hasOpts := false

	if req.Temperature > 0 {
		opts.Temperature = req.Temperature
		hasOpts = true
	}
	if req.TopP > 0 {
		opts.TopP = req.TopP
		hasOpts = true
	}
	if req.TopK > 0 {
		opts.TopK = req.TopK
		hasOpts = true
	}
	if req.MaxTokens > 0 {
		opts.NumPredict = req.MaxTokens
		hasOpts = true
	}
	if len(req.Stop) > 0 {
		opts.Stop = req.Stop
		hasOpts = true
	}
	if req.Seed != nil {
		opts.Seed = req.Seed
		hasOpts = true
	}

	if hasOpts {
		ollamaReq.Options = opts
	}

	return ollamaReq
}

func (p *OllamaProvider) convertResponse(resp ollamaResponse, model string, latency time.Duration) *CompletionResponse {
	result := &CompletionResponse{
		ID:           fmt.Sprintf("ollama-%d", time.Now().UnixNano()),
		Model:        model,
		Created:      time.Now(),
		Provider:     "ollama",
		Latency:      latency,
		FinishReason: p.mapFinishReason(resp.DoneReason),
		Message: Message{
			Role:    RoleAssistant,
			Content: resp.Message.Content,
		},
		Usage: Usage{
			PromptTokens:     resp.PromptEvalCount,
			CompletionTokens: resp.EvalCount,
			TotalTokens:      resp.PromptEvalCount + resp.EvalCount,
			Cost:             0,
		},
	}

	for _, tc := range resp.Message.ToolCalls {
		argsJSON, _ := json.Marshal(tc.Function.Arguments)
		result.Message.ToolCalls = append(result.Message.ToolCalls, ToolCall{
			ID:   fmt.Sprintf("call_%d", time.Now().UnixNano()),
			Type: "function",
			Function: FunctionCall{
				Name:      tc.Function.Name,
				Arguments: string(argsJSON),
			},
		})
	}

	return result
}

func (p *OllamaProvider) mapFinishReason(reason string) string {
	switch reason {
	case "stop":
		return "stop"
	case "length":
		return "length"
	case "load":
		return "stop"
	default:
		if reason == "" {
			return "stop"
		}
		return reason
	}
}

func (p *OllamaProvider) handleError(status int, body []byte) error {
	var errResp struct {
		Error string `json:"error"`
	}
	json.Unmarshal(body, &errResp)

	msg := errResp.Error
	if msg == "" {
		msg = string(body)
	}

	switch status {
	case http.StatusNotFound:
		return &ProviderError{Provider: "ollama", Code: "model_not_found", Message: msg, Status: status, Retry: false}
	case http.StatusBadRequest:
		return &ProviderError{Provider: "ollama", Code: "invalid_request", Message: msg, Status: status, Retry: false}
	default:
		return &ProviderError{Provider: "ollama", Code: "api_error", Message: msg, Status: status, Retry: status >= 500}
	}
}

func (p *OllamaProvider) recordSuccess(usage Usage, latency time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.SuccessfulReqs++
	p.metrics.TotalTokens += int64(usage.TotalTokens)
	p.metrics.LastRequestTime = time.Now()
	p.updateLatency(latency)
}

func (p *OllamaProvider) recordFailure() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.metrics.TotalRequests++
	p.metrics.FailedRequests++
	p.metrics.LastRequestTime = time.Now()
	if p.metrics.TotalRequests > 0 {
		p.metrics.ErrorRate = float64(p.metrics.FailedRequests) / float64(p.metrics.TotalRequests)
	}
}

func (p *OllamaProvider) updateLatency(latency time.Duration) {
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

var _ Provider = (*OllamaProvider)(nil)
