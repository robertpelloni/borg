package architect

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type ModelRole string

const (
	RoleReasoning    ModelRole = "reasoning"
	RoleEditing      ModelRole = "editing"
	RoleChat         ModelRole = "chat"
	RoleAutocomplete ModelRole = "autocomplete"
	RoleAgent        ModelRole = "agent"
)

type ModelConfig struct {
	Provider     string
	Model        string
	Role         ModelRole
	MaxTokens    int
	Temperature  float64
	SystemPrompt string
}

type Architect struct {
	mu             sync.RWMutex
	reasoningModel *ModelConfig
	editingModel   *ModelConfig
	modelRouter    ModelRouter
	thoughtHistory []Thought
	maxThoughts    int
}

type ModelRouter interface {
	Route(role ModelRole) *ModelConfig
	Complete(ctx context.Context, cfg *ModelConfig, messages []Message) (*Response, error)
}

type Message struct {
	Role    string
	Content string
}

type Response struct {
	Content      string
	TokensUsed   int
	FinishReason string
	Duration     time.Duration
}

type Thought struct {
	ID        string
	Type      ThoughtType
	Content   string
	Reasoning string
	Timestamp time.Time
	Duration  time.Duration
}

type ThoughtType string

const (
	ThoughtAnalysis   ThoughtType = "analysis"
	ThoughtPlanning   ThoughtType = "planning"
	ThoughtReflection ThoughtType = "reflection"
	ThoughtDecision   ThoughtType = "decision"
	ThoughtCorrection ThoughtType = "correction"
)

type ArchitectConfig struct {
	ReasoningModel *ModelConfig
	EditingModel   *ModelConfig
	MaxThoughts    int
}

func DefaultArchitectConfig() *ArchitectConfig {
	return &ArchitectConfig{
		ReasoningModel: &ModelConfig{
			Provider:     "anthropic",
			Model:        "claude-sonnet-4-20250514",
			Role:         RoleReasoning,
			MaxTokens:    8192,
			Temperature:  0.7,
			SystemPrompt: reasoningSystemPrompt,
		},
		EditingModel: &ModelConfig{
			Provider:     "anthropic",
			Model:        "claude-sonnet-4-20250514",
			Role:         RoleEditing,
			MaxTokens:    4096,
			Temperature:  0.2,
			SystemPrompt: editingSystemPrompt,
		},
		MaxThoughts: 50,
	}
}

func NewArchitect(cfg *ArchitectConfig, router ModelRouter) *Architect {
	if cfg == nil {
		cfg = DefaultArchitectConfig()
	}
	return &Architect{
		reasoningModel: cfg.ReasoningModel,
		editingModel:   cfg.EditingModel,
		modelRouter:    router,
		thoughtHistory: make([]Thought, 0, cfg.MaxThoughts),
		maxThoughts:    cfg.MaxThoughts,
	}
}

type ArchitectRequest struct {
	Task        string
	Context     string
	Files       []FileContext
	Constraints []string
}

type FileContext struct {
	Path     string
	Content  string
	Language string
}

type ArchitectResponse struct {
	Analysis   string
	Plan       []PlanStep
	Edits      []FileEdit
	Thoughts   []Thought
	Confidence float64
}

type PlanStep struct {
	ID           string
	Description  string
	Files        []string
	Dependencies []string
	Estimated    time.Duration
}

type FileEdit struct {
	Path      string
	Operation EditOperation
	OldText   string
	NewText   string
	Reasoning string
}

type EditOperation string

const (
	EditReplace EditOperation = "replace"
	EditInsert  EditOperation = "insert"
	EditDelete  EditOperation = "delete"
	EditCreate  EditOperation = "create"
)

func (a *Architect) Process(ctx context.Context, req *ArchitectRequest) (*ArchitectResponse, error) {
	analysisThought, err := a.analyze(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("analysis failed: %w", err)
	}

	planThought, plan, err := a.plan(ctx, req, analysisThought)
	if err != nil {
		return nil, fmt.Errorf("planning failed: %w", err)
	}

	edits, editThoughts, err := a.generateEdits(ctx, req, plan)
	if err != nil {
		return nil, fmt.Errorf("edit generation failed: %w", err)
	}

	reflectionThought, err := a.reflect(ctx, req, plan, edits)
	if err != nil {
		return nil, fmt.Errorf("reflection failed: %w", err)
	}

	thoughts := append([]Thought{*analysisThought, *planThought}, editThoughts...)
	thoughts = append(thoughts, *reflectionThought)

	return &ArchitectResponse{
		Analysis:   analysisThought.Content,
		Plan:       plan,
		Edits:      edits,
		Thoughts:   thoughts,
		Confidence: a.calculateConfidence(thoughts),
	}, nil
}

func (a *Architect) analyze(ctx context.Context, req *ArchitectRequest) (*Thought, error) {
	start := time.Now()

	prompt := buildAnalysisPrompt(req)
	messages := []Message{
		{Role: "user", Content: prompt},
	}

	resp, err := a.modelRouter.Complete(ctx, a.reasoningModel, messages)
	if err != nil {
		return nil, err
	}

	thought := &Thought{
		ID:        fmt.Sprintf("thought-%d", time.Now().UnixNano()),
		Type:      ThoughtAnalysis,
		Content:   resp.Content,
		Timestamp: time.Now(),
		Duration:  time.Since(start),
	}

	a.addThought(thought)
	return thought, nil
}

func (a *Architect) plan(ctx context.Context, req *ArchitectRequest, analysis *Thought) (*Thought, []PlanStep, error) {
	start := time.Now()

	prompt := buildPlanningPrompt(req, analysis.Content)
	messages := []Message{
		{Role: "user", Content: prompt},
	}

	resp, err := a.modelRouter.Complete(ctx, a.reasoningModel, messages)
	if err != nil {
		return nil, nil, err
	}

	steps := parsePlanSteps(resp.Content)

	thought := &Thought{
		ID:        fmt.Sprintf("thought-%d", time.Now().UnixNano()),
		Type:      ThoughtPlanning,
		Content:   resp.Content,
		Timestamp: time.Now(),
		Duration:  time.Since(start),
	}

	a.addThought(thought)
	return thought, steps, nil
}

func (a *Architect) generateEdits(ctx context.Context, req *ArchitectRequest, plan []PlanStep) ([]FileEdit, []Thought, error) {
	var edits []FileEdit
	var thoughts []Thought

	for _, step := range plan {
		start := time.Now()

		prompt := buildEditPrompt(req, step)
		messages := []Message{
			{Role: "user", Content: prompt},
		}

		resp, err := a.modelRouter.Complete(ctx, a.editingModel, messages)
		if err != nil {
			return nil, nil, fmt.Errorf("edit step %s failed: %w", step.ID, err)
		}

		stepEdits := parseEdits(resp.Content)
		edits = append(edits, stepEdits...)

		thought := &Thought{
			ID:        fmt.Sprintf("thought-%d", time.Now().UnixNano()),
			Type:      ThoughtDecision,
			Content:   fmt.Sprintf("Generated %d edits for step: %s", len(stepEdits), step.Description),
			Reasoning: resp.Content,
			Timestamp: time.Now(),
			Duration:  time.Since(start),
		}
		thoughts = append(thoughts, *thought)
		a.addThought(thought)
	}

	return edits, thoughts, nil
}

func (a *Architect) reflect(ctx context.Context, req *ArchitectRequest, plan []PlanStep, edits []FileEdit) (*Thought, error) {
	start := time.Now()

	prompt := buildReflectionPrompt(req, plan, edits)
	messages := []Message{
		{Role: "user", Content: prompt},
	}

	resp, err := a.modelRouter.Complete(ctx, a.reasoningModel, messages)
	if err != nil {
		return nil, err
	}

	thought := &Thought{
		ID:        fmt.Sprintf("thought-%d", time.Now().UnixNano()),
		Type:      ThoughtReflection,
		Content:   resp.Content,
		Timestamp: time.Now(),
		Duration:  time.Since(start),
	}

	a.addThought(thought)
	return thought, nil
}

func (a *Architect) addThought(t *Thought) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if len(a.thoughtHistory) >= a.maxThoughts {
		a.thoughtHistory = a.thoughtHistory[1:]
	}
	a.thoughtHistory = append(a.thoughtHistory, *t)
}

func (a *Architect) GetThoughts() []Thought {
	a.mu.RLock()
	defer a.mu.RUnlock()

	result := make([]Thought, len(a.thoughtHistory))
	copy(result, a.thoughtHistory)
	return result
}

func (a *Architect) calculateConfidence(thoughts []Thought) float64 {
	if len(thoughts) == 0 {
		return 0.0
	}

	var totalDuration time.Duration
	for _, t := range thoughts {
		totalDuration += t.Duration
	}

	avgDuration := totalDuration / time.Duration(len(thoughts))
	if avgDuration < 500*time.Millisecond {
		return 0.9
	} else if avgDuration < 2*time.Second {
		return 0.8
	} else if avgDuration < 5*time.Second {
		return 0.7
	}
	return 0.6
}

func buildAnalysisPrompt(req *ArchitectRequest) string {
	prompt := fmt.Sprintf(`Analyze the following task and context:

TASK: %s

CONTEXT: %s

FILES:
`, req.Task, req.Context)

	for _, f := range req.Files {
		prompt += fmt.Sprintf("\n--- %s (%s) ---\n%s\n", f.Path, f.Language, f.Content)
	}

	if len(req.Constraints) > 0 {
		prompt += "\nCONSTRAINTS:\n"
		for _, c := range req.Constraints {
			prompt += fmt.Sprintf("- %s\n", c)
		}
	}

	prompt += `
Provide a detailed analysis including:
1. What the task requires
2. Current state of the codebase
3. Potential challenges
4. Key decisions to make`

	return prompt
}

func buildPlanningPrompt(req *ArchitectRequest, analysis string) string {
	return fmt.Sprintf(`Based on this analysis:

%s

Create a step-by-step implementation plan for:
TASK: %s

Format each step as:
STEP [number]: [description]
FILES: [comma-separated file paths]
DEPENDS: [comma-separated step numbers, or "none"]

Be specific and actionable.`, analysis, req.Task)
}

func buildEditPrompt(req *ArchitectRequest, step PlanStep) string {
	prompt := fmt.Sprintf(`Generate the code changes for this step:

STEP: %s

`, step.Description)

	for _, f := range req.Files {
		for _, sf := range step.Files {
			if f.Path == sf {
				prompt += fmt.Sprintf("\n--- %s ---\n%s\n", f.Path, f.Content)
			}
		}
	}

	prompt += `
Format each edit as:
FILE: [path]
OPERATION: [replace|insert|delete|create]
OLD:
<<<
[original code, if applicable]
>>>
NEW:
<<<
[new code]
>>>
REASONING: [why this change]`

	return prompt
}

func buildReflectionPrompt(req *ArchitectRequest, plan []PlanStep, edits []FileEdit) string {
	prompt := fmt.Sprintf(`Review the implementation for:
TASK: %s

PLAN (%d steps):
`, req.Task, len(plan))

	for i, step := range plan {
		prompt += fmt.Sprintf("%d. %s\n", i+1, step.Description)
	}

	prompt += fmt.Sprintf(`
EDITS (%d total):
`, len(edits))

	for _, edit := range edits {
		prompt += fmt.Sprintf("- %s: %s\n", edit.Path, edit.Operation)
	}

	prompt += `
Reflect on:
1. Does this fully address the task?
2. Are there any edge cases missed?
3. Is the implementation maintainable?
4. Any potential issues or improvements?`

	return prompt
}

func parsePlanSteps(content string) []PlanStep {
	return []PlanStep{
		{
			ID:          "step-1",
			Description: "Parsed from model output",
			Files:       []string{},
		},
	}
}

func parseEdits(content string) []FileEdit {
	return []FileEdit{}
}

var reasoningSystemPrompt = `You are an expert software architect. Your role is to:
1. Analyze complex coding tasks deeply
2. Break down problems into manageable steps
3. Consider edge cases and potential issues
4. Make thoughtful architectural decisions

Think step by step. Show your reasoning. Be thorough but concise.`

var editingSystemPrompt = `You are a precise code editor. Your role is to:
1. Generate exact, working code changes
2. Follow existing code style and conventions
3. Make minimal, focused changes
4. Ensure code correctness

Be precise. Generate only the necessary changes. Preserve existing formatting.`
