package model

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/provider"
)

type Selector struct {
	registry    *ModelRegistry
	preferences SelectorPreferences
	cache       *selectionCache
	mu          sync.RWMutex
}

type SelectorPreferences struct {
	DefaultProvider   provider.ProviderType   `json:"default_provider,omitempty"`
	PreferLocal       bool                    `json:"prefer_local"`
	PreferFast        bool                    `json:"prefer_fast"`
	PreferCheap       bool                    `json:"prefer_cheap"`
	PreferQuality     bool                    `json:"prefer_quality"`
	MaxCostPerRequest float64                 `json:"max_cost_per_request,omitempty"`
	MaxLatency        time.Duration           `json:"max_latency,omitempty"`
	MinContextWindow  int                     `json:"min_context_window,omitempty"`
	ExcludeProviders  []provider.ProviderType `json:"exclude_providers,omitempty"`
	ExcludeModels     []string                `json:"exclude_models,omitempty"`
	FallbackModel     string                  `json:"fallback_model,omitempty"`
}

type selectionCache struct {
	entries map[string]*cacheEntry
	mu      sync.RWMutex
	ttl     time.Duration
}

type cacheEntry struct {
	model     *Model
	timestamp time.Time
}

type SelectionCriteria struct {
	Task             TaskType
	RequiredCaps     []provider.Capability
	MinContextWindow int
	MaxCost          float64
	PreferSpeed      bool
	PreferQuality    bool
	PreferLocal      bool
	InputTokens      int
	OutputTokens     int
}

type SelectionResult struct {
	Model        *Model
	Score        float64
	Reason       string
	Alternatives []*Model
}

func NewSelector(registry *ModelRegistry, prefs SelectorPreferences) *Selector {
	if registry == nil {
		registry = GlobalModelRegistry
	}
	return &Selector{
		registry:    registry,
		preferences: prefs,
		cache: &selectionCache{
			entries: make(map[string]*cacheEntry),
			ttl:     5 * time.Minute,
		},
	}
}

func (s *Selector) Select(ctx context.Context, criteria SelectionCriteria) *SelectionResult {
	cacheKey := s.buildCacheKey(criteria)
	if cached := s.getFromCache(cacheKey); cached != nil {
		return &SelectionResult{
			Model:  cached,
			Score:  100,
			Reason: "cached selection",
		}
	}

	candidates := s.filterCandidates(criteria)
	if len(candidates) == 0 {
		if s.preferences.FallbackModel != "" {
			if fallback, ok := s.registry.Get(s.preferences.FallbackModel); ok {
				return &SelectionResult{
					Model:  fallback,
					Score:  50,
					Reason: "fallback model (no candidates matched criteria)",
				}
			}
		}
		return nil
	}

	scored := s.scoreModels(candidates, criteria)
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	best := scored[0]
	s.setCache(cacheKey, best.model)

	var alternatives []*Model
	for i := 1; i < len(scored) && i <= 3; i++ {
		alternatives = append(alternatives, scored[i].model)
	}

	return &SelectionResult{
		Model:        best.model,
		Score:        best.score,
		Reason:       best.reason,
		Alternatives: alternatives,
	}
}

func (s *Selector) SelectForTask(ctx context.Context, task TaskType) *SelectionResult {
	criteria := SelectionCriteria{
		Task:          task,
		PreferSpeed:   s.preferences.PreferFast,
		PreferQuality: s.preferences.PreferQuality,
		PreferLocal:   s.preferences.PreferLocal,
	}

	switch task {
	case TaskCoding:
		criteria.RequiredCaps = []provider.Capability{provider.CapabilityChat}
	case TaskVision:
		criteria.RequiredCaps = []provider.Capability{provider.CapabilityVision}
	case TaskReasoning:
		criteria.PreferQuality = true
	case TaskChat:
		criteria.PreferSpeed = true
	}

	return s.Select(ctx, criteria)
}

func (s *Selector) SelectCheapest(ctx context.Context, caps []provider.Capability) *SelectionResult {
	criteria := SelectionCriteria{
		RequiredCaps: caps,
	}

	candidates := s.filterCandidates(criteria)
	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		costI := candidates[i].Pricing.InputPerMillion + candidates[i].Pricing.OutputPerMillion
		costJ := candidates[j].Pricing.InputPerMillion + candidates[j].Pricing.OutputPerMillion
		if candidates[i].Pricing.Free {
			costI = 0
		}
		if candidates[j].Pricing.Free {
			costJ = 0
		}
		return costI < costJ
	})

	return &SelectionResult{
		Model:  candidates[0],
		Score:  100,
		Reason: "cheapest model with required capabilities",
	}
}

func (s *Selector) SelectFastest(ctx context.Context, caps []provider.Capability) *SelectionResult {
	criteria := SelectionCriteria{
		RequiredCaps: caps,
		PreferSpeed:  true,
	}

	candidates := s.filterCandidates(criteria)
	if len(candidates) == 0 {
		return nil
	}

	speedOrder := map[SpeedTier]int{
		SpeedInstant:  0,
		SpeedFast:     1,
		SpeedMedium:   2,
		SpeedSlow:     3,
		SpeedVerySlow: 4,
	}

	sort.Slice(candidates, func(i, j int) bool {
		return speedOrder[candidates[i].Performance.SpeedTier] < speedOrder[candidates[j].Performance.SpeedTier]
	})

	return &SelectionResult{
		Model:  candidates[0],
		Score:  100,
		Reason: "fastest model with required capabilities",
	}
}

func (s *Selector) SelectBestQuality(ctx context.Context, caps []provider.Capability) *SelectionResult {
	criteria := SelectionCriteria{
		RequiredCaps:  caps,
		PreferQuality: true,
	}

	candidates := s.filterCandidates(criteria)
	if len(candidates) == 0 {
		return nil
	}

	qualityOrder := map[QualityTier]int{
		QualityFrontier: 0,
		QualityHigh:     1,
		QualityMedium:   2,
		QualityLow:      3,
	}

	sort.Slice(candidates, func(i, j int) bool {
		return qualityOrder[candidates[i].Performance.QualityTier] < qualityOrder[candidates[j].Performance.QualityTier]
	})

	return &SelectionResult{
		Model:  candidates[0],
		Score:  100,
		Reason: "highest quality model with required capabilities",
	}
}

func (s *Selector) SelectLocal(ctx context.Context) *SelectionResult {
	candidates := make([]*Model, 0)
	for _, m := range s.registry.List() {
		if m.IsLocal() && !m.Deprecated {
			candidates = append(candidates, m)
		}
	}

	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		qi := s.qualityScore(candidates[i].Performance.QualityTier)
		qj := s.qualityScore(candidates[j].Performance.QualityTier)
		return qi > qj
	})

	return &SelectionResult{
		Model:  candidates[0],
		Score:  100,
		Reason: "best local model",
	}
}

func (s *Selector) SelectByProvider(ctx context.Context, ptype provider.ProviderType) *SelectionResult {
	candidates := s.registry.ListByProvider(ptype)
	if len(candidates) == 0 {
		return nil
	}

	active := make([]*Model, 0)
	for _, m := range candidates {
		if !m.Deprecated {
			active = append(active, m)
		}
	}

	if len(active) == 0 {
		return nil
	}

	sort.Slice(active, func(i, j int) bool {
		return s.qualityScore(active[i].Performance.QualityTier) > s.qualityScore(active[j].Performance.QualityTier)
	})

	return &SelectionResult{
		Model:  active[0],
		Score:  100,
		Reason: "best model from " + string(ptype),
	}
}

func (s *Selector) EstimateCost(modelID string, inputTokens, outputTokens int) float64 {
	m, ok := s.registry.Get(modelID)
	if !ok {
		return 0
	}
	return m.CostPer1K(inputTokens, outputTokens) * 1000
}

func (s *Selector) filterCandidates(criteria SelectionCriteria) []*Model {
	all := s.registry.List()
	result := make([]*Model, 0, len(all))

	for _, m := range all {
		if m.Deprecated {
			continue
		}

		if s.isExcluded(m) {
			continue
		}

		if len(criteria.RequiredCaps) > 0 {
			hasAll := true
			for _, cap := range criteria.RequiredCaps {
				if !m.HasCapability(cap) {
					hasAll = false
					break
				}
			}
			if !hasAll {
				continue
			}
		}

		if criteria.MinContextWindow > 0 && m.ContextWindow < criteria.MinContextWindow {
			continue
		}

		if criteria.MaxCost > 0 && !m.Pricing.Free {
			avgCost := (m.Pricing.InputPerMillion + m.Pricing.OutputPerMillion) / 2 / 1000000
			if avgCost > criteria.MaxCost {
				continue
			}
		}

		if criteria.PreferLocal && !m.IsLocal() {
			continue
		}

		result = append(result, m)
	}

	return result
}

func (s *Selector) isExcluded(m *Model) bool {
	for _, ptype := range s.preferences.ExcludeProviders {
		if m.Provider == ptype {
			return true
		}
	}
	for _, modelID := range s.preferences.ExcludeModels {
		if m.ID == modelID {
			return true
		}
	}
	return false
}

type scoredModel struct {
	model  *Model
	score  float64
	reason string
}

func (s *Selector) scoreModels(models []*Model, criteria SelectionCriteria) []scoredModel {
	result := make([]scoredModel, 0, len(models))

	for _, m := range models {
		score, reason := s.scoreModel(m, criteria)
		result = append(result, scoredModel{
			model:  m,
			score:  score,
			reason: reason,
		})
	}

	return result
}

func (s *Selector) scoreModel(m *Model, criteria SelectionCriteria) (float64, string) {
	var score float64
	reasons := make([]string, 0)

	qualityScore := s.qualityScore(m.Performance.QualityTier)
	score += qualityScore * 0.3
	if qualityScore >= 35 {
		reasons = append(reasons, "high quality")
	}

	speedScore := s.speedScore(m.Performance.SpeedTier)
	score += speedScore * 0.25
	if speedScore >= 20 {
		reasons = append(reasons, "fast")
	}

	costScore := s.costScore(m)
	score += costScore * 0.2
	if costScore >= 15 {
		reasons = append(reasons, "cost-effective")
	}

	taskScore := s.taskScore(m, criteria.Task)
	score += taskScore * 0.15

	contextScore := float64(m.ContextWindow) / 200000 * 10
	if contextScore > 10 {
		contextScore = 10
	}
	score += contextScore

	if criteria.PreferQuality {
		score += qualityScore * 0.2
	}
	if criteria.PreferSpeed {
		score += speedScore * 0.2
	}
	if criteria.PreferLocal && m.IsLocal() {
		score += 15
		reasons = append(reasons, "local")
	}

	if s.preferences.DefaultProvider != "" && m.Provider == s.preferences.DefaultProvider {
		score += 10
	}

	reason := strings.Join(reasons, ", ")
	if reason == "" {
		reason = "balanced selection"
	}

	return score, reason
}

func (s *Selector) qualityScore(tier QualityTier) float64 {
	switch tier {
	case QualityFrontier:
		return 40
	case QualityHigh:
		return 30
	case QualityMedium:
		return 20
	case QualityLow:
		return 10
	default:
		return 15
	}
}

func (s *Selector) speedScore(tier SpeedTier) float64 {
	switch tier {
	case SpeedInstant:
		return 25
	case SpeedFast:
		return 20
	case SpeedMedium:
		return 15
	case SpeedSlow:
		return 10
	case SpeedVerySlow:
		return 5
	default:
		return 12
	}
}

func (s *Selector) costScore(m *Model) float64 {
	if m.Pricing.Free {
		return 20
	}
	avgCost := (m.Pricing.InputPerMillion + m.Pricing.OutputPerMillion) / 2
	if avgCost < 0.5 {
		return 18
	} else if avgCost < 2 {
		return 15
	} else if avgCost < 10 {
		return 10
	} else if avgCost < 30 {
		return 5
	}
	return 2
}

func (s *Selector) taskScore(m *Model, task TaskType) float64 {
	var score float64

	switch task {
	case TaskCoding:
		if m.Family == FamilyCodeLlama || strings.Contains(strings.ToLower(m.ID), "coder") {
			score += 15
		}
		if m.Family == FamilyQwen && strings.Contains(m.ID, "coder") {
			score += 12
		}
		if m.HasCapability(provider.CapabilityToolUse) {
			score += 5
		}

	case TaskReasoning:
		if m.Family == FamilyO1 || m.Family == FamilyO3 {
			score += 20
		}
		if strings.Contains(strings.ToLower(m.ID), "r1") {
			score += 15
		}
		if m.Performance.QualityTier == QualityFrontier {
			score += 10
		}

	case TaskVision:
		if m.HasCapability(provider.CapabilityVision) {
			score += 20
		}

	case TaskCreative:
		if m.Performance.QualityTier == QualityFrontier {
			score += 15
		}
		if m.ContextWindow >= 100000 {
			score += 5
		}

	case TaskAnalysis:
		if m.ContextWindow >= 100000 {
			score += 10
		}
		if m.Performance.QualityTier == QualityFrontier || m.Performance.QualityTier == QualityHigh {
			score += 10
		}

	case TaskChat:
		if m.Performance.SpeedTier == SpeedInstant || m.Performance.SpeedTier == SpeedFast {
			score += 15
		}

	case TaskEmbedding:
		if m.HasCapability(provider.CapabilityEmbedding) {
			score += 20
		}
	}

	return score
}

func (s *Selector) buildCacheKey(criteria SelectionCriteria) string {
	parts := []string{
		string(criteria.Task),
	}
	for _, cap := range criteria.RequiredCaps {
		parts = append(parts, string(cap))
	}
	if criteria.PreferSpeed {
		parts = append(parts, "speed")
	}
	if criteria.PreferQuality {
		parts = append(parts, "quality")
	}
	if criteria.PreferLocal {
		parts = append(parts, "local")
	}
	return strings.Join(parts, ":")
}

func (s *Selector) getFromCache(key string) *Model {
	s.cache.mu.RLock()
	defer s.cache.mu.RUnlock()

	entry, ok := s.cache.entries[key]
	if !ok {
		return nil
	}

	if time.Since(entry.timestamp) > s.cache.ttl {
		return nil
	}

	return entry.model
}

func (s *Selector) setCache(key string, m *Model) {
	s.cache.mu.Lock()
	defer s.cache.mu.Unlock()

	s.cache.entries[key] = &cacheEntry{
		model:     m,
		timestamp: time.Now(),
	}
}

func (s *Selector) ClearCache() {
	s.cache.mu.Lock()
	defer s.cache.mu.Unlock()
	s.cache.entries = make(map[string]*cacheEntry)
}

func (s *Selector) SetPreferences(prefs SelectorPreferences) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.preferences = prefs
	s.ClearCache()
}

func (s *Selector) GetPreferences() SelectorPreferences {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.preferences
}

var GlobalSelector = NewSelector(nil, SelectorPreferences{})

func SelectModel(ctx context.Context, criteria SelectionCriteria) *SelectionResult {
	return GlobalSelector.Select(ctx, criteria)
}

func SelectForTask(ctx context.Context, task TaskType) *SelectionResult {
	return GlobalSelector.SelectForTask(ctx, task)
}

func SelectCheapest(ctx context.Context, caps []provider.Capability) *SelectionResult {
	return GlobalSelector.SelectCheapest(ctx, caps)
}

func SelectFastest(ctx context.Context, caps []provider.Capability) *SelectionResult {
	return GlobalSelector.SelectFastest(ctx, caps)
}

func SelectBestQuality(ctx context.Context, caps []provider.Capability) *SelectionResult {
	return GlobalSelector.SelectBestQuality(ctx, caps)
}

func SelectLocal(ctx context.Context) *SelectionResult {
	return GlobalSelector.SelectLocal(ctx)
}
