package provider

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type Registry struct {
	mu        sync.RWMutex
	providers map[string]Provider
	configs   map[string]ProviderConfig
	order     []string
	listeners []RegistryListener
	metrics   *RegistryMetrics
}

type RegistryListener func(event RegistryEvent)

type RegistryEventType string

const (
	EventProviderAdded     RegistryEventType = "provider_added"
	EventProviderRemoved   RegistryEventType = "provider_removed"
	EventProviderUpdated   RegistryEventType = "provider_updated"
	EventProviderHealthy   RegistryEventType = "provider_healthy"
	EventProviderUnhealthy RegistryEventType = "provider_unhealthy"
)

type RegistryEvent struct {
	Type     RegistryEventType `json:"type"`
	Provider string            `json:"provider"`
	Time     time.Time         `json:"time"`
	Data     interface{}       `json:"data,omitempty"`
}

type RegistryMetrics struct {
	mu              sync.RWMutex
	TotalProviders  int                        `json:"total_providers"`
	ActiveProviders int                        `json:"active_providers"`
	ByType          map[ProviderType]int       `json:"by_type"`
	ByStatus        map[ProviderStatus]int     `json:"by_status"`
	ProviderMetrics map[string]ProviderMetrics `json:"provider_metrics"`
}

func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
		configs:   make(map[string]ProviderConfig),
		order:     make([]string, 0),
		listeners: make([]RegistryListener, 0),
		metrics: &RegistryMetrics{
			ByType:          make(map[ProviderType]int),
			ByStatus:        make(map[ProviderStatus]int),
			ProviderMetrics: make(map[string]ProviderMetrics),
		},
	}
}

func (r *Registry) Register(name string, config ProviderConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.providers[name]; exists {
		return fmt.Errorf("provider %s already registered", name)
	}

	resolvedConfig := r.resolveConfig(config)

	provider, err := CreateProvider(resolvedConfig)
	if err != nil {
		return fmt.Errorf("failed to create provider %s: %w", name, err)
	}

	if err := provider.Configure(resolvedConfig); err != nil {
		return fmt.Errorf("failed to configure provider %s: %w", name, err)
	}

	r.providers[name] = provider
	r.configs[name] = resolvedConfig
	r.order = append(r.order, name)
	r.sortProviders()
	r.updateMetrics()
	r.emit(RegistryEvent{
		Type:     EventProviderAdded,
		Provider: name,
		Time:     time.Now(),
	})

	return nil
}

func (r *Registry) resolveConfig(config ProviderConfig) ProviderConfig {
	resolved := config

	if resolved.APIKey == "" && resolved.APIKeyEnv != "" {
		resolved.APIKey = os.Getenv(resolved.APIKeyEnv)
	}

	if resolved.APIKey == "" {
		envVars := map[ProviderType][]string{
			ProviderTypeOpenAI:     {"OPENAI_API_KEY", "OPENAI_KEY"},
			ProviderTypeAnthropic:  {"ANTHROPIC_API_KEY", "CLAUDE_API_KEY"},
			ProviderTypeGoogle:     {"GOOGLE_API_KEY", "GEMINI_API_KEY"},
			ProviderTypeGroq:       {"GROQ_API_KEY"},
			ProviderTypeTogether:   {"TOGETHER_API_KEY"},
			ProviderTypeOpenRouter: {"OPENROUTER_API_KEY"},
			ProviderTypeAzure:      {"AZURE_OPENAI_API_KEY", "AZURE_API_KEY"},
		}
		if vars, ok := envVars[resolved.Type]; ok {
			for _, v := range vars {
				if key := os.Getenv(v); key != "" {
					resolved.APIKey = key
					break
				}
			}
		}
	}

	if resolved.BaseURL == "" {
		defaults := map[ProviderType]string{
			ProviderTypeOpenAI:     "https://api.openai.com/v1",
			ProviderTypeAnthropic:  "https://api.anthropic.com",
			ProviderTypeGoogle:     "https://generativelanguage.googleapis.com/v1beta",
			ProviderTypeOllama:     "http://localhost:11434",
			ProviderTypeGroq:       "https://api.groq.com/openai/v1",
			ProviderTypeTogether:   "https://api.together.xyz/v1",
			ProviderTypeOpenRouter: "https://openrouter.ai/api/v1",
		}
		if url, ok := defaults[resolved.Type]; ok {
			resolved.BaseURL = url
		}
	}

	if resolved.Timeout == 0 {
		resolved.Timeout = 120 * time.Second
	}
	if resolved.MaxRetries == 0 {
		resolved.MaxRetries = 3
	}
	if resolved.RetryDelay == 0 {
		resolved.RetryDelay = time.Second
	}

	return resolved
}

func (r *Registry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	provider, exists := r.providers[name]
	if !exists {
		return fmt.Errorf("provider %s not found", name)
	}

	if err := provider.Close(); err != nil {
		return fmt.Errorf("failed to close provider %s: %w", name, err)
	}

	delete(r.providers, name)
	delete(r.configs, name)

	for i, n := range r.order {
		if n == name {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}

	r.updateMetrics()
	r.emit(RegistryEvent{
		Type:     EventProviderRemoved,
		Provider: name,
		Time:     time.Now(),
	})

	return nil
}

func (r *Registry) Get(name string) (Provider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[name]
	return p, ok
}

func (r *Registry) GetConfig(name string) (ProviderConfig, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.configs[name]
	return c, ok
}

func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]string, len(r.order))
	copy(result, r.order)
	return result
}

func (r *Registry) ListByType(ptype ProviderType) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []string
	for _, name := range r.order {
		if cfg, ok := r.configs[name]; ok && cfg.Type == ptype {
			result = append(result, name)
		}
	}
	return result
}

func (r *Registry) ListEnabled() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []string
	for _, name := range r.order {
		if cfg, ok := r.configs[name]; ok && cfg.Enabled {
			result = append(result, name)
		}
	}
	return result
}

func (r *Registry) ListByCapability(cap Capability) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []string
	for _, name := range r.order {
		if p, ok := r.providers[name]; ok {
			info := p.Info()
			for _, c := range info.Capabilities {
				if c == cap {
					result = append(result, name)
					break
				}
			}
		}
	}
	return result
}

func (r *Registry) ListHealthy(ctx context.Context) []string {
	r.mu.RLock()
	providers := make(map[string]Provider)
	for k, v := range r.providers {
		providers[k] = v
	}
	r.mu.RUnlock()

	var result []string
	var mu sync.Mutex
	var wg sync.WaitGroup

	for name, p := range providers {
		wg.Add(1)
		go func(n string, prov Provider) {
			defer wg.Done()
			status := prov.Health(ctx)
			if status.Status == StatusAvailable {
				mu.Lock()
				result = append(result, n)
				mu.Unlock()
			}
		}(name, p)
	}

	wg.Wait()
	return result
}

func (r *Registry) sortProviders() {
	sort.Slice(r.order, func(i, j int) bool {
		ci := r.configs[r.order[i]]
		cj := r.configs[r.order[j]]
		if ci.Priority != cj.Priority {
			return ci.Priority > cj.Priority
		}
		return r.order[i] < r.order[j]
	})
}

func (r *Registry) updateMetrics() {
	r.metrics.mu.Lock()
	defer r.metrics.mu.Unlock()

	r.metrics.TotalProviders = len(r.providers)
	r.metrics.ByType = make(map[ProviderType]int)
	r.metrics.ByStatus = make(map[ProviderStatus]int)
	active := 0

	for name, cfg := range r.configs {
		r.metrics.ByType[cfg.Type]++
		if p, ok := r.providers[name]; ok {
			info := p.Info()
			r.metrics.ByStatus[info.Status]++
			if info.Status == StatusAvailable {
				active++
			}
			r.metrics.ProviderMetrics[name] = p.Metrics()
		}
	}

	r.metrics.ActiveProviders = active
}

func (r *Registry) Metrics() RegistryMetrics {
	r.metrics.mu.RLock()
	defer r.metrics.mu.RUnlock()
	return *r.metrics
}

func (r *Registry) Subscribe(listener RegistryListener) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.listeners = append(r.listeners, listener)
}

func (r *Registry) emit(event RegistryEvent) {
	for _, l := range r.listeners {
		go l(event)
	}
}

func (r *Registry) HealthCheck(ctx context.Context) map[string]HealthStatus {
	r.mu.RLock()
	providers := make(map[string]Provider)
	for k, v := range r.providers {
		providers[k] = v
	}
	r.mu.RUnlock()

	results := make(map[string]HealthStatus)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for name, p := range providers {
		wg.Add(1)
		go func(n string, prov Provider) {
			defer wg.Done()
			status := prov.Health(ctx)
			mu.Lock()
			results[n] = status
			mu.Unlock()

			if status.Status == StatusAvailable {
				r.emit(RegistryEvent{Type: EventProviderHealthy, Provider: n, Time: time.Now()})
			} else {
				r.emit(RegistryEvent{Type: EventProviderUnhealthy, Provider: n, Time: time.Now(), Data: status})
			}
		}(name, p)
	}

	wg.Wait()
	r.updateMetrics()
	return results
}

func (r *Registry) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var errs []string
	for name, p := range r.providers {
		if err := p.Close(); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", name, err))
		}
	}

	r.providers = make(map[string]Provider)
	r.configs = make(map[string]ProviderConfig)
	r.order = nil

	if len(errs) > 0 {
		return fmt.Errorf("errors closing providers: %s", strings.Join(errs, "; "))
	}
	return nil
}

type Discovery struct {
	registry *Registry
}

func NewDiscovery(registry *Registry) *Discovery {
	return &Discovery{registry: registry}
}

func (d *Discovery) AutoDiscover(ctx context.Context) ([]string, error) {
	var discovered []string

	checks := []struct {
		name    string
		ptype   ProviderType
		envVars []string
		local   bool
	}{
		{"openai", ProviderTypeOpenAI, []string{"OPENAI_API_KEY"}, false},
		{"anthropic", ProviderTypeAnthropic, []string{"ANTHROPIC_API_KEY", "CLAUDE_API_KEY"}, false},
		{"google", ProviderTypeGoogle, []string{"GOOGLE_API_KEY", "GEMINI_API_KEY"}, false},
		{"groq", ProviderTypeGroq, []string{"GROQ_API_KEY"}, false},
		{"together", ProviderTypeTogether, []string{"TOGETHER_API_KEY"}, false},
		{"openrouter", ProviderTypeOpenRouter, []string{"OPENROUTER_API_KEY"}, false},
		{"ollama", ProviderTypeOllama, nil, true},
	}

	for _, check := range checks {
		if _, exists := d.registry.Get(check.name); exists {
			continue
		}

		available := false
		if check.local {
			available = d.checkLocalProvider(ctx, check.ptype)
		} else {
			for _, env := range check.envVars {
				if os.Getenv(env) != "" {
					available = true
					break
				}
			}
		}

		if available {
			config := ProviderConfig{
				Type:    check.ptype,
				Name:    check.name,
				Enabled: true,
			}
			if err := d.registry.Register(check.name, config); err == nil {
				discovered = append(discovered, check.name)
			}
		}
	}

	return discovered, nil
}

func (d *Discovery) checkLocalProvider(ctx context.Context, ptype ProviderType) bool {
	switch ptype {
	case ProviderTypeOllama:
		return d.checkOllama(ctx)
	default:
		return false
	}
}

func (d *Discovery) checkOllama(ctx context.Context) bool {
	return false
}

var globalRegistry *Registry
var registryOnce sync.Once

func GlobalRegistry() *Registry {
	registryOnce.Do(func() {
		globalRegistry = NewRegistry()
	})
	return globalRegistry
}
