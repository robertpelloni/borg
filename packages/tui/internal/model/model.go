package model

import (
	"strings"
	"time"

	"github.com/aios/superai-cli/internal/provider"
)

type Model struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Provider      provider.ProviderType  `json:"provider"`
	Family        ModelFamily            `json:"family"`
	Version       string                 `json:"version,omitempty"`
	Description   string                 `json:"description,omitempty"`
	ContextWindow int                    `json:"context_window"`
	MaxOutput     int                    `json:"max_output"`
	Capabilities  []provider.Capability  `json:"capabilities"`
	Pricing       ModelPricing           `json:"pricing"`
	Performance   ModelPerformance       `json:"performance,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Deprecated    bool                   `json:"deprecated,omitempty"`
	ReleaseDate   time.Time              `json:"release_date,omitempty"`
}

type ModelFamily string

const (
	FamilyGPT4      ModelFamily = "gpt-4"
	FamilyGPT35     ModelFamily = "gpt-3.5"
	FamilyO1        ModelFamily = "o1"
	FamilyO3        ModelFamily = "o3"
	FamilyClaude3   ModelFamily = "claude-3"
	FamilyClaude35  ModelFamily = "claude-3.5"
	FamilyGemini1   ModelFamily = "gemini-1"
	FamilyGemini15  ModelFamily = "gemini-1.5"
	FamilyGemini2   ModelFamily = "gemini-2"
	FamilyLlama3    ModelFamily = "llama-3"
	FamilyQwen      ModelFamily = "qwen"
	FamilyDeepSeek  ModelFamily = "deepseek"
	FamilyMistral   ModelFamily = "mistral"
	FamilyMixtral   ModelFamily = "mixtral"
	FamilyPhi       ModelFamily = "phi"
	FamilyGemma     ModelFamily = "gemma"
	FamilyCodeLlama ModelFamily = "codellama"
	FamilyCommand   ModelFamily = "command"
	FamilyCustom    ModelFamily = "custom"
)

type ModelPricing struct {
	InputPerMillion  float64 `json:"input_per_million"`
	OutputPerMillion float64 `json:"output_per_million"`
	CachedInput      float64 `json:"cached_input,omitempty"`
	Currency         string  `json:"currency"`
	Free             bool    `json:"free,omitempty"`
}

type ModelPerformance struct {
	SpeedTier       SpeedTier     `json:"speed_tier"`
	QualityTier     QualityTier   `json:"quality_tier"`
	AvgLatency      time.Duration `json:"avg_latency,omitempty"`
	TokensPerSecond float64       `json:"tokens_per_second,omitempty"`
}

type SpeedTier string

const (
	SpeedInstant  SpeedTier = "instant"
	SpeedFast     SpeedTier = "fast"
	SpeedMedium   SpeedTier = "medium"
	SpeedSlow     SpeedTier = "slow"
	SpeedVerySlow SpeedTier = "very_slow"
)

type QualityTier string

const (
	QualityFrontier QualityTier = "frontier"
	QualityHigh     QualityTier = "high"
	QualityMedium   QualityTier = "medium"
	QualityLow      QualityTier = "low"
)

type TaskType string

const (
	TaskGeneral       TaskType = "general"
	TaskCoding        TaskType = "coding"
	TaskReasoning     TaskType = "reasoning"
	TaskCreative      TaskType = "creative"
	TaskAnalysis      TaskType = "analysis"
	TaskSummarization TaskType = "summarization"
	TaskTranslation   TaskType = "translation"
	TaskChat          TaskType = "chat"
	TaskInstruction   TaskType = "instruction"
	TaskEmbedding     TaskType = "embedding"
	TaskVision        TaskType = "vision"
	TaskAudio         TaskType = "audio"
)

func (m *Model) HasCapability(cap provider.Capability) bool {
	for _, c := range m.Capabilities {
		if c == cap {
			return true
		}
	}
	return false
}

func (m *Model) CostPer1K(inputTokens, outputTokens int) float64 {
	if m.Pricing.Free {
		return 0
	}
	input := float64(inputTokens) / 1000 * m.Pricing.InputPerMillion / 1000
	output := float64(outputTokens) / 1000 * m.Pricing.OutputPerMillion / 1000
	return input + output
}

func (m *Model) SupportsContext(tokens int) bool {
	return tokens <= m.ContextWindow
}

func (m *Model) IsLocal() bool {
	return m.Provider == provider.ProviderTypeOllama || m.Provider == provider.ProviderTypeLocal
}

var DefaultModels = map[string]*Model{
	"gpt-4o": {
		ID:            "gpt-4o",
		Name:          "GPT-4o",
		Provider:      provider.ProviderTypeOpenAI,
		Family:        FamilyGPT4,
		Description:   "Most capable GPT-4 model with vision",
		ContextWindow: 128000,
		MaxOutput:     16384,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming, provider.CapabilityJSON,
		},
		Pricing: ModelPricing{
			InputPerMillion:  2.50,
			OutputPerMillion: 10.00,
			CachedInput:      1.25,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityFrontier,
		},
	},
	"gpt-4o-mini": {
		ID:            "gpt-4o-mini",
		Name:          "GPT-4o Mini",
		Provider:      provider.ProviderTypeOpenAI,
		Family:        FamilyGPT4,
		Description:   "Affordable small model for fast tasks",
		ContextWindow: 128000,
		MaxOutput:     16384,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming, provider.CapabilityJSON,
		},
		Pricing: ModelPricing{
			InputPerMillion:  0.15,
			OutputPerMillion: 0.60,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedInstant,
			QualityTier: QualityMedium,
		},
	},
	"gpt-4-turbo": {
		ID:            "gpt-4-turbo",
		Name:          "GPT-4 Turbo",
		Provider:      provider.ProviderTypeOpenAI,
		Family:        FamilyGPT4,
		Description:   "GPT-4 Turbo with vision",
		ContextWindow: 128000,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming, provider.CapabilityJSON,
		},
		Pricing: ModelPricing{
			InputPerMillion:  10.00,
			OutputPerMillion: 30.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedMedium,
			QualityTier: QualityHigh,
		},
	},
	"o1": {
		ID:            "o1",
		Name:          "O1",
		Provider:      provider.ProviderTypeOpenAI,
		Family:        FamilyO1,
		Description:   "Reasoning model for complex tasks",
		ContextWindow: 200000,
		MaxOutput:     100000,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			InputPerMillion:  15.00,
			OutputPerMillion: 60.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedSlow,
			QualityTier: QualityFrontier,
		},
	},
	"o1-mini": {
		ID:            "o1-mini",
		Name:          "O1 Mini",
		Provider:      provider.ProviderTypeOpenAI,
		Family:        FamilyO1,
		Description:   "Fast reasoning model",
		ContextWindow: 128000,
		MaxOutput:     65536,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			InputPerMillion:  3.00,
			OutputPerMillion: 12.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedMedium,
			QualityTier: QualityHigh,
		},
	},
	"o3-mini": {
		ID:            "o3-mini",
		Name:          "O3 Mini",
		Provider:      provider.ProviderTypeOpenAI,
		Family:        FamilyO3,
		Description:   "Latest reasoning model",
		ContextWindow: 200000,
		MaxOutput:     100000,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityToolUse, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			InputPerMillion:  1.10,
			OutputPerMillion: 4.40,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityFrontier,
		},
	},
	"claude-3-5-sonnet-20241022": {
		ID:            "claude-3-5-sonnet-20241022",
		Name:          "Claude 3.5 Sonnet",
		Provider:      provider.ProviderTypeAnthropic,
		Family:        FamilyClaude35,
		Description:   "Best balance of speed and intelligence",
		ContextWindow: 200000,
		MaxOutput:     8192,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			InputPerMillion:  3.00,
			OutputPerMillion: 15.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityFrontier,
		},
	},
	"claude-3-5-haiku-20241022": {
		ID:            "claude-3-5-haiku-20241022",
		Name:          "Claude 3.5 Haiku",
		Provider:      provider.ProviderTypeAnthropic,
		Family:        FamilyClaude35,
		Description:   "Fastest Claude model",
		ContextWindow: 200000,
		MaxOutput:     8192,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			InputPerMillion:  1.00,
			OutputPerMillion: 5.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedInstant,
			QualityTier: QualityMedium,
		},
	},
	"claude-3-opus-20240229": {
		ID:            "claude-3-opus-20240229",
		Name:          "Claude 3 Opus",
		Provider:      provider.ProviderTypeAnthropic,
		Family:        FamilyClaude3,
		Description:   "Most capable Claude model",
		ContextWindow: 200000,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			InputPerMillion:  15.00,
			OutputPerMillion: 75.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedSlow,
			QualityTier: QualityFrontier,
		},
	},
	"gemini-2.0-flash-exp": {
		ID:            "gemini-2.0-flash-exp",
		Name:          "Gemini 2.0 Flash",
		Provider:      provider.ProviderTypeGoogle,
		Family:        FamilyGemini2,
		Description:   "Latest Gemini model with multimodal",
		ContextWindow: 1000000,
		MaxOutput:     8192,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming, provider.CapabilityAudio, provider.CapabilityVideo,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityHigh,
		},
	},
	"gemini-1.5-pro": {
		ID:            "gemini-1.5-pro",
		Name:          "Gemini 1.5 Pro",
		Provider:      provider.ProviderTypeGoogle,
		Family:        FamilyGemini15,
		Description:   "Best Gemini for complex tasks",
		ContextWindow: 2000000,
		MaxOutput:     8192,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming, provider.CapabilityAudio, provider.CapabilityVideo,
		},
		Pricing: ModelPricing{
			InputPerMillion:  1.25,
			OutputPerMillion: 5.00,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedMedium,
			QualityTier: QualityHigh,
		},
	},
	"gemini-1.5-flash": {
		ID:            "gemini-1.5-flash",
		Name:          "Gemini 1.5 Flash",
		Provider:      provider.ProviderTypeGoogle,
		Family:        FamilyGemini15,
		Description:   "Fast and versatile Gemini model",
		ContextWindow: 1000000,
		MaxOutput:     8192,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityVision, provider.CapabilityToolUse,
			provider.CapabilityStreaming, provider.CapabilityAudio, provider.CapabilityVideo,
		},
		Pricing: ModelPricing{
			InputPerMillion:  0.075,
			OutputPerMillion: 0.30,
			Currency:         "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedInstant,
			QualityTier: QualityMedium,
		},
	},
	"llama3.3": {
		ID:            "llama3.3",
		Name:          "Llama 3.3 70B",
		Provider:      provider.ProviderTypeOllama,
		Family:        FamilyLlama3,
		Description:   "Latest Llama model",
		ContextWindow: 128000,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityToolUse, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedMedium,
			QualityTier: QualityHigh,
		},
	},
	"llama3.2": {
		ID:            "llama3.2",
		Name:          "Llama 3.2",
		Provider:      provider.ProviderTypeOllama,
		Family:        FamilyLlama3,
		Description:   "Efficient Llama model",
		ContextWindow: 128000,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityToolUse, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityMedium,
		},
	},
	"qwen2.5-coder": {
		ID:            "qwen2.5-coder",
		Name:          "Qwen 2.5 Coder",
		Provider:      provider.ProviderTypeOllama,
		Family:        FamilyQwen,
		Description:   "Coding specialized Qwen model",
		ContextWindow: 32768,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityHigh,
		},
	},
	"deepseek-r1": {
		ID:            "deepseek-r1",
		Name:          "DeepSeek R1",
		Provider:      provider.ProviderTypeOllama,
		Family:        FamilyDeepSeek,
		Description:   "DeepSeek reasoning model",
		ContextWindow: 64000,
		MaxOutput:     8192,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedMedium,
			QualityTier: QualityHigh,
		},
	},
	"mistral": {
		ID:            "mistral",
		Name:          "Mistral 7B",
		Provider:      provider.ProviderTypeOllama,
		Family:        FamilyMistral,
		Description:   "Efficient open model",
		ContextWindow: 32768,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedInstant,
			QualityTier: QualityMedium,
		},
	},
	"codellama": {
		ID:            "codellama",
		Name:          "Code Llama",
		Provider:      provider.ProviderTypeOllama,
		Family:        FamilyCodeLlama,
		Description:   "Code-specialized Llama",
		ContextWindow: 16384,
		MaxOutput:     4096,
		Capabilities: []provider.Capability{
			provider.CapabilityChat, provider.CapabilityStreaming,
		},
		Pricing: ModelPricing{
			Free:     true,
			Currency: "USD",
		},
		Performance: ModelPerformance{
			SpeedTier:   SpeedFast,
			QualityTier: QualityMedium,
		},
	},
}

type ModelRegistry struct {
	models     map[string]*Model
	byProvider map[provider.ProviderType][]*Model
	byFamily   map[ModelFamily][]*Model
}

func NewModelRegistry() *ModelRegistry {
	r := &ModelRegistry{
		models:     make(map[string]*Model),
		byProvider: make(map[provider.ProviderType][]*Model),
		byFamily:   make(map[ModelFamily][]*Model),
	}

	for id, model := range DefaultModels {
		r.Register(id, model)
	}

	return r
}

func (r *ModelRegistry) Register(id string, model *Model) {
	r.models[id] = model
	r.byProvider[model.Provider] = append(r.byProvider[model.Provider], model)
	r.byFamily[model.Family] = append(r.byFamily[model.Family], model)
}

func (r *ModelRegistry) Get(id string) (*Model, bool) {
	m, ok := r.models[id]
	return m, ok
}

func (r *ModelRegistry) List() []*Model {
	result := make([]*Model, 0, len(r.models))
	for _, m := range r.models {
		result = append(result, m)
	}
	return result
}

func (r *ModelRegistry) ListByProvider(ptype provider.ProviderType) []*Model {
	return r.byProvider[ptype]
}

func (r *ModelRegistry) ListByFamily(family ModelFamily) []*Model {
	return r.byFamily[family]
}

func (r *ModelRegistry) ListByCapability(cap provider.Capability) []*Model {
	result := make([]*Model, 0)
	for _, m := range r.models {
		if m.HasCapability(cap) {
			result = append(result, m)
		}
	}
	return result
}

func (r *ModelRegistry) Search(query string) []*Model {
	query = strings.ToLower(query)
	result := make([]*Model, 0)
	for _, m := range r.models {
		if strings.Contains(strings.ToLower(m.ID), query) ||
			strings.Contains(strings.ToLower(m.Name), query) ||
			strings.Contains(strings.ToLower(m.Description), query) {
			result = append(result, m)
		}
	}
	return result
}

func (r *ModelRegistry) FindBestForTask(task TaskType, preferences ModelPreferences) *Model {
	candidates := r.filterByPreferences(preferences)
	if len(candidates) == 0 {
		return nil
	}

	var best *Model
	var bestScore float64

	for _, m := range candidates {
		score := r.scoreModelForTask(m, task, preferences)
		if score > bestScore {
			bestScore = score
			best = m
		}
	}

	return best
}

type ModelPreferences struct {
	MaxCost           float64
	MinContextWindow  int
	RequiredCaps      []provider.Capability
	PreferredProvider provider.ProviderType
	PreferLocal       bool
	PreferFast        bool
	PreferQuality     bool
}

func (r *ModelRegistry) filterByPreferences(prefs ModelPreferences) []*Model {
	result := make([]*Model, 0)

	for _, m := range r.models {
		if m.Deprecated {
			continue
		}

		if prefs.MaxCost > 0 && !m.Pricing.Free {
			avgCost := (m.Pricing.InputPerMillion + m.Pricing.OutputPerMillion) / 2 / 1000000
			if avgCost > prefs.MaxCost {
				continue
			}
		}

		if prefs.MinContextWindow > 0 && m.ContextWindow < prefs.MinContextWindow {
			continue
		}

		if len(prefs.RequiredCaps) > 0 {
			hasAll := true
			for _, cap := range prefs.RequiredCaps {
				if !m.HasCapability(cap) {
					hasAll = false
					break
				}
			}
			if !hasAll {
				continue
			}
		}

		if prefs.PreferredProvider != "" && m.Provider != prefs.PreferredProvider {
			continue
		}

		if prefs.PreferLocal && !m.IsLocal() {
			continue
		}

		result = append(result, m)
	}

	return result
}

func (r *ModelRegistry) scoreModelForTask(m *Model, task TaskType, prefs ModelPreferences) float64 {
	var score float64

	switch m.Performance.QualityTier {
	case QualityFrontier:
		score += 40
	case QualityHigh:
		score += 30
	case QualityMedium:
		score += 20
	case QualityLow:
		score += 10
	}

	switch m.Performance.SpeedTier {
	case SpeedInstant:
		score += 25
	case SpeedFast:
		score += 20
	case SpeedMedium:
		score += 15
	case SpeedSlow:
		score += 10
	case SpeedVerySlow:
		score += 5
	}

	if m.Pricing.Free {
		score += 20
	} else {
		avgCost := (m.Pricing.InputPerMillion + m.Pricing.OutputPerMillion) / 2
		if avgCost < 1 {
			score += 15
		} else if avgCost < 5 {
			score += 10
		} else if avgCost < 20 {
			score += 5
		}
	}

	switch task {
	case TaskCoding:
		if m.Family == FamilyCodeLlama || strings.Contains(strings.ToLower(m.ID), "coder") {
			score += 20
		}
		if m.HasCapability(provider.CapabilityToolUse) {
			score += 10
		}
	case TaskReasoning:
		if m.Family == FamilyO1 || m.Family == FamilyO3 || strings.Contains(m.ID, "r1") {
			score += 25
		}
	case TaskVision:
		if m.HasCapability(provider.CapabilityVision) {
			score += 30
		}
	case TaskCreative:
		if m.Performance.QualityTier == QualityFrontier {
			score += 15
		}
	}

	if prefs.PreferFast {
		switch m.Performance.SpeedTier {
		case SpeedInstant:
			score += 20
		case SpeedFast:
			score += 15
		}
	}

	if prefs.PreferQuality {
		switch m.Performance.QualityTier {
		case QualityFrontier:
			score += 20
		case QualityHigh:
			score += 15
		}
	}

	if prefs.PreferLocal && m.IsLocal() {
		score += 25
	}

	return score
}

var GlobalModelRegistry = NewModelRegistry()

func GetModel(id string) (*Model, bool) {
	return GlobalModelRegistry.Get(id)
}

func ListModels() []*Model {
	return GlobalModelRegistry.List()
}

func FindBestModel(task TaskType, prefs ModelPreferences) *Model {
	return GlobalModelRegistry.FindBestForTask(task, prefs)
}
