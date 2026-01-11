package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type LoopState string

const (
	StateIdle      LoopState = "idle"
	StatePlanning  LoopState = "planning"
	StateActing    LoopState = "acting"
	StateVerifying LoopState = "verifying"
	StateWaiting   LoopState = "waiting"
	StateCompleted LoopState = "completed"
	StateFailed    LoopState = "failed"
	StateCancelled LoopState = "cancelled"
)

type ApprovalMode string

const (
	ApprovalConservative ApprovalMode = "conservative"
	ApprovalBalanced     ApprovalMode = "balanced"
	ApprovalYOLO         ApprovalMode = "yolo"
)

type StepType string

const (
	StepTypeRead    StepType = "read"
	StepTypeWrite   StepType = "write"
	StepTypeExecute StepType = "execute"
	StepTypeVerify  StepType = "verify"
)

type Step struct {
	ID          string                 `json:"id"`
	Type        StepType               `json:"type"`
	Description string                 `json:"description"`
	Tool        string                 `json:"tool"`
	Args        map[string]interface{} `json:"args"`
	DependsOn   []string               `json:"depends_on,omitempty"`
	Status      StepStatus             `json:"status"`
	Result      *StepResult            `json:"result,omitempty"`
	StartedAt   *time.Time             `json:"started_at,omitempty"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
}

type StepStatus string

const (
	StepPending   StepStatus = "pending"
	StepRunning   StepStatus = "running"
	StepCompleted StepStatus = "completed"
	StepFailed    StepStatus = "failed"
	StepSkipped   StepStatus = "skipped"
)

type StepResult struct {
	Success bool        `json:"success"`
	Output  interface{} `json:"output,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type Plan struct {
	ID         string    `json:"id"`
	Goal       string    `json:"goal"`
	Steps      []*Step   `json:"steps"`
	CreatedAt  time.Time `json:"created_at"`
	Iteration  int       `json:"iteration"`
	MaxRetries int       `json:"max_retries"`
}

type ToolExecutor interface {
	Execute(ctx context.Context, tool string, args map[string]interface{}) (interface{}, error)
}

type Planner interface {
	CreatePlan(ctx context.Context, goal string, context string) (*Plan, error)
	RevisePlan(ctx context.Context, plan *Plan, failedStep *Step, error string) (*Plan, error)
}

type ApprovalRequest struct {
	Step        *Step
	Description string
	Risk        string
	ResponseCh  chan bool
}

type LoopConfig struct {
	ApprovalMode    ApprovalMode
	MaxIterations   int
	MaxRetries      int
	StepTimeout     time.Duration
	TotalTimeout    time.Duration
	AutoApprove     []string
	CheckpointEvery int
}

func DefaultLoopConfig() *LoopConfig {
	return &LoopConfig{
		ApprovalMode:    ApprovalBalanced,
		MaxIterations:   10,
		MaxRetries:      3,
		StepTimeout:     5 * time.Minute,
		TotalTimeout:    30 * time.Minute,
		AutoApprove:     []string{"read_file", "list_files", "search"},
		CheckpointEvery: 5,
	}
}

type Loop struct {
	config       *LoopConfig
	executor     ToolExecutor
	planner      Planner
	state        LoopState
	currentPlan  *Plan
	currentStep  int
	iteration    int
	mu           sync.RWMutex
	approvalChan chan *ApprovalRequest
	eventChan    chan *LoopEvent
	cancelFunc   context.CancelFunc
}

type LoopEventType string

const (
	EventStateChange   LoopEventType = "state_change"
	EventPlanCreated   LoopEventType = "plan_created"
	EventStepStarted   LoopEventType = "step_started"
	EventStepCompleted LoopEventType = "step_completed"
	EventStepFailed    LoopEventType = "step_failed"
	EventApprovalReq   LoopEventType = "approval_required"
	EventCompleted     LoopEventType = "completed"
	EventFailed        LoopEventType = "failed"
	EventLog           LoopEventType = "log"
)

type LoopEvent struct {
	Type      LoopEventType `json:"type"`
	Timestamp time.Time     `json:"timestamp"`
	State     LoopState     `json:"state,omitempty"`
	Step      *Step         `json:"step,omitempty"`
	Plan      *Plan         `json:"plan,omitempty"`
	Message   string        `json:"message,omitempty"`
	Error     string        `json:"error,omitempty"`
}

func NewLoop(config *LoopConfig, executor ToolExecutor, planner Planner) *Loop {
	if config == nil {
		config = DefaultLoopConfig()
	}
	return &Loop{
		config:       config,
		executor:     executor,
		planner:      planner,
		state:        StateIdle,
		approvalChan: make(chan *ApprovalRequest, 10),
		eventChan:    make(chan *LoopEvent, 100),
	}
}

func (l *Loop) State() LoopState {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.state
}

func (l *Loop) CurrentPlan() *Plan {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.currentPlan
}

func (l *Loop) Events() <-chan *LoopEvent {
	return l.eventChan
}

func (l *Loop) ApprovalRequests() <-chan *ApprovalRequest {
	return l.approvalChan
}

func (l *Loop) setState(state LoopState) {
	l.mu.Lock()
	l.state = state
	l.mu.Unlock()
	l.emit(&LoopEvent{Type: EventStateChange, State: state})
}

func (l *Loop) emit(event *LoopEvent) {
	event.Timestamp = time.Now()
	select {
	case l.eventChan <- event:
	default:
	}
}

func (l *Loop) Run(ctx context.Context, goal string, initialContext string) error {
	ctx, cancel := context.WithTimeout(ctx, l.config.TotalTimeout)
	l.cancelFunc = cancel
	defer cancel()

	l.iteration = 0
	l.currentStep = 0

	for l.iteration < l.config.MaxIterations {
		l.iteration++

		l.setState(StatePlanning)
		plan, err := l.plan(ctx, goal, initialContext)
		if err != nil {
			l.setState(StateFailed)
			l.emit(&LoopEvent{Type: EventFailed, Error: fmt.Sprintf("planning failed: %v", err)})
			return fmt.Errorf("planning failed: %w", err)
		}
		l.mu.Lock()
		l.currentPlan = plan
		l.mu.Unlock()
		l.emit(&LoopEvent{Type: EventPlanCreated, Plan: plan})

		l.setState(StateActing)
		failedStep, err := l.execute(ctx, plan)
		if err != nil {
			if ctx.Err() != nil {
				l.setState(StateCancelled)
				return ctx.Err()
			}

			if failedStep != nil && l.iteration < l.config.MaxIterations {
				l.emit(&LoopEvent{
					Type:    EventLog,
					Message: fmt.Sprintf("Step failed, re-planning (iteration %d/%d)", l.iteration, l.config.MaxIterations),
				})
				initialContext = l.buildReplanContext(plan, failedStep, err.Error())
				continue
			}

			l.setState(StateFailed)
			l.emit(&LoopEvent{Type: EventFailed, Error: err.Error()})
			return err
		}

		l.setState(StateVerifying)
		if err := l.verify(ctx, plan); err != nil {
			if l.iteration < l.config.MaxIterations {
				l.emit(&LoopEvent{
					Type:    EventLog,
					Message: fmt.Sprintf("Verification failed, re-planning (iteration %d/%d)", l.iteration, l.config.MaxIterations),
				})
				initialContext = l.buildVerifyFailContext(plan, err.Error())
				continue
			}
			l.setState(StateFailed)
			return fmt.Errorf("verification failed: %w", err)
		}

		l.setState(StateCompleted)
		l.emit(&LoopEvent{Type: EventCompleted, Plan: plan})
		return nil
	}

	l.setState(StateFailed)
	return fmt.Errorf("max iterations (%d) exceeded", l.config.MaxIterations)
}

func (l *Loop) Cancel() {
	if l.cancelFunc != nil {
		l.cancelFunc()
	}
	l.setState(StateCancelled)
}

func (l *Loop) plan(ctx context.Context, goal string, context string) (*Plan, error) {
	if l.planner == nil {
		return l.createDefaultPlan(goal), nil
	}
	return l.planner.CreatePlan(ctx, goal, context)
}

func (l *Loop) createDefaultPlan(goal string) *Plan {
	return &Plan{
		ID:         fmt.Sprintf("plan_%d", time.Now().UnixNano()),
		Goal:       goal,
		Steps:      []*Step{},
		CreatedAt:  time.Now(),
		Iteration:  l.iteration,
		MaxRetries: l.config.MaxRetries,
	}
}

func (l *Loop) execute(ctx context.Context, plan *Plan) (*Step, error) {
	for i, step := range plan.Steps {
		l.mu.Lock()
		l.currentStep = i
		l.mu.Unlock()

		if !l.dependenciesMet(plan, step) {
			step.Status = StepSkipped
			continue
		}

		if !l.shouldAutoApprove(step) {
			approved, err := l.requestApproval(ctx, step)
			if err != nil {
				return step, err
			}
			if !approved {
				step.Status = StepSkipped
				l.emit(&LoopEvent{Type: EventLog, Message: fmt.Sprintf("Step %s skipped by user", step.ID)})
				continue
			}
		}

		step.Status = StepRunning
		now := time.Now()
		step.StartedAt = &now
		l.emit(&LoopEvent{Type: EventStepStarted, Step: step})

		stepCtx, cancel := context.WithTimeout(ctx, l.config.StepTimeout)
		result, err := l.executeStep(stepCtx, step)
		cancel()

		completedAt := time.Now()
		step.CompletedAt = &completedAt
		step.Result = result

		if err != nil {
			step.Status = StepFailed
			step.Result = &StepResult{Success: false, Error: err.Error()}
			l.emit(&LoopEvent{Type: EventStepFailed, Step: step, Error: err.Error()})
			return step, err
		}

		step.Status = StepCompleted
		l.emit(&LoopEvent{Type: EventStepCompleted, Step: step})

		if l.config.CheckpointEvery > 0 && (i+1)%l.config.CheckpointEvery == 0 {
			l.emit(&LoopEvent{Type: EventLog, Message: fmt.Sprintf("Checkpoint: %d/%d steps completed", i+1, len(plan.Steps))})
		}
	}
	return nil, nil
}

func (l *Loop) executeStep(ctx context.Context, step *Step) (*StepResult, error) {
	if l.executor == nil {
		return &StepResult{Success: true, Output: "no executor configured"}, nil
	}

	output, err := l.executor.Execute(ctx, step.Tool, step.Args)
	if err != nil {
		return &StepResult{Success: false, Error: err.Error()}, err
	}
	return &StepResult{Success: true, Output: output}, nil
}

func (l *Loop) dependenciesMet(plan *Plan, step *Step) bool {
	if len(step.DependsOn) == 0 {
		return true
	}

	stepMap := make(map[string]*Step)
	for _, s := range plan.Steps {
		stepMap[s.ID] = s
	}

	for _, depID := range step.DependsOn {
		dep, exists := stepMap[depID]
		if !exists {
			return false
		}
		if dep.Status != StepCompleted {
			return false
		}
	}
	return true
}

func (l *Loop) shouldAutoApprove(step *Step) bool {
	if l.config.ApprovalMode == ApprovalYOLO {
		return true
	}

	if l.config.ApprovalMode == ApprovalConservative {
		return false
	}

	for _, pattern := range l.config.AutoApprove {
		if matchesPattern(step.Tool, pattern) {
			return true
		}
	}

	return step.Type == StepTypeRead || step.Type == StepTypeVerify
}

func matchesPattern(tool, pattern string) bool {
	if pattern == "*" {
		return true
	}
	return tool == pattern
}

func (l *Loop) requestApproval(ctx context.Context, step *Step) (bool, error) {
	req := &ApprovalRequest{
		Step:        step,
		Description: fmt.Sprintf("Execute %s: %s", step.Tool, step.Description),
		Risk:        l.assessRisk(step),
		ResponseCh:  make(chan bool, 1),
	}

	l.emit(&LoopEvent{Type: EventApprovalReq, Step: step})

	select {
	case l.approvalChan <- req:
	case <-ctx.Done():
		return false, ctx.Err()
	}

	select {
	case approved := <-req.ResponseCh:
		return approved, nil
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

func (l *Loop) assessRisk(step *Step) string {
	switch step.Type {
	case StepTypeWrite:
		return "medium"
	case StepTypeExecute:
		return "high"
	default:
		return "low"
	}
}

func (l *Loop) verify(ctx context.Context, plan *Plan) error {
	completedCount := 0
	for _, step := range plan.Steps {
		if step.Status == StepCompleted {
			completedCount++
		}
	}

	if completedCount == 0 && len(plan.Steps) > 0 {
		return fmt.Errorf("no steps completed successfully")
	}

	return nil
}

func (l *Loop) buildReplanContext(plan *Plan, failedStep *Step, errMsg string) string {
	ctx := fmt.Sprintf("Previous plan failed at step '%s' (%s).\nError: %s\n\nCompleted steps:\n",
		failedStep.ID, failedStep.Description, errMsg)

	for _, step := range plan.Steps {
		if step.Status == StepCompleted {
			ctx += fmt.Sprintf("- %s: %s (success)\n", step.ID, step.Description)
		}
	}

	return ctx
}

func (l *Loop) buildVerifyFailContext(plan *Plan, errMsg string) string {
	return fmt.Sprintf("Plan executed but verification failed: %s\n\nPlease revise the approach.", errMsg)
}

func (l *Loop) Progress() (current, total int, state LoopState) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if l.currentPlan == nil {
		return 0, 0, l.state
	}
	return l.currentStep, len(l.currentPlan.Steps), l.state
}

func (l *Loop) ExportPlan() ([]byte, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if l.currentPlan == nil {
		return nil, fmt.Errorf("no plan available")
	}
	return json.MarshalIndent(l.currentPlan, "", "  ")
}
