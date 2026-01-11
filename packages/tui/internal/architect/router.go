package architect

import (
	"context"
	"fmt"
	"sync"
)

type Router struct {
	mu       sync.RWMutex
	configs  map[ModelRole]*ModelConfig
	backends map[string]Backend
}

type Backend interface {
	Complete(ctx context.Context, model string, messages []Message, opts *CompletionOptions) (*Response, error)
	Name() string
}

type CompletionOptions struct {
	MaxTokens     int
	Temperature   float64
	SystemPrompt  string
	StopSequences []string
}

func NewRouter() *Router {
	return &Router{
		configs:  make(map[ModelRole]*ModelConfig),
		backends: make(map[string]Backend),
	}
}

func (r *Router) RegisterBackend(name string, backend Backend) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.backends[name] = backend
}

func (r *Router) SetModel(role ModelRole, cfg *ModelConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.configs[role] = cfg
}

func (r *Router) Route(role ModelRole) *ModelConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.configs[role]
}

func (r *Router) Complete(ctx context.Context, cfg *ModelConfig, messages []Message) (*Response, error) {
	r.mu.RLock()
	backend, ok := r.backends[cfg.Provider]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("unknown provider: %s", cfg.Provider)
	}

	opts := &CompletionOptions{
		MaxTokens:    cfg.MaxTokens,
		Temperature:  cfg.Temperature,
		SystemPrompt: cfg.SystemPrompt,
	}

	return backend.Complete(ctx, cfg.Model, messages, opts)
}

func (r *Router) GetBackend(name string) (Backend, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	b, ok := r.backends[name]
	return b, ok
}

func (r *Router) ListBackends() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.backends))
	for name := range r.backends {
		names = append(names, name)
	}
	return names
}

type RolePreferences struct {
	Reasoning    string
	Editing      string
	Chat         string
	Autocomplete string
	Agent        string
}

func DefaultRolePreferences() *RolePreferences {
	return &RolePreferences{
		Reasoning:    "claude-sonnet-4-20250514",
		Editing:      "claude-sonnet-4-20250514",
		Chat:         "gpt-4o",
		Autocomplete: "codestral-latest",
		Agent:        "claude-sonnet-4-20250514",
	}
}

func (r *Router) ConfigureDefaults(prefs *RolePreferences) {
	if prefs == nil {
		prefs = DefaultRolePreferences()
	}

	r.SetModel(RoleReasoning, &ModelConfig{
		Provider:    "anthropic",
		Model:       prefs.Reasoning,
		Role:        RoleReasoning,
		MaxTokens:   8192,
		Temperature: 0.7,
	})

	r.SetModel(RoleEditing, &ModelConfig{
		Provider:    "anthropic",
		Model:       prefs.Editing,
		Role:        RoleEditing,
		MaxTokens:   4096,
		Temperature: 0.2,
	})

	r.SetModel(RoleChat, &ModelConfig{
		Provider:    "openai",
		Model:       prefs.Chat,
		Role:        RoleChat,
		MaxTokens:   4096,
		Temperature: 0.7,
	})

	r.SetModel(RoleAutocomplete, &ModelConfig{
		Provider:    "mistral",
		Model:       prefs.Autocomplete,
		Role:        RoleAutocomplete,
		MaxTokens:   256,
		Temperature: 0.0,
	})

	r.SetModel(RoleAgent, &ModelConfig{
		Provider:    "anthropic",
		Model:       prefs.Agent,
		Role:        RoleAgent,
		MaxTokens:   8192,
		Temperature: 0.5,
	})
}

type ModelCapabilities struct {
	SupportsVision     bool
	SupportsTools      bool
	SupportsStreaming  bool
	MaxContextWindow   int
	CostPerInputToken  float64
	CostPerOutputToken float64
}

var KnownModels = map[string]ModelCapabilities{
	"claude-sonnet-4-20250514": {
		SupportsVision:     true,
		SupportsTools:      true,
		SupportsStreaming:  true,
		MaxContextWindow:   200000,
		CostPerInputToken:  0.000003,
		CostPerOutputToken: 0.000015,
	},
	"claude-3-5-sonnet-20241022": {
		SupportsVision:     true,
		SupportsTools:      true,
		SupportsStreaming:  true,
		MaxContextWindow:   200000,
		CostPerInputToken:  0.000003,
		CostPerOutputToken: 0.000015,
	},
	"gpt-4o": {
		SupportsVision:     true,
		SupportsTools:      true,
		SupportsStreaming:  true,
		MaxContextWindow:   128000,
		CostPerInputToken:  0.000005,
		CostPerOutputToken: 0.000015,
	},
	"gpt-4o-mini": {
		SupportsVision:     true,
		SupportsTools:      true,
		SupportsStreaming:  true,
		MaxContextWindow:   128000,
		CostPerInputToken:  0.00000015,
		CostPerOutputToken: 0.0000006,
	},
	"codestral-latest": {
		SupportsVision:     false,
		SupportsTools:      false,
		SupportsStreaming:  true,
		MaxContextWindow:   32000,
		CostPerInputToken:  0.000001,
		CostPerOutputToken: 0.000003,
	},
	"deepseek-coder": {
		SupportsVision:     false,
		SupportsTools:      true,
		SupportsStreaming:  true,
		MaxContextWindow:   128000,
		CostPerInputToken:  0.00000014,
		CostPerOutputToken: 0.00000028,
	},
	"gemini-2.0-flash": {
		SupportsVision:     true,
		SupportsTools:      true,
		SupportsStreaming:  true,
		MaxContextWindow:   1000000,
		CostPerInputToken:  0.0000001,
		CostPerOutputToken: 0.0000004,
	},
}

func GetCapabilities(model string) (ModelCapabilities, bool) {
	caps, ok := KnownModels[model]
	return caps, ok
}

func (r *Router) SelectBestModel(role ModelRole, requirements ModelCapabilities) *ModelConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cfg := r.configs[role]
	if cfg == nil {
		return nil
	}

	caps, ok := KnownModels[cfg.Model]
	if !ok {
		return cfg
	}

	if requirements.SupportsVision && !caps.SupportsVision {
		for model, c := range KnownModels {
			if c.SupportsVision && c.MaxContextWindow >= requirements.MaxContextWindow {
				return &ModelConfig{
					Provider:    inferProvider(model),
					Model:       model,
					Role:        role,
					MaxTokens:   cfg.MaxTokens,
					Temperature: cfg.Temperature,
				}
			}
		}
	}

	return cfg
}

func inferProvider(model string) string {
	switch {
	case len(model) > 6 && model[:6] == "claude":
		return "anthropic"
	case len(model) > 3 && model[:3] == "gpt":
		return "openai"
	case len(model) > 6 && model[:6] == "gemini":
		return "google"
	case model == "codestral-latest":
		return "mistral"
	case model == "deepseek-coder":
		return "deepseek"
	default:
		return "openai"
	}
}
