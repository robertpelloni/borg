package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/model"
	"github.com/aios/superai-cli/internal/provider"
)

type LLMClient struct {
	providers    map[string]provider.Provider
	router       *provider.Router
	selector     *model.Selector
	defaultModel string
	mu           sync.RWMutex

	onChunk    func(chunk provider.StreamChunk)
	onComplete func(resp *provider.CompletionResponse)
	onError    func(err error)
}

type LLMConfig struct {
	DefaultModel    string
	DefaultProvider string
	RoutingStrategy string
	MaxRetries      int
	Timeout         time.Duration
	Temperature     float64
	MaxTokens       int
	EnableStreaming bool
	EnableToolUse   bool
}

func DefaultLLMConfig() LLMConfig {
	return LLMConfig{
		DefaultModel:    "gpt-4o",
		DefaultProvider: "openai",
		RoutingStrategy: "priority",
		MaxRetries:      3,
		Timeout:         120 * time.Second,
		Temperature:     0.7,
		MaxTokens:       4096,
		EnableStreaming: true,
		EnableToolUse:   true,
	}
}

func NewLLMClient(router *provider.Router, selector *model.Selector) *LLMClient {
	return &LLMClient{
		providers: make(map[string]provider.Provider),
		router:    router,
		selector:  selector,
	}
}

func (c *LLMClient) AddProvider(name string, p provider.Provider) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.providers[name] = p
}

func (c *LLMClient) RemoveProvider(name string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.providers, name)
}

func (c *LLMClient) GetProvider(name string) (provider.Provider, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	p, ok := c.providers[name]
	return p, ok
}

func (c *LLMClient) ListProviders() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	names := make([]string, 0, len(c.providers))
	for name := range c.providers {
		names = append(names, name)
	}
	return names
}

func (c *LLMClient) SetDefaultModel(m string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.defaultModel = m
}

func (c *LLMClient) OnChunk(fn func(chunk provider.StreamChunk)) {
	c.onChunk = fn
}

func (c *LLMClient) OnComplete(fn func(resp *provider.CompletionResponse)) {
	c.onComplete = fn
}

func (c *LLMClient) OnError(fn func(err error)) {
	c.onError = fn
}

type ChatRequest struct {
	Messages    []provider.Message
	Model       string
	Provider    string
	Tools       []provider.ToolDefinition
	ToolChoice  interface{}
	MaxTokens   int
	Temperature float64
	TopP        float64
	Stop        []string
	Stream      bool
	Metadata    map[string]interface{}
}

type ChatResponse struct {
	Message      provider.Message
	ToolCalls    []provider.ToolCall
	FinishReason string
	Usage        provider.Usage
	Model        string
	Provider     string
	Latency      time.Duration
	Cached       bool
}

func (c *LLMClient) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	p, modelName, err := c.resolveProviderAndModel(req.Provider, req.Model)
	if err != nil {
		return nil, err
	}

	completionReq := provider.CompletionRequest{
		Model:       modelName,
		Messages:    req.Messages,
		Tools:       req.Tools,
		ToolChoice:  req.ToolChoice,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stop:        req.Stop,
		Stream:      false,
		Metadata:    req.Metadata,
	}

	resp, err := p.Complete(ctx, completionReq)
	if err != nil {
		if c.onError != nil {
			c.onError(err)
		}
		return nil, err
	}

	chatResp := &ChatResponse{
		Message:      resp.Message,
		ToolCalls:    resp.Message.ToolCalls,
		FinishReason: resp.FinishReason,
		Usage:        resp.Usage,
		Model:        resp.Model,
		Provider:     resp.Provider,
		Latency:      resp.Latency,
		Cached:       resp.Cached,
	}

	if c.onComplete != nil {
		c.onComplete(resp)
	}

	return chatResp, nil
}

func (c *LLMClient) ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamEvent, error) {
	p, modelName, err := c.resolveProviderAndModel(req.Provider, req.Model)
	if err != nil {
		return nil, err
	}

	completionReq := provider.CompletionRequest{
		Model:       modelName,
		Messages:    req.Messages,
		Tools:       req.Tools,
		ToolChoice:  req.ToolChoice,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stop:        req.Stop,
		Stream:      true,
		Metadata:    req.Metadata,
	}

	chunks, err := p.Stream(ctx, completionReq)
	if err != nil {
		if c.onError != nil {
			c.onError(err)
		}
		return nil, err
	}

	events := make(chan StreamEvent, 100)
	go c.processStream(ctx, chunks, events)

	return events, nil
}

type StreamEventType string

const (
	StreamEventContent  StreamEventType = "content"
	StreamEventToolCall StreamEventType = "tool_call"
	StreamEventUsage    StreamEventType = "usage"
	StreamEventDone     StreamEventType = "done"
	StreamEventError    StreamEventType = "error"
)

type StreamEvent struct {
	Type          StreamEventType
	Content       string
	ToolCall      *provider.ToolCall
	ToolCallDelta *ToolCallDelta
	Usage         *provider.Usage
	FinishReason  string
	Error         error
}

type ToolCallDelta struct {
	Index     int
	ID        string
	Name      string
	Arguments string
}

func (c *LLMClient) processStream(ctx context.Context, chunks <-chan provider.StreamChunk, events chan<- StreamEvent) {
	defer close(events)

	toolCalls := make(map[int]*provider.ToolCall)
	var totalUsage provider.Usage

	for {
		select {
		case <-ctx.Done():
			events <- StreamEvent{Type: StreamEventError, Error: ctx.Err()}
			return
		case chunk, ok := <-chunks:
			if !ok {
				events <- StreamEvent{Type: StreamEventDone, FinishReason: "stop", Usage: &totalUsage}
				return
			}

			if chunk.Error != nil {
				events <- StreamEvent{Type: StreamEventError, Error: chunk.Error}
				if c.onError != nil {
					c.onError(chunk.Error)
				}
				return
			}

			if c.onChunk != nil {
				c.onChunk(chunk)
			}

			if chunk.Delta.Content != "" {
				events <- StreamEvent{Type: StreamEventContent, Content: chunk.Delta.Content}
			}

			for i, tc := range chunk.Delta.ToolCalls {
				if _, exists := toolCalls[i]; !exists {
					toolCalls[i] = &provider.ToolCall{
						ID:   tc.ID,
						Type: tc.Type,
						Function: provider.FunctionCall{
							Name:      tc.Function.Name,
							Arguments: "",
						},
					}
				}

				if tc.Function.Arguments != "" {
					toolCalls[i].Function.Arguments += tc.Function.Arguments
				}

				events <- StreamEvent{
					Type: StreamEventToolCall,
					ToolCallDelta: &ToolCallDelta{
						Index:     i,
						ID:        tc.ID,
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				}
			}

			if chunk.Usage != nil {
				totalUsage = *chunk.Usage
			}

			if chunk.FinishReason != "" {
				events <- StreamEvent{
					Type:         StreamEventDone,
					FinishReason: chunk.FinishReason,
					Usage:        &totalUsage,
				}
				return
			}
		}
	}
}

func (c *LLMClient) resolveProviderAndModel(providerName, modelName string) (provider.Provider, string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if modelName == "" {
		modelName = c.defaultModel
		if modelName == "" {
			modelName = "gpt-4o"
		}
	}

	if providerName != "" {
		p, ok := c.providers[providerName]
		if !ok {
			return nil, "", fmt.Errorf("provider not found: %s", providerName)
		}
		return p, modelName, nil
	}

	if c.selector != nil {
		criteria := model.SelectionCriteria{
			Task: model.TaskGeneral,
		}
		selected := c.selector.Select(context.Background(), criteria)
		if selected != nil && selected.Model != nil {
			providerType := string(selected.Model.Provider)
			if p, ok := c.providers[providerType]; ok {
				return p, selected.Model.ID, nil
			}
		}
	}

	providerType := inferProviderFromModel(modelName)
	if p, ok := c.providers[providerType]; ok {
		return p, modelName, nil
	}

	for _, p := range c.providers {
		return p, modelName, nil
	}

	return nil, "", fmt.Errorf("no providers available")
}

func inferProviderFromModel(modelName string) string {
	switch {
	case startsWith(modelName, "gpt-") || startsWith(modelName, "o1") || startsWith(modelName, "o3"):
		return "openai"
	case startsWith(modelName, "claude-"):
		return "anthropic"
	case startsWith(modelName, "gemini-"):
		return "google"
	case startsWith(modelName, "llama") || startsWith(modelName, "mistral") || startsWith(modelName, "qwen"):
		return "ollama"
	default:
		return "openai"
	}
}

func startsWith(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func (c *LLMClient) SelectModel(ctx context.Context, task model.TaskType) (*model.Model, error) {
	if c.selector == nil {
		return nil, fmt.Errorf("model selector not configured")
	}
	result := c.selector.SelectForTask(ctx, task)
	if result == nil || result.Model == nil {
		return nil, fmt.Errorf("no model found for task: %s", task)
	}
	return result.Model, nil
}

func (c *LLMClient) SelectCheapest(ctx context.Context, caps []provider.Capability) (*model.Model, error) {
	if c.selector == nil {
		return nil, fmt.Errorf("model selector not configured")
	}
	result := c.selector.SelectCheapest(ctx, caps)
	if result == nil || result.Model == nil {
		return nil, fmt.Errorf("no cheap model found with required capabilities")
	}
	return result.Model, nil
}

func (c *LLMClient) SelectFastest(ctx context.Context, caps []provider.Capability) (*model.Model, error) {
	if c.selector == nil {
		return nil, fmt.Errorf("model selector not configured")
	}
	result := c.selector.SelectFastest(ctx, caps)
	if result == nil || result.Model == nil {
		return nil, fmt.Errorf("no fast model found with required capabilities")
	}
	return result.Model, nil
}

type ToolResult struct {
	ToolCallID string      `json:"tool_call_id"`
	Name       string      `json:"name"`
	Content    interface{} `json:"content"`
	Error      string      `json:"error,omitempty"`
}

func (c *LLMClient) FormatToolResult(result ToolResult) provider.Message {
	var content string
	if result.Error != "" {
		content = fmt.Sprintf("Error: %s", result.Error)
	} else {
		switch v := result.Content.(type) {
		case string:
			content = v
		default:
			b, _ := json.Marshal(v)
			content = string(b)
		}
	}

	return provider.Message{
		Role:       provider.RoleTool,
		Content:    content,
		Name:       result.Name,
		ToolCallID: result.ToolCallID,
	}
}

func (c *LLMClient) CreateAssistantMessage(content string, toolCalls []provider.ToolCall) provider.Message {
	return provider.Message{
		Role:      provider.RoleAssistant,
		Content:   content,
		ToolCalls: toolCalls,
	}
}

func (c *LLMClient) CreateUserMessage(content string) provider.Message {
	return provider.Message{
		Role:    provider.RoleUser,
		Content: content,
	}
}

func (c *LLMClient) CreateSystemMessage(content string) provider.Message {
	return provider.Message{
		Role:    provider.RoleSystem,
		Content: content,
	}
}

type MultiProviderRequest struct {
	ChatRequest
	Providers []string
	Strategy  MultiProviderStrategy
}

type MultiProviderStrategy string

const (
	StrategyParallel  MultiProviderStrategy = "parallel"
	StrategyFastest   MultiProviderStrategy = "fastest"
	StrategyConsensus MultiProviderStrategy = "consensus"
)

type MultiProviderResponse struct {
	Responses []*ChatResponse
	Fastest   *ChatResponse
	Consensus *ChatResponse
	Errors    []error
}

func (c *LLMClient) ChatMultiple(ctx context.Context, req MultiProviderRequest) (*MultiProviderResponse, error) {
	if len(req.Providers) == 0 {
		req.Providers = c.ListProviders()
	}

	if len(req.Providers) == 0 {
		return nil, fmt.Errorf("no providers available")
	}

	result := &MultiProviderResponse{
		Responses: make([]*ChatResponse, 0, len(req.Providers)),
		Errors:    make([]error, 0),
	}

	type providerResult struct {
		provider string
		response *ChatResponse
		err      error
		latency  time.Duration
	}

	results := make(chan providerResult, len(req.Providers))
	var wg sync.WaitGroup

	for _, provName := range req.Providers {
		wg.Add(1)
		go func(pn string) {
			defer wg.Done()
			start := time.Now()
			chatReq := req.ChatRequest
			chatReq.Provider = pn
			resp, err := c.Chat(ctx, chatReq)
			results <- providerResult{
				provider: pn,
				response: resp,
				err:      err,
				latency:  time.Since(start),
			}
		}(provName)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var fastestLatency time.Duration = -1
	for res := range results {
		if res.err != nil {
			result.Errors = append(result.Errors, fmt.Errorf("%s: %w", res.provider, res.err))
			continue
		}

		result.Responses = append(result.Responses, res.response)

		if fastestLatency < 0 || res.latency < fastestLatency {
			fastestLatency = res.latency
			result.Fastest = res.response
		}
	}

	if req.Strategy == StrategyConsensus && len(result.Responses) > 0 {
		result.Consensus = findConsensus(result.Responses)
	}

	return result, nil
}

func findConsensus(responses []*ChatResponse) *ChatResponse {
	if len(responses) == 0 {
		return nil
	}
	if len(responses) == 1 {
		return responses[0]
	}

	votes := make(map[string]int)
	contentMap := make(map[string]*ChatResponse)

	for _, r := range responses {
		content := r.Message.Content
		votes[content]++
		contentMap[content] = r
	}

	var maxVotes int
	var consensus *ChatResponse
	for content, count := range votes {
		if count > maxVotes {
			maxVotes = count
			consensus = contentMap[content]
		}
	}

	return consensus
}

func (c *LLMClient) CountTokens(messages []provider.Message) int {
	total := 0
	for _, m := range messages {
		total += len(m.Content) / 4
		for _, tc := range m.ToolCalls {
			total += len(tc.Function.Arguments) / 4
		}
	}
	return total
}

func (c *LLMClient) TruncateMessages(messages []provider.Message, maxTokens int) []provider.Message {
	if c.CountTokens(messages) <= maxTokens {
		return messages
	}

	if len(messages) == 0 {
		return messages
	}

	var systemMsg *provider.Message
	var otherMsgs []provider.Message

	for i, m := range messages {
		if m.Role == provider.RoleSystem {
			systemMsg = &messages[i]
		} else {
			otherMsgs = append(otherMsgs, m)
		}
	}

	result := make([]provider.Message, 0, len(messages))
	if systemMsg != nil {
		result = append(result, *systemMsg)
	}

	for i := len(otherMsgs) - 1; i >= 0; i-- {
		temp := append([]provider.Message{otherMsgs[i]}, result[len(result)-min(len(result), len(otherMsgs)-i):]...)
		if systemMsg != nil {
			temp = append([]provider.Message{*systemMsg}, temp...)
		}
		if c.CountTokens(temp) > maxTokens {
			break
		}
		result = append([]provider.Message{otherMsgs[i]}, result...)
	}

	return result
}

func (c *LLMClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var errs []error
	for name, p := range c.providers {
		if err := p.Close(); err != nil {
			errs = append(errs, fmt.Errorf("closing %s: %w", name, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors closing providers: %v", errs)
	}
	return nil
}
