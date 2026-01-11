package provider

import (
	"context"
	"encoding/json"
	"io"
	"time"
)

type ProviderType string

const (
	ProviderTypeOpenAI     ProviderType = "openai"
	ProviderTypeAnthropic  ProviderType = "anthropic"
	ProviderTypeGoogle     ProviderType = "google"
	ProviderTypeOllama     ProviderType = "ollama"
	ProviderTypeAzure      ProviderType = "azure"
	ProviderTypeBedrock    ProviderType = "bedrock"
	ProviderTypeGroq       ProviderType = "groq"
	ProviderTypeTogether   ProviderType = "together"
	ProviderTypeOpenRouter ProviderType = "openrouter"
	ProviderTypeLocal      ProviderType = "local"
	ProviderTypeCustom     ProviderType = "custom"
)

type ProviderStatus string

const (
	StatusUnknown      ProviderStatus = "unknown"
	StatusAvailable    ProviderStatus = "available"
	StatusUnavailable  ProviderStatus = "unavailable"
	StatusRateLimited  ProviderStatus = "rate_limited"
	StatusError        ProviderStatus = "error"
	StatusInitializing ProviderStatus = "initializing"
)

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

type Message struct {
	Role       Role            `json:"role"`
	Content    string          `json:"content"`
	Name       string          `json:"name,omitempty"`
	ToolCalls  []ToolCall      `json:"tool_calls,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function FunctionCall `json:"function"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
	Strict      bool                   `json:"strict,omitempty"`
}

type CompletionRequest struct {
	Model       string                 `json:"model"`
	Messages    []Message              `json:"messages"`
	Tools       []ToolDefinition       `json:"tools,omitempty"`
	ToolChoice  interface{}            `json:"tool_choice,omitempty"`
	MaxTokens   int                    `json:"max_tokens,omitempty"`
	Temperature float64                `json:"temperature,omitempty"`
	TopP        float64                `json:"top_p,omitempty"`
	TopK        int                    `json:"top_k,omitempty"`
	Stop        []string               `json:"stop,omitempty"`
	Stream      bool                   `json:"stream,omitempty"`
	User        string                 `json:"user,omitempty"`
	Seed        *int                   `json:"seed,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type CompletionResponse struct {
	ID           string        `json:"id"`
	Model        string        `json:"model"`
	Message      Message       `json:"message"`
	FinishReason string        `json:"finish_reason"`
	Usage        Usage         `json:"usage"`
	Created      time.Time     `json:"created"`
	Provider     string        `json:"provider"`
	Latency      time.Duration `json:"latency"`
	Cached       bool          `json:"cached"`
}

type StreamChunk struct {
	ID           string  `json:"id"`
	Model        string  `json:"model"`
	Delta        Message `json:"delta"`
	FinishReason string  `json:"finish_reason,omitempty"`
	Usage        *Usage  `json:"usage,omitempty"`
	Error        error   `json:"-"`
}

type Usage struct {
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	TotalTokens      int     `json:"total_tokens"`
	CachedTokens     int     `json:"cached_tokens,omitempty"`
	Cost             float64 `json:"cost,omitempty"`
}

type EmbeddingRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
	User  string   `json:"user,omitempty"`
}

type EmbeddingResponse struct {
	Model      string      `json:"model"`
	Embeddings [][]float64 `json:"embeddings"`
	Usage      Usage       `json:"usage"`
}

type ProviderInfo struct {
	Type         ProviderType   `json:"type"`
	Name         string         `json:"name"`
	DisplayName  string         `json:"display_name"`
	Description  string         `json:"description"`
	Website      string         `json:"website"`
	DocsURL      string         `json:"docs_url"`
	Status       ProviderStatus `json:"status"`
	Models       []string       `json:"models"`
	Capabilities []Capability   `json:"capabilities"`
	RateLimit    *RateLimit     `json:"rate_limit,omitempty"`
	Pricing      *Pricing       `json:"pricing,omitempty"`
}

type Capability string

const (
	CapabilityChat       Capability = "chat"
	CapabilityCompletion Capability = "completion"
	CapabilityEmbedding  Capability = "embedding"
	CapabilityImage      Capability = "image"
	CapabilityAudio      Capability = "audio"
	CapabilityVideo      Capability = "video"
	CapabilityToolUse    Capability = "tool_use"
	CapabilityVision     Capability = "vision"
	CapabilityStreaming  Capability = "streaming"
	CapabilityJSON       Capability = "json_mode"
	CapabilityBatch      Capability = "batch"
)

type RateLimit struct {
	RequestsPerMinute int `json:"requests_per_minute"`
	TokensPerMinute   int `json:"tokens_per_minute"`
	RequestsPerDay    int `json:"requests_per_day"`
	TokensPerDay      int `json:"tokens_per_day"`
}

type Pricing struct {
	InputPerMillion  float64 `json:"input_per_million"`
	OutputPerMillion float64 `json:"output_per_million"`
	Currency         string  `json:"currency"`
}

type ProviderConfig struct {
	Type       ProviderType           `json:"type"`
	Name       string                 `json:"name"`
	APIKey     string                 `json:"api_key,omitempty"`
	APIKeyEnv  string                 `json:"api_key_env,omitempty"`
	BaseURL    string                 `json:"base_url,omitempty"`
	OrgID      string                 `json:"org_id,omitempty"`
	ProjectID  string                 `json:"project_id,omitempty"`
	Region     string                 `json:"region,omitempty"`
	Version    string                 `json:"version,omitempty"`
	Timeout    time.Duration          `json:"timeout,omitempty"`
	MaxRetries int                    `json:"max_retries,omitempty"`
	RetryDelay time.Duration          `json:"retry_delay,omitempty"`
	RateLimit  *RateLimitConfig       `json:"rate_limit,omitempty"`
	Headers    map[string]string      `json:"headers,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	Enabled    bool                   `json:"enabled"`
	Priority   int                    `json:"priority"`
	Weight     int                    `json:"weight"`
}

type RateLimitConfig struct {
	RequestsPerMinute int           `json:"requests_per_minute"`
	TokensPerMinute   int           `json:"tokens_per_minute"`
	BurstSize         int           `json:"burst_size"`
	WaitTimeout       time.Duration `json:"wait_timeout"`
}

type HealthStatus struct {
	Status    ProviderStatus `json:"status"`
	Latency   time.Duration  `json:"latency"`
	LastCheck time.Time      `json:"last_check"`
	Message   string         `json:"message,omitempty"`
	Error     string         `json:"error,omitempty"`
}

type ProviderMetrics struct {
	TotalRequests   int64         `json:"total_requests"`
	SuccessfulReqs  int64         `json:"successful_requests"`
	FailedRequests  int64         `json:"failed_requests"`
	TotalTokens     int64         `json:"total_tokens"`
	TotalCost       float64       `json:"total_cost"`
	AvgLatency      time.Duration `json:"avg_latency"`
	P50Latency      time.Duration `json:"p50_latency"`
	P95Latency      time.Duration `json:"p95_latency"`
	P99Latency      time.Duration `json:"p99_latency"`
	LastRequestTime time.Time     `json:"last_request_time"`
	ErrorRate       float64       `json:"error_rate"`
	RateLimitHits   int64         `json:"rate_limit_hits"`
}

type Provider interface {
	Info() ProviderInfo
	Configure(config ProviderConfig) error
	Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error)
	Stream(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error)
	Embed(ctx context.Context, req EmbeddingRequest) (*EmbeddingResponse, error)
	Health(ctx context.Context) HealthStatus
	Metrics() ProviderMetrics
	Close() error
}

type StreamingProvider interface {
	Provider
	StreamReader(ctx context.Context, req CompletionRequest) (io.ReadCloser, error)
}

type BatchProvider interface {
	Provider
	BatchComplete(ctx context.Context, reqs []CompletionRequest) ([]*CompletionResponse, error)
}

type CachingProvider interface {
	Provider
	CacheKey(req CompletionRequest) string
	GetCached(key string) (*CompletionResponse, bool)
	SetCached(key string, resp *CompletionResponse, ttl time.Duration)
	ClearCache()
}

type RetryableProvider interface {
	Provider
	ShouldRetry(err error) bool
	RetryDelay(attempt int) time.Duration
}

type ProviderError struct {
	Provider string                 `json:"provider"`
	Code     string                 `json:"code"`
	Message  string                 `json:"message"`
	Status   int                    `json:"status,omitempty"`
	Retry    bool                   `json:"retry"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

func (e *ProviderError) Error() string {
	return e.Message
}

func (e *ProviderError) IsRetryable() bool {
	return e.Retry
}

func NewProviderError(provider, code, message string, retry bool) *ProviderError {
	return &ProviderError{
		Provider: provider,
		Code:     code,
		Message:  message,
		Retry:    retry,
	}
}

var (
	ErrInvalidAPIKey  = NewProviderError("", "invalid_api_key", "Invalid or missing API key", false)
	ErrRateLimited    = NewProviderError("", "rate_limited", "Rate limit exceeded", true)
	ErrModelNotFound  = NewProviderError("", "model_not_found", "Model not found", false)
	ErrContextTooLong = NewProviderError("", "context_too_long", "Context length exceeded", false)
	ErrInvalidRequest = NewProviderError("", "invalid_request", "Invalid request", false)
	ErrProviderDown   = NewProviderError("", "provider_down", "Provider unavailable", true)
	ErrTimeout        = NewProviderError("", "timeout", "Request timeout", true)
	ErrUnsupported    = NewProviderError("", "unsupported", "Operation not supported", false)
)

type ProviderFactory func(config ProviderConfig) (Provider, error)

var providerFactories = make(map[ProviderType]ProviderFactory)

func RegisterProviderFactory(ptype ProviderType, factory ProviderFactory) {
	providerFactories[ptype] = factory
}

func GetProviderFactory(ptype ProviderType) (ProviderFactory, bool) {
	f, ok := providerFactories[ptype]
	return f, ok
}

func CreateProvider(config ProviderConfig) (Provider, error) {
	factory, ok := GetProviderFactory(config.Type)
	if !ok {
		return nil, NewProviderError(string(config.Type), "unknown_provider", "Unknown provider type", false)
	}
	return factory(config)
}

type ProviderHook func(ctx context.Context, req *CompletionRequest, resp *CompletionResponse, err error)

type HookedProvider struct {
	Provider
	BeforeRequest []func(ctx context.Context, req *CompletionRequest)
	AfterRequest  []ProviderHook
}

func (h *HookedProvider) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	for _, hook := range h.BeforeRequest {
		hook(ctx, &req)
	}

	resp, err := h.Provider.Complete(ctx, req)

	for _, hook := range h.AfterRequest {
		hook(ctx, &req, resp, err)
	}

	return resp, err
}

func WithLogging(p Provider, logger func(string, ...interface{})) Provider {
	return &HookedProvider{
		Provider: p,
		BeforeRequest: []func(ctx context.Context, req *CompletionRequest){
			func(ctx context.Context, req *CompletionRequest) {
				logger("request: model=%s messages=%d", req.Model, len(req.Messages))
			},
		},
		AfterRequest: []ProviderHook{
			func(ctx context.Context, req *CompletionRequest, resp *CompletionResponse, err error) {
				if err != nil {
					logger("error: %v", err)
				} else {
					logger("response: tokens=%d latency=%v", resp.Usage.TotalTokens, resp.Latency)
				}
			},
		},
	}
}

func WithMetrics(p Provider, collector func(ProviderMetrics)) Provider {
	return &HookedProvider{
		Provider: p,
		AfterRequest: []ProviderHook{
			func(ctx context.Context, req *CompletionRequest, resp *CompletionResponse, err error) {
				collector(p.Metrics())
			},
		},
	}
}
