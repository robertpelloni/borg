package context

import (
	"context"
	"fmt"
	"sync"
)

type ProviderType string

const (
	ProviderFile     ProviderType = "file"
	ProviderCode     ProviderType = "code"
	ProviderDiff     ProviderType = "diff"
	ProviderTerminal ProviderType = "terminal"
	ProviderHTTP     ProviderType = "http"
	ProviderFolder   ProviderType = "folder"
	ProviderSearch   ProviderType = "search"
	ProviderDebugger ProviderType = "debugger"
	ProviderTree     ProviderType = "tree"
	ProviderCustom   ProviderType = "custom"
)

type ContextItem struct {
	ID          string            `json:"id"`
	Type        ProviderType      `json:"type"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Content     string            `json:"content"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	TokenCount  int               `json:"token_count"`
	Priority    int               `json:"priority"`
}

type ProviderConfig struct {
	Type    ProviderType      `yaml:"type"`
	Name    string            `yaml:"name"`
	Enabled bool              `yaml:"enabled"`
	Options map[string]string `yaml:"options,omitempty"`
}

type Provider interface {
	Type() ProviderType
	Name() string
	Description() string
	Fetch(ctx context.Context, args map[string]interface{}) (*ContextItem, error)
	Validate(args map[string]interface{}) error
}

type ProviderFactory func(config ProviderConfig) (Provider, error)

type Registry struct {
	providers map[ProviderType]Provider
	factories map[ProviderType]ProviderFactory
	mu        sync.RWMutex
}

func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[ProviderType]Provider),
		factories: make(map[ProviderType]ProviderFactory),
	}
}

func (r *Registry) RegisterFactory(providerType ProviderType, factory ProviderFactory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[providerType] = factory
}

func (r *Registry) Register(provider Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[provider.Type()] = provider
}

func (r *Registry) Get(providerType ProviderType) (Provider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[providerType]
	return p, ok
}

func (r *Registry) Create(config ProviderConfig) (Provider, error) {
	r.mu.RLock()
	factory, ok := r.factories[config.Type]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("no factory registered for provider type: %s", config.Type)
	}

	provider, err := factory(config)
	if err != nil {
		return nil, err
	}

	r.Register(provider)
	return provider, nil
}

func (r *Registry) List() []Provider {
	r.mu.RLock()
	defer r.mu.RUnlock()

	providers := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		providers = append(providers, p)
	}
	return providers
}

type ContextBuilder struct {
	items      []*ContextItem
	tokenLimit int
	tokenCount int
	mu         sync.Mutex
}

func NewContextBuilder(tokenLimit int) *ContextBuilder {
	return &ContextBuilder{
		items:      make([]*ContextItem, 0),
		tokenLimit: tokenLimit,
	}
}

func (cb *ContextBuilder) Add(item *ContextItem) bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.tokenLimit > 0 && cb.tokenCount+item.TokenCount > cb.tokenLimit {
		return false
	}

	cb.items = append(cb.items, item)
	cb.tokenCount += item.TokenCount
	return true
}

func (cb *ContextBuilder) AddWithPriority(item *ContextItem) bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.tokenLimit > 0 && cb.tokenCount+item.TokenCount > cb.tokenLimit {
		evicted := cb.evictLowerPriority(item.Priority, item.TokenCount)
		if !evicted {
			return false
		}
	}

	cb.items = append(cb.items, item)
	cb.tokenCount += item.TokenCount
	return true
}

func (cb *ContextBuilder) evictLowerPriority(priority, needed int) bool {
	var candidates []*ContextItem
	var candidateTokens int

	for _, item := range cb.items {
		if item.Priority < priority {
			candidates = append(candidates, item)
			candidateTokens += item.TokenCount
		}
	}

	if candidateTokens < needed {
		return false
	}

	evictedTokens := 0
	for _, c := range candidates {
		if evictedTokens >= needed {
			break
		}
		cb.remove(c.ID)
		evictedTokens += c.TokenCount
	}

	return true
}

func (cb *ContextBuilder) remove(id string) {
	for i, item := range cb.items {
		if item.ID == id {
			cb.tokenCount -= item.TokenCount
			cb.items = append(cb.items[:i], cb.items[i+1:]...)
			return
		}
	}
}

func (cb *ContextBuilder) Build() string {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	var result string
	for _, item := range cb.items {
		if item.Name != "" {
			result += fmt.Sprintf("=== %s (%s) ===\n", item.Name, item.Type)
		}
		result += item.Content + "\n\n"
	}
	return result
}

func (cb *ContextBuilder) Items() []*ContextItem {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	items := make([]*ContextItem, len(cb.items))
	copy(items, cb.items)
	return items
}

func (cb *ContextBuilder) TokenCount() int {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.tokenCount
}

func (cb *ContextBuilder) Clear() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.items = make([]*ContextItem, 0)
	cb.tokenCount = 0
}

func EstimateTokens(text string) int {
	return len(text) / 4
}
