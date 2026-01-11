package provider

import (
	"context"
	"errors"
	"math/rand"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type Router struct {
	registry     *Registry
	strategy     RoutingStrategy
	mu           sync.RWMutex
	metrics      RouterMetrics
	circuitState map[string]*CircuitBreaker
	loadBalancer *LoadBalancer
	retryPolicy  *RetryPolicy
}

type RoutingStrategy string

const (
	StrategyPriority    RoutingStrategy = "priority"
	StrategyRoundRobin  RoutingStrategy = "round_robin"
	StrategyWeighted    RoutingStrategy = "weighted"
	StrategyLeastLoad   RoutingStrategy = "least_load"
	StrategyLatency     RoutingStrategy = "latency"
	StrategyFailover    RoutingStrategy = "failover"
	StrategyCostOptimal RoutingStrategy = "cost_optimal"
)

type RouterConfig struct {
	Strategy       RoutingStrategy   `json:"strategy"`
	RetryPolicy    *RetryPolicy      `json:"retry_policy,omitempty"`
	CircuitBreaker *CircuitConfig    `json:"circuit_breaker,omitempty"`
	Timeout        time.Duration     `json:"timeout,omitempty"`
	Preferences    RoutingPreference `json:"preferences,omitempty"`
}

type RoutingPreference struct {
	PreferLocal      bool         `json:"prefer_local"`
	PreferredModels  []string     `json:"preferred_models,omitempty"`
	ExcludeProviders []string     `json:"exclude_providers,omitempty"`
	MaxCostPerToken  float64      `json:"max_cost_per_token,omitempty"`
	MinCapabilities  []Capability `json:"min_capabilities,omitempty"`
}

type RetryPolicy struct {
	MaxRetries     int           `json:"max_retries"`
	InitialDelay   time.Duration `json:"initial_delay"`
	MaxDelay       time.Duration `json:"max_delay"`
	BackoffFactor  float64       `json:"backoff_factor"`
	RetryableError func(error) bool
}

type CircuitConfig struct {
	Enabled          bool          `json:"enabled"`
	FailureThreshold int           `json:"failure_threshold"`
	SuccessThreshold int           `json:"success_threshold"`
	Timeout          time.Duration `json:"timeout"`
	HalfOpenRequests int           `json:"half_open_requests"`
}

type CircuitBreaker struct {
	state            CircuitState
	failures         int64
	successes        int64
	lastFailure      time.Time
	lastStateChange  time.Time
	halfOpenRequests int64
	config           *CircuitConfig
	mu               sync.RWMutex
}

type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

type LoadBalancer struct {
	mu            sync.Mutex
	roundRobinIdx int
	weights       map[string]int
	activeConns   map[string]*int64
}

type RouterMetrics struct {
	TotalRequests    int64            `json:"total_requests"`
	SuccessfulRoutes int64            `json:"successful_routes"`
	FailedRoutes     int64            `json:"failed_routes"`
	Retries          int64            `json:"retries"`
	Failovers        int64            `json:"failovers"`
	CircuitBreaks    int64            `json:"circuit_breaks"`
	ProviderUsage    map[string]int64 `json:"provider_usage"`
	AvgLatency       time.Duration    `json:"avg_latency"`
}

func NewRouter(registry *Registry, config RouterConfig) *Router {
	if config.Strategy == "" {
		config.Strategy = StrategyPriority
	}
	if config.RetryPolicy == nil {
		config.RetryPolicy = &RetryPolicy{
			MaxRetries:    3,
			InitialDelay:  100 * time.Millisecond,
			MaxDelay:      5 * time.Second,
			BackoffFactor: 2.0,
		}
	}
	if config.CircuitBreaker == nil {
		config.CircuitBreaker = &CircuitConfig{
			Enabled:          true,
			FailureThreshold: 5,
			SuccessThreshold: 2,
			Timeout:          30 * time.Second,
			HalfOpenRequests: 1,
		}
	}

	r := &Router{
		registry:     registry,
		strategy:     config.Strategy,
		circuitState: make(map[string]*CircuitBreaker),
		loadBalancer: &LoadBalancer{
			weights:     make(map[string]int),
			activeConns: make(map[string]*int64),
		},
		retryPolicy: config.RetryPolicy,
		metrics: RouterMetrics{
			ProviderUsage: make(map[string]int64),
		},
	}

	for _, name := range registry.List() {
		r.circuitState[name] = &CircuitBreaker{
			state:  CircuitClosed,
			config: config.CircuitBreaker,
		}
		var zero int64
		r.loadBalancer.activeConns[name] = &zero
		if cfg, ok := registry.GetConfig(name); ok {
			r.loadBalancer.weights[name] = cfg.Weight
			if r.loadBalancer.weights[name] == 0 {
				r.loadBalancer.weights[name] = 1
			}
		}
	}

	return r
}

func (r *Router) Route(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	atomic.AddInt64(&r.metrics.TotalRequests, 1)
	start := time.Now()

	providers, err := r.selectProviders(req)
	if err != nil {
		atomic.AddInt64(&r.metrics.FailedRoutes, 1)
		return nil, err
	}

	var lastErr error
	for attempt := 0; attempt <= r.retryPolicy.MaxRetries; attempt++ {
		for _, providerName := range providers {
			if !r.checkCircuit(providerName) {
				continue
			}

			provider, ok := r.registry.Get(providerName)
			if !ok {
				continue
			}

			r.incrementActiveConns(providerName)
			resp, err := provider.Complete(ctx, req)
			r.decrementActiveConns(providerName)

			if err == nil {
				r.recordSuccess(providerName, time.Since(start))
				atomic.AddInt64(&r.metrics.SuccessfulRoutes, 1)
				return resp, nil
			}

			lastErr = err
			r.recordFailure(providerName, err)

			if !r.shouldRetry(err) {
				break
			}

			if attempt < r.retryPolicy.MaxRetries {
				atomic.AddInt64(&r.metrics.Retries, 1)
				delay := r.calculateBackoff(attempt)
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(delay):
				}
			}
		}

		if attempt < r.retryPolicy.MaxRetries {
			atomic.AddInt64(&r.metrics.Failovers, 1)
		}
	}

	atomic.AddInt64(&r.metrics.FailedRoutes, 1)
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("no available providers")
}

func (r *Router) Stream(ctx context.Context, req CompletionRequest) (<-chan StreamChunk, error) {
	atomic.AddInt64(&r.metrics.TotalRequests, 1)

	providers, err := r.selectProviders(req)
	if err != nil {
		atomic.AddInt64(&r.metrics.FailedRoutes, 1)
		return nil, err
	}

	var lastErr error
	for _, providerName := range providers {
		if !r.checkCircuit(providerName) {
			continue
		}

		provider, ok := r.registry.Get(providerName)
		if !ok {
			continue
		}

		r.incrementActiveConns(providerName)
		ch, err := provider.Stream(ctx, req)
		if err == nil {
			r.recordSuccess(providerName, 0)
			atomic.AddInt64(&r.metrics.SuccessfulRoutes, 1)

			wrappedCh := make(chan StreamChunk, 100)
			go func() {
				defer r.decrementActiveConns(providerName)
				defer close(wrappedCh)
				for chunk := range ch {
					wrappedCh <- chunk
				}
			}()
			return wrappedCh, nil
		}

		r.decrementActiveConns(providerName)
		lastErr = err
		r.recordFailure(providerName, err)
	}

	atomic.AddInt64(&r.metrics.FailedRoutes, 1)
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("no available providers")
}

func (r *Router) selectProviders(req CompletionRequest) ([]string, error) {
	allProviders := r.registry.ListEnabled()
	if len(allProviders) == 0 {
		return nil, errors.New("no enabled providers")
	}

	candidates := r.filterByCapability(allProviders, req)
	if len(candidates) == 0 {
		return nil, errors.New("no providers support required capabilities")
	}

	candidates = r.filterByModel(candidates, req.Model)

	switch r.strategy {
	case StrategyPriority:
		return r.sortByPriority(candidates), nil
	case StrategyRoundRobin:
		return r.roundRobin(candidates), nil
	case StrategyWeighted:
		return r.weightedSelection(candidates), nil
	case StrategyLeastLoad:
		return r.sortByLoad(candidates), nil
	case StrategyLatency:
		return r.sortByLatency(candidates), nil
	case StrategyCostOptimal:
		return r.sortByCost(candidates), nil
	case StrategyFailover:
		return r.sortByHealth(candidates), nil
	default:
		return r.sortByPriority(candidates), nil
	}
}

func (r *Router) filterByCapability(providers []string, req CompletionRequest) []string {
	result := make([]string, 0, len(providers))
	for _, name := range providers {
		provider, ok := r.registry.Get(name)
		if !ok {
			continue
		}
		info := provider.Info()

		needsTools := len(req.Tools) > 0
		if needsTools && !hasCapability(info.Capabilities, CapabilityToolUse) {
			continue
		}

		needsStreaming := req.Stream
		if needsStreaming && !hasCapability(info.Capabilities, CapabilityStreaming) {
			continue
		}

		result = append(result, name)
	}
	return result
}

func (r *Router) filterByModel(providers []string, model string) []string {
	if model == "" {
		return providers
	}

	result := make([]string, 0)
	for _, name := range providers {
		provider, ok := r.registry.Get(name)
		if !ok {
			continue
		}
		info := provider.Info()
		for _, m := range info.Models {
			if m == model {
				result = append(result, name)
				break
			}
		}
	}

	if len(result) == 0 {
		return providers
	}
	return result
}

func (r *Router) sortByPriority(providers []string) []string {
	type providerPriority struct {
		name     string
		priority int
	}
	pp := make([]providerPriority, 0, len(providers))
	for _, name := range providers {
		if cfg, ok := r.registry.GetConfig(name); ok {
			pp = append(pp, providerPriority{name: name, priority: cfg.Priority})
		} else {
			pp = append(pp, providerPriority{name: name, priority: 0})
		}
	}
	sort.Slice(pp, func(i, j int) bool {
		return pp[i].priority > pp[j].priority
	})
	result := make([]string, len(pp))
	for i, p := range pp {
		result[i] = p.name
	}
	return result
}

func (r *Router) roundRobin(providers []string) []string {
	r.loadBalancer.mu.Lock()
	defer r.loadBalancer.mu.Unlock()

	n := len(providers)
	if n == 0 {
		return providers
	}

	r.loadBalancer.roundRobinIdx = (r.loadBalancer.roundRobinIdx + 1) % n
	result := make([]string, n)
	for i := 0; i < n; i++ {
		result[i] = providers[(r.loadBalancer.roundRobinIdx+i)%n]
	}
	return result
}

func (r *Router) weightedSelection(providers []string) []string {
	type providerWeight struct {
		name   string
		weight int
	}
	pw := make([]providerWeight, 0, len(providers))
	totalWeight := 0
	for _, name := range providers {
		w := r.loadBalancer.weights[name]
		if w <= 0 {
			w = 1
		}
		pw = append(pw, providerWeight{name: name, weight: w})
		totalWeight += w
	}

	if totalWeight == 0 {
		return providers
	}

	result := make([]string, 0, len(providers))
	remaining := make([]providerWeight, len(pw))
	copy(remaining, pw)

	for len(remaining) > 0 {
		totalWeight = 0
		for _, p := range remaining {
			totalWeight += p.weight
		}

		randVal := rand.Intn(totalWeight)
		cumulative := 0
		selectedIdx := 0
		for i, p := range remaining {
			cumulative += p.weight
			if randVal < cumulative {
				selectedIdx = i
				break
			}
		}
		result = append(result, remaining[selectedIdx].name)
		remaining = append(remaining[:selectedIdx], remaining[selectedIdx+1:]...)
	}

	return result
}

func (r *Router) sortByLoad(providers []string) []string {
	type providerLoad struct {
		name string
		load int64
	}
	pl := make([]providerLoad, 0, len(providers))
	r.loadBalancer.mu.Lock()
	for _, name := range providers {
		var load int64
		if ptr, ok := r.loadBalancer.activeConns[name]; ok && ptr != nil {
			load = atomic.LoadInt64(ptr)
		}
		pl = append(pl, providerLoad{name: name, load: load})
	}
	r.loadBalancer.mu.Unlock()

	sort.Slice(pl, func(i, j int) bool {
		return pl[i].load < pl[j].load
	})
	result := make([]string, len(pl))
	for i, p := range pl {
		result[i] = p.name
	}
	return result
}

func (r *Router) sortByLatency(providers []string) []string {
	type providerLatency struct {
		name    string
		latency time.Duration
	}
	pl := make([]providerLatency, 0, len(providers))
	for _, name := range providers {
		provider, ok := r.registry.Get(name)
		if !ok {
			continue
		}
		metrics := provider.Metrics()
		pl = append(pl, providerLatency{name: name, latency: metrics.AvgLatency})
	}
	sort.Slice(pl, func(i, j int) bool {
		return pl[i].latency < pl[j].latency
	})
	result := make([]string, len(pl))
	for i, p := range pl {
		result[i] = p.name
	}
	return result
}

func (r *Router) sortByCost(providers []string) []string {
	type providerCost struct {
		name string
		cost float64
	}
	pc := make([]providerCost, 0, len(providers))
	for _, name := range providers {
		provider, ok := r.registry.Get(name)
		if !ok {
			continue
		}
		info := provider.Info()
		cost := float64(0)
		if info.Pricing != nil {
			cost = (info.Pricing.InputPerMillion + info.Pricing.OutputPerMillion) / 2
		}
		pc = append(pc, providerCost{name: name, cost: cost})
	}
	sort.Slice(pc, func(i, j int) bool {
		return pc[i].cost < pc[j].cost
	})
	result := make([]string, len(pc))
	for i, p := range pc {
		result[i] = p.name
	}
	return result
}

func (r *Router) sortByHealth(providers []string) []string {
	type providerHealth struct {
		name    string
		healthy bool
		latency time.Duration
	}
	ph := make([]providerHealth, 0, len(providers))
	for _, name := range providers {
		provider, ok := r.registry.Get(name)
		if !ok {
			continue
		}
		info := provider.Info()
		healthy := info.Status == StatusAvailable
		metrics := provider.Metrics()
		ph = append(ph, providerHealth{name: name, healthy: healthy, latency: metrics.AvgLatency})
	}
	sort.Slice(ph, func(i, j int) bool {
		if ph[i].healthy != ph[j].healthy {
			return ph[i].healthy
		}
		return ph[i].latency < ph[j].latency
	})
	result := make([]string, len(ph))
	for i, p := range ph {
		result[i] = p.name
	}
	return result
}

func (r *Router) checkCircuit(providerName string) bool {
	r.mu.RLock()
	cb, ok := r.circuitState[providerName]
	r.mu.RUnlock()

	if !ok || cb.config == nil || !cb.config.Enabled {
		return true
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Since(cb.lastStateChange) > cb.config.Timeout {
			cb.state = CircuitHalfOpen
			cb.lastStateChange = time.Now()
			cb.halfOpenRequests = 0
			return true
		}
		return false
	case CircuitHalfOpen:
		if cb.halfOpenRequests < int64(cb.config.HalfOpenRequests) {
			cb.halfOpenRequests++
			return true
		}
		return false
	}
	return true
}

func (r *Router) recordSuccess(providerName string, latency time.Duration) {
	r.mu.Lock()
	r.metrics.ProviderUsage[providerName]++
	r.mu.Unlock()

	r.mu.RLock()
	cb, ok := r.circuitState[providerName]
	r.mu.RUnlock()

	if !ok {
		return
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.successes++
	cb.failures = 0

	if cb.state == CircuitHalfOpen {
		if cb.successes >= int64(cb.config.SuccessThreshold) {
			cb.state = CircuitClosed
			cb.lastStateChange = time.Now()
			cb.successes = 0
		}
	}
}

func (r *Router) recordFailure(providerName string, err error) {
	r.mu.RLock()
	cb, ok := r.circuitState[providerName]
	r.mu.RUnlock()

	if !ok {
		return
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()
	cb.successes = 0

	switch cb.state {
	case CircuitClosed:
		if cb.failures >= int64(cb.config.FailureThreshold) {
			cb.state = CircuitOpen
			cb.lastStateChange = time.Now()
			atomic.AddInt64(&r.metrics.CircuitBreaks, 1)
		}
	case CircuitHalfOpen:
		cb.state = CircuitOpen
		cb.lastStateChange = time.Now()
	}
}

func (r *Router) shouldRetry(err error) bool {
	if r.retryPolicy.RetryableError != nil {
		return r.retryPolicy.RetryableError(err)
	}

	var providerErr *ProviderError
	if errors.As(err, &providerErr) {
		return providerErr.IsRetryable()
	}

	return false
}

func (r *Router) calculateBackoff(attempt int) time.Duration {
	delay := r.retryPolicy.InitialDelay
	for i := 0; i < attempt; i++ {
		delay = time.Duration(float64(delay) * r.retryPolicy.BackoffFactor)
	}
	if delay > r.retryPolicy.MaxDelay {
		delay = r.retryPolicy.MaxDelay
	}
	jitter := time.Duration(rand.Int63n(int64(delay / 4)))
	return delay + jitter
}

func (r *Router) incrementActiveConns(name string) {
	r.loadBalancer.mu.Lock()
	defer r.loadBalancer.mu.Unlock()
	if r.loadBalancer.activeConns == nil {
		r.loadBalancer.activeConns = make(map[string]*int64)
	}
	if r.loadBalancer.activeConns[name] == nil {
		var zero int64
		r.loadBalancer.activeConns[name] = &zero
	}
	atomic.AddInt64(r.loadBalancer.activeConns[name], 1)
}

func (r *Router) decrementActiveConns(name string) {
	r.loadBalancer.mu.Lock()
	defer r.loadBalancer.mu.Unlock()
	if ptr := r.loadBalancer.activeConns[name]; ptr != nil {
		if atomic.LoadInt64(ptr) > 0 {
			atomic.AddInt64(ptr, -1)
		}
	}
}

func (r *Router) Metrics() RouterMetrics {
	r.mu.RLock()
	defer r.mu.RUnlock()
	usage := make(map[string]int64)
	for k, v := range r.metrics.ProviderUsage {
		usage[k] = v
	}
	return RouterMetrics{
		TotalRequests:    atomic.LoadInt64(&r.metrics.TotalRequests),
		SuccessfulRoutes: atomic.LoadInt64(&r.metrics.SuccessfulRoutes),
		FailedRoutes:     atomic.LoadInt64(&r.metrics.FailedRoutes),
		Retries:          atomic.LoadInt64(&r.metrics.Retries),
		Failovers:        atomic.LoadInt64(&r.metrics.Failovers),
		CircuitBreaks:    atomic.LoadInt64(&r.metrics.CircuitBreaks),
		ProviderUsage:    usage,
		AvgLatency:       r.metrics.AvgLatency,
	}
}

func (r *Router) SetStrategy(strategy RoutingStrategy) {
	r.mu.Lock()
	r.strategy = strategy
	r.mu.Unlock()
}

func (r *Router) GetStrategy() RoutingStrategy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.strategy
}

func (r *Router) ResetCircuit(providerName string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if cb, ok := r.circuitState[providerName]; ok {
		cb.mu.Lock()
		cb.state = CircuitClosed
		cb.failures = 0
		cb.successes = 0
		cb.lastStateChange = time.Now()
		cb.mu.Unlock()
	}
}

func (r *Router) GetCircuitState(providerName string) CircuitState {
	r.mu.RLock()
	cb, ok := r.circuitState[providerName]
	r.mu.RUnlock()
	if !ok {
		return CircuitClosed
	}
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

func hasCapability(caps []Capability, target Capability) bool {
	for _, c := range caps {
		if c == target {
			return true
		}
	}
	return false
}

type MultiProviderRequest struct {
	Requests map[string]CompletionRequest
	Timeout  time.Duration
}

type MultiProviderResponse struct {
	Responses map[string]*CompletionResponse
	Errors    map[string]error
}

func (r *Router) RouteMultiple(ctx context.Context, req MultiProviderRequest) *MultiProviderResponse {
	result := &MultiProviderResponse{
		Responses: make(map[string]*CompletionResponse),
		Errors:    make(map[string]error),
	}

	if req.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, req.Timeout)
		defer cancel()
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for providerName, compReq := range req.Requests {
		wg.Add(1)
		go func(name string, creq CompletionRequest) {
			defer wg.Done()

			provider, ok := r.registry.Get(name)
			if !ok {
				mu.Lock()
				result.Errors[name] = errors.New("provider not found")
				mu.Unlock()
				return
			}

			resp, err := provider.Complete(ctx, creq)
			mu.Lock()
			if err != nil {
				result.Errors[name] = err
			} else {
				result.Responses[name] = resp
			}
			mu.Unlock()
		}(providerName, compReq)
	}

	wg.Wait()
	return result
}

func (r *Router) RouteFastest(ctx context.Context, req CompletionRequest, providers []string) (*CompletionResponse, error) {
	if len(providers) == 0 {
		var err error
		providers, err = r.selectProviders(req)
		if err != nil {
			return nil, err
		}
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	type result struct {
		resp *CompletionResponse
		err  error
	}

	resultCh := make(chan result, len(providers))

	for _, name := range providers {
		go func(providerName string) {
			provider, ok := r.registry.Get(providerName)
			if !ok {
				resultCh <- result{err: errors.New("provider not found")}
				return
			}

			resp, err := provider.Complete(ctx, req)
			resultCh <- result{resp: resp, err: err}
		}(name)
	}

	var lastErr error
	for i := 0; i < len(providers); i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case res := <-resultCh:
			if res.err == nil {
				return res.resp, nil
			}
			lastErr = res.err
		}
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("all providers failed")
}

func (r *Router) RouteConsensus(ctx context.Context, req CompletionRequest, minAgreement int) (*CompletionResponse, error) {
	providers, err := r.selectProviders(req)
	if err != nil {
		return nil, err
	}

	if len(providers) < minAgreement {
		return nil, errors.New("not enough providers for consensus")
	}

	responses := make([]*CompletionResponse, 0, len(providers))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, name := range providers {
		wg.Add(1)
		go func(providerName string) {
			defer wg.Done()

			provider, ok := r.registry.Get(providerName)
			if !ok {
				return
			}

			resp, err := provider.Complete(ctx, req)
			if err == nil {
				mu.Lock()
				responses = append(responses, resp)
				mu.Unlock()
			}
		}(name)
	}

	wg.Wait()

	if len(responses) < minAgreement {
		return nil, errors.New("not enough successful responses for consensus")
	}

	contentCounts := make(map[string]int)
	contentToResp := make(map[string]*CompletionResponse)

	for _, resp := range responses {
		content := resp.Message.Content
		contentCounts[content]++
		contentToResp[content] = resp
	}

	var bestContent string
	var bestCount int
	for content, count := range contentCounts {
		if count > bestCount {
			bestCount = count
			bestContent = content
		}
	}

	if bestCount >= minAgreement {
		return contentToResp[bestContent], nil
	}

	return responses[0], nil
}
