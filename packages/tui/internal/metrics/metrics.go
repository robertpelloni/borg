package metrics

import (
	"sync"
	"time"
)

type TokenUsage struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	TotalTokens  int64 `json:"total_tokens"`
}

type RequestMetrics struct {
	ID           string        `json:"id"`
	Provider     string        `json:"provider"`
	Model        string        `json:"model"`
	Tokens       TokenUsage    `json:"tokens"`
	Cost         float64       `json:"cost"`
	Duration     time.Duration `json:"duration"`
	Timestamp    time.Time     `json:"timestamp"`
	Success      bool          `json:"success"`
	ErrorMessage string        `json:"error_message,omitempty"`
}

type SessionStats struct {
	SessionID      string                `json:"session_id"`
	StartTime      time.Time             `json:"start_time"`
	TotalRequests  int64                 `json:"total_requests"`
	SuccessCount   int64                 `json:"success_count"`
	ErrorCount     int64                 `json:"error_count"`
	TotalTokens    TokenUsage            `json:"total_tokens"`
	TotalCost      float64               `json:"total_cost"`
	TotalDuration  time.Duration         `json:"total_duration"`
	AvgDuration    time.Duration         `json:"avg_duration"`
	TokensByModel  map[string]TokenUsage `json:"tokens_by_model"`
	CostByProvider map[string]float64    `json:"cost_by_provider"`
}

type ProviderPricing struct {
	InputPer1K  float64
	OutputPer1K float64
}

var defaultPricing = map[string]map[string]ProviderPricing{
	"openai": {
		"gpt-4":         {InputPer1K: 0.03, OutputPer1K: 0.06},
		"gpt-4-turbo":   {InputPer1K: 0.01, OutputPer1K: 0.03},
		"gpt-4o":        {InputPer1K: 0.005, OutputPer1K: 0.015},
		"gpt-4o-mini":   {InputPer1K: 0.00015, OutputPer1K: 0.0006},
		"gpt-3.5-turbo": {InputPer1K: 0.0005, OutputPer1K: 0.0015},
	},
	"anthropic": {
		"claude-3-opus":     {InputPer1K: 0.015, OutputPer1K: 0.075},
		"claude-3-sonnet":   {InputPer1K: 0.003, OutputPer1K: 0.015},
		"claude-3-haiku":    {InputPer1K: 0.00025, OutputPer1K: 0.00125},
		"claude-3.5-sonnet": {InputPer1K: 0.003, OutputPer1K: 0.015},
	},
	"google": {
		"gemini-pro":     {InputPer1K: 0.00025, OutputPer1K: 0.0005},
		"gemini-1.5-pro": {InputPer1K: 0.00125, OutputPer1K: 0.005},
	},
}

type Collector struct {
	mu           sync.RWMutex
	requests     []RequestMetrics
	sessionStats *SessionStats
	pricing      map[string]map[string]ProviderPricing
	maxRequests  int
}

func NewCollector(sessionID string) *Collector {
	return &Collector{
		requests:    make([]RequestMetrics, 0, 1000),
		maxRequests: 10000,
		pricing:     defaultPricing,
		sessionStats: &SessionStats{
			SessionID:      sessionID,
			StartTime:      time.Now(),
			TokensByModel:  make(map[string]TokenUsage),
			CostByProvider: make(map[string]float64),
		},
	}
}

func (c *Collector) Record(req RequestMetrics) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if req.Cost == 0 {
		req.Cost = c.calculateCost(req.Provider, req.Model, req.Tokens)
	}

	c.requests = append(c.requests, req)
	if len(c.requests) > c.maxRequests {
		c.requests = c.requests[len(c.requests)-c.maxRequests:]
	}

	c.updateStats(req)
}

func (c *Collector) calculateCost(provider, model string, tokens TokenUsage) float64 {
	if providerPricing, ok := c.pricing[provider]; ok {
		if modelPricing, ok := providerPricing[model]; ok {
			inputCost := float64(tokens.InputTokens) / 1000 * modelPricing.InputPer1K
			outputCost := float64(tokens.OutputTokens) / 1000 * modelPricing.OutputPer1K
			return inputCost + outputCost
		}
	}
	return 0
}

func (c *Collector) updateStats(req RequestMetrics) {
	s := c.sessionStats
	s.TotalRequests++

	if req.Success {
		s.SuccessCount++
	} else {
		s.ErrorCount++
	}

	s.TotalTokens.InputTokens += req.Tokens.InputTokens
	s.TotalTokens.OutputTokens += req.Tokens.OutputTokens
	s.TotalTokens.TotalTokens += req.Tokens.TotalTokens
	s.TotalCost += req.Cost
	s.TotalDuration += req.Duration

	if s.TotalRequests > 0 {
		s.AvgDuration = s.TotalDuration / time.Duration(s.TotalRequests)
	}

	modelKey := req.Provider + "/" + req.Model
	if existing, ok := s.TokensByModel[modelKey]; ok {
		s.TokensByModel[modelKey] = TokenUsage{
			InputTokens:  existing.InputTokens + req.Tokens.InputTokens,
			OutputTokens: existing.OutputTokens + req.Tokens.OutputTokens,
			TotalTokens:  existing.TotalTokens + req.Tokens.TotalTokens,
		}
	} else {
		s.TokensByModel[modelKey] = req.Tokens
	}

	s.CostByProvider[req.Provider] += req.Cost
}

func (c *Collector) Stats() SessionStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	statsCopy := *c.sessionStats
	statsCopy.TokensByModel = make(map[string]TokenUsage)
	for k, v := range c.sessionStats.TokensByModel {
		statsCopy.TokensByModel[k] = v
	}
	statsCopy.CostByProvider = make(map[string]float64)
	for k, v := range c.sessionStats.CostByProvider {
		statsCopy.CostByProvider[k] = v
	}

	return statsCopy
}

func (c *Collector) RecentRequests(n int) []RequestMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if n <= 0 || n > len(c.requests) {
		n = len(c.requests)
	}

	result := make([]RequestMetrics, n)
	copy(result, c.requests[len(c.requests)-n:])
	return result
}

func (c *Collector) RequestCount() int64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.sessionStats.TotalRequests
}

func (c *Collector) TotalCost() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.sessionStats.TotalCost
}

func (c *Collector) TotalTokens() TokenUsage {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.sessionStats.TotalTokens
}

func (c *Collector) SuccessRate() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.sessionStats.TotalRequests == 0 {
		return 0
	}
	return float64(c.sessionStats.SuccessCount) / float64(c.sessionStats.TotalRequests) * 100
}

func (c *Collector) SetPricing(provider, model string, pricing ProviderPricing) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.pricing[provider]; !ok {
		c.pricing[provider] = make(map[string]ProviderPricing)
	}
	c.pricing[provider][model] = pricing
}

func (c *Collector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.requests = make([]RequestMetrics, 0, 1000)
	c.sessionStats = &SessionStats{
		SessionID:      c.sessionStats.SessionID,
		StartTime:      time.Now(),
		TokensByModel:  make(map[string]TokenUsage),
		CostByProvider: make(map[string]float64),
	}
}
