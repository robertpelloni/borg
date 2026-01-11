package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/provider"
)

type ReActState string

const (
	StateIdle      ReActState = "idle"
	StateThinking  ReActState = "thinking"
	StateActing    ReActState = "acting"
	StateObserving ReActState = "observing"
	StateAnswering ReActState = "answering"
	StateError     ReActState = "error"
	StateComplete  ReActState = "complete"
	StateCancelled ReActState = "cancelled"
)

type ReActConfig struct {
	MaxIterations      int
	MaxToolCalls       int
	Timeout            time.Duration
	EnableParallel     bool
	StopOnError        bool
	AutoApprove        bool
	DangerousTools     []string
	MaxTokensPerTurn   int
	IncludeThoughts    bool
	VerboseObservation bool
}

func DefaultReActConfig() ReActConfig {
	return ReActConfig{
		MaxIterations:      20,
		MaxToolCalls:       50,
		Timeout:            10 * time.Minute,
		EnableParallel:     true,
		StopOnError:        false,
		AutoApprove:        true,
		DangerousTools:     []string{"shell", "bash", "exec", "delete", "rm"},
		MaxTokensPerTurn:   8192,
		IncludeThoughts:    true,
		VerboseObservation: false,
	}
}

type ReActLoop struct {
	client       *LLMClient
	registry     *Registry
	prompter     *Prompter
	conversation *Conversation
	config       ReActConfig

	state          ReActState
	currentStep    int
	totalToolCalls int
	mu             sync.RWMutex

	onStateChange    func(state ReActState, step int)
	onThought        func(thought string)
	onAction         func(tool string, args json.RawMessage)
	onObservation    func(tool string, result interface{}, err error)
	onAnswer         func(answer string)
	onStream         func(chunk string)
	onApprovalNeeded func(tool string, args json.RawMessage) bool
}

type ReActResult struct {
	Answer       string
	Thoughts     []string
	Actions      []ActionRecord
	Observations []ObservationRecord
	TotalSteps   int
	TotalTokens  int
	TotalCost    float64
	Duration     time.Duration
	FinalState   ReActState
	Error        error
}

type ActionRecord struct {
	Step      int
	Tool      string
	Arguments json.RawMessage
	Timestamp time.Time
}

type ObservationRecord struct {
	Step      int
	Tool      string
	Result    interface{}
	Error     string
	Duration  time.Duration
	Timestamp time.Time
}

func NewReActLoop(client *LLMClient, registry *Registry, config ReActConfig) *ReActLoop {
	return &ReActLoop{
		client:   client,
		registry: registry,
		config:   config,
		prompter: NewPrompter(DefaultPrompterConfig()),
		state:    StateIdle,
	}
}

func (r *ReActLoop) SetConversation(conv *Conversation) {
	r.conversation = conv
}

func (r *ReActLoop) OnStateChange(fn func(state ReActState, step int)) {
	r.onStateChange = fn
}

func (r *ReActLoop) OnThought(fn func(thought string)) {
	r.onThought = fn
}

func (r *ReActLoop) OnAction(fn func(tool string, args json.RawMessage)) {
	r.onAction = fn
}

func (r *ReActLoop) OnObservation(fn func(tool string, result interface{}, err error)) {
	r.onObservation = fn
}

func (r *ReActLoop) OnAnswer(fn func(answer string)) {
	r.onAnswer = fn
}

func (r *ReActLoop) OnStream(fn func(chunk string)) {
	r.onStream = fn
}

func (r *ReActLoop) OnApprovalNeeded(fn func(tool string, args json.RawMessage) bool) {
	r.onApprovalNeeded = fn
}

func (r *ReActLoop) State() ReActState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.state
}

func (r *ReActLoop) setState(s ReActState) {
	r.mu.Lock()
	r.state = s
	step := r.currentStep
	r.mu.Unlock()

	if r.onStateChange != nil {
		r.onStateChange(s, step)
	}
}

func (r *ReActLoop) Run(ctx context.Context, input string) (*ReActResult, error) {
	ctx, cancel := context.WithTimeout(ctx, r.config.Timeout)
	defer cancel()

	startTime := time.Now()
	result := &ReActResult{
		Thoughts:     make([]string, 0),
		Actions:      make([]ActionRecord, 0),
		Observations: make([]ObservationRecord, 0),
	}

	if r.conversation == nil {
		r.conversation = NewConversation(DefaultConversationConfig())
	}

	toolDefs := r.buildToolDefinitions()
	systemPrompt := r.prompter.BuildSystemPrompt(toolDefs)
	r.conversation.SetSystemPrompt(systemPrompt)
	r.conversation.AddUserMessage(input)

	r.mu.Lock()
	r.currentStep = 0
	r.totalToolCalls = 0
	r.mu.Unlock()

	for {
		select {
		case <-ctx.Done():
			r.setState(StateCancelled)
			result.FinalState = StateCancelled
			result.Error = ctx.Err()
			result.Duration = time.Since(startTime)
			return result, ctx.Err()
		default:
		}

		r.mu.Lock()
		r.currentStep++
		step := r.currentStep
		r.mu.Unlock()

		if step > r.config.MaxIterations {
			r.setState(StateError)
			result.FinalState = StateError
			result.Error = fmt.Errorf("max iterations (%d) exceeded", r.config.MaxIterations)
			result.Duration = time.Since(startTime)
			return result, result.Error
		}

		r.setState(StateThinking)

		chatReq := ChatRequest{
			Messages:    r.conversation.Messages(),
			Tools:       toolDefs,
			MaxTokens:   r.config.MaxTokensPerTurn,
			Temperature: 0.7,
			Stream:      r.onStream != nil,
		}

		var response *ChatResponse
		var err error

		if chatReq.Stream {
			response, err = r.streamingChat(ctx, chatReq, result)
		} else {
			response, err = r.client.Chat(ctx, chatReq)
		}

		if err != nil {
			r.setState(StateError)
			result.FinalState = StateError
			result.Error = err
			result.Duration = time.Since(startTime)
			return result, err
		}

		result.TotalTokens += response.Usage.TotalTokens
		result.TotalCost += response.Usage.Cost

		if thought := extractThought(response.Message.Content); thought != "" {
			result.Thoughts = append(result.Thoughts, thought)
			if r.onThought != nil {
				r.onThought(thought)
			}
		}

		if len(response.ToolCalls) == 0 {
			r.setState(StateAnswering)
			answer := response.Message.Content
			result.Answer = answer
			result.FinalState = StateComplete
			result.TotalSteps = step
			result.Duration = time.Since(startTime)

			r.conversation.AddAssistantMessage(answer, nil)

			if r.onAnswer != nil {
				r.onAnswer(answer)
			}

			r.setState(StateComplete)
			return result, nil
		}

		r.conversation.AddAssistantMessage(response.Message.Content, response.ToolCalls)

		r.setState(StateActing)

		toolResults := r.executeToolCalls(ctx, response.ToolCalls, result)

		r.setState(StateObserving)

		for _, tr := range toolResults {
			r.conversation.AddToolResult(tr.ToolCallID, tr.Name, tr.Content, tr.Error != "")
		}
	}
}

func (r *ReActLoop) streamingChat(ctx context.Context, req ChatRequest, result *ReActResult) (*ChatResponse, error) {
	events, err := r.client.ChatStream(ctx, req)
	if err != nil {
		return nil, err
	}

	var content strings.Builder
	var toolCalls []provider.ToolCall
	toolCallMap := make(map[int]*provider.ToolCall)
	var usage provider.Usage
	var finishReason string

	for event := range events {
		switch event.Type {
		case StreamEventContent:
			content.WriteString(event.Content)
			if r.onStream != nil {
				r.onStream(event.Content)
			}
		case StreamEventToolCall:
			if event.ToolCallDelta != nil {
				idx := event.ToolCallDelta.Index
				if _, exists := toolCallMap[idx]; !exists {
					toolCallMap[idx] = &provider.ToolCall{
						ID:   event.ToolCallDelta.ID,
						Type: "function",
						Function: provider.FunctionCall{
							Name: event.ToolCallDelta.Name,
						},
					}
				}
				toolCallMap[idx].Function.Arguments += event.ToolCallDelta.Arguments
			}
		case StreamEventUsage:
			if event.Usage != nil {
				usage = *event.Usage
			}
		case StreamEventDone:
			finishReason = event.FinishReason
			if event.Usage != nil {
				usage = *event.Usage
			}
		case StreamEventError:
			return nil, event.Error
		}
	}

	for i := 0; i < len(toolCallMap); i++ {
		if tc, ok := toolCallMap[i]; ok {
			toolCalls = append(toolCalls, *tc)
		}
	}

	return &ChatResponse{
		Message: provider.Message{
			Role:      provider.RoleAssistant,
			Content:   content.String(),
			ToolCalls: toolCalls,
		},
		ToolCalls:    toolCalls,
		FinishReason: finishReason,
		Usage:        usage,
	}, nil
}

func (r *ReActLoop) executeToolCalls(ctx context.Context, toolCalls []provider.ToolCall, result *ReActResult) []ToolResult {
	results := make([]ToolResult, 0, len(toolCalls))

	if r.config.EnableParallel && len(toolCalls) > 1 {
		resultChan := make(chan ToolResult, len(toolCalls))
		var wg sync.WaitGroup

		for _, tc := range toolCalls {
			r.mu.Lock()
			r.totalToolCalls++
			if r.totalToolCalls > r.config.MaxToolCalls {
				r.mu.Unlock()
				results = append(results, ToolResult{
					ToolCallID: tc.ID,
					Name:       tc.Function.Name,
					Error:      "max tool calls exceeded",
				})
				continue
			}
			r.mu.Unlock()

			wg.Add(1)
			go func(call provider.ToolCall) {
				defer wg.Done()
				tr := r.executeSingleTool(ctx, call, result)
				resultChan <- tr
			}(tc)
		}

		go func() {
			wg.Wait()
			close(resultChan)
		}()

		for tr := range resultChan {
			results = append(results, tr)
		}
	} else {
		for _, tc := range toolCalls {
			r.mu.Lock()
			r.totalToolCalls++
			if r.totalToolCalls > r.config.MaxToolCalls {
				r.mu.Unlock()
				results = append(results, ToolResult{
					ToolCallID: tc.ID,
					Name:       tc.Function.Name,
					Error:      "max tool calls exceeded",
				})
				continue
			}
			r.mu.Unlock()

			tr := r.executeSingleTool(ctx, tc, result)
			results = append(results, tr)
		}
	}

	return results
}

func (r *ReActLoop) executeSingleTool(ctx context.Context, tc provider.ToolCall, result *ReActResult) ToolResult {
	startTime := time.Now()
	toolName := tc.Function.Name
	args := json.RawMessage(tc.Function.Arguments)

	if r.onAction != nil {
		r.onAction(toolName, args)
	}

	result.Actions = append(result.Actions, ActionRecord{
		Step:      r.currentStep,
		Tool:      toolName,
		Arguments: args,
		Timestamp: startTime,
	})

	if r.requiresApproval(toolName) && r.onApprovalNeeded != nil {
		if !r.onApprovalNeeded(toolName, args) {
			tr := ToolResult{
				ToolCallID: tc.ID,
				Name:       toolName,
				Error:      "tool execution denied by user",
			}
			r.recordObservation(result, toolName, nil, tr.Error, time.Since(startTime))
			return tr
		}
	}

	tool, ok := r.registry.GetTool(toolName)
	if !ok {
		tr := ToolResult{
			ToolCallID: tc.ID,
			Name:       toolName,
			Error:      fmt.Sprintf("unknown tool: %s", toolName),
		}
		r.recordObservation(result, toolName, nil, tr.Error, time.Since(startTime))
		return tr
	}

	output, err := tool.Handler(ctx, args)
	duration := time.Since(startTime)

	tr := ToolResult{
		ToolCallID: tc.ID,
		Name:       toolName,
	}

	if err != nil {
		tr.Error = err.Error()
		r.recordObservation(result, toolName, nil, tr.Error, duration)
		if r.onObservation != nil {
			r.onObservation(toolName, nil, err)
		}
	} else {
		tr.Content = r.formatToolOutput(output)
		r.recordObservation(result, toolName, output, "", duration)
		if r.onObservation != nil {
			r.onObservation(toolName, output, nil)
		}
	}

	return tr
}

func (r *ReActLoop) recordObservation(result *ReActResult, tool string, output interface{}, errStr string, duration time.Duration) {
	result.Observations = append(result.Observations, ObservationRecord{
		Step:      r.currentStep,
		Tool:      tool,
		Result:    output,
		Error:     errStr,
		Duration:  duration,
		Timestamp: time.Now(),
	})
}

func (r *ReActLoop) formatToolOutput(output interface{}) interface{} {
	if !r.config.VerboseObservation {
		if s, ok := output.(string); ok && len(s) > 4000 {
			return s[:4000] + "\n... (truncated)"
		}
	}
	return output
}

func (r *ReActLoop) requiresApproval(toolName string) bool {
	if r.config.AutoApprove {
		return false
	}
	for _, dangerous := range r.config.DangerousTools {
		if strings.EqualFold(toolName, dangerous) {
			return true
		}
	}
	return false
}

func (r *ReActLoop) buildToolDefinitions() []provider.ToolDefinition {
	registryDefs := r.registry.ListDefinitions()
	providerDefs := make([]provider.ToolDefinition, 0, len(registryDefs))

	for _, def := range registryDefs {
		providerDefs = append(providerDefs, provider.ToolDefinition{
			Name:        def.Name,
			Description: def.Description,
			Parameters:  def.InputSchema,
		})
	}

	return providerDefs
}

func extractThought(content string) string {
	markers := []struct {
		start, end string
	}{
		{"<thinking>", "</thinking>"},
		{"<thought>", "</thought>"},
		{"[Thought]", "[/Thought]"},
		{"**Thinking:**", "\n\n"},
	}

	for _, m := range markers {
		if start := strings.Index(content, m.start); start != -1 {
			start += len(m.start)
			if end := strings.Index(content[start:], m.end); end != -1 {
				return strings.TrimSpace(content[start : start+end])
			}
		}
	}

	return ""
}

func (r *ReActLoop) Cancel() {
	r.setState(StateCancelled)
}

func (r *ReActLoop) Reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.state = StateIdle
	r.currentStep = 0
	r.totalToolCalls = 0
	r.conversation = nil
}

type StreamingReActLoop struct {
	*ReActLoop
	outputChan chan ReActEvent
}

type ReActEventType string

const (
	EventThought     ReActEventType = "thought"
	EventAction      ReActEventType = "action"
	EventObservation ReActEventType = "observation"
	EventAnswer      ReActEventType = "answer"
	EventStream      ReActEventType = "stream"
	EventState       ReActEventType = "state"
	EventError       ReActEventType = "error"
	EventDone        ReActEventType = "done"
)

type ReActEvent struct {
	Type        ReActEventType
	Step        int
	State       ReActState
	Thought     string
	Tool        string
	Arguments   json.RawMessage
	Observation interface{}
	Answer      string
	Content     string
	Error       error
	Timestamp   time.Time
}

func NewStreamingReActLoop(client *LLMClient, registry *Registry, config ReActConfig) *StreamingReActLoop {
	s := &StreamingReActLoop{
		ReActLoop:  NewReActLoop(client, registry, config),
		outputChan: make(chan ReActEvent, 100),
	}

	s.OnStateChange(func(state ReActState, step int) {
		s.outputChan <- ReActEvent{
			Type:      EventState,
			Step:      step,
			State:     state,
			Timestamp: time.Now(),
		}
	})

	s.OnThought(func(thought string) {
		s.outputChan <- ReActEvent{
			Type:      EventThought,
			Step:      s.currentStep,
			Thought:   thought,
			Timestamp: time.Now(),
		}
	})

	s.OnAction(func(tool string, args json.RawMessage) {
		s.outputChan <- ReActEvent{
			Type:      EventAction,
			Step:      s.currentStep,
			Tool:      tool,
			Arguments: args,
			Timestamp: time.Now(),
		}
	})

	s.OnObservation(func(tool string, result interface{}, err error) {
		s.outputChan <- ReActEvent{
			Type:        EventObservation,
			Step:        s.currentStep,
			Tool:        tool,
			Observation: result,
			Error:       err,
			Timestamp:   time.Now(),
		}
	})

	s.OnAnswer(func(answer string) {
		s.outputChan <- ReActEvent{
			Type:      EventAnswer,
			Step:      s.currentStep,
			Answer:    answer,
			Timestamp: time.Now(),
		}
	})

	s.OnStream(func(chunk string) {
		s.outputChan <- ReActEvent{
			Type:      EventStream,
			Step:      s.currentStep,
			Content:   chunk,
			Timestamp: time.Now(),
		}
	})

	return s
}

func (s *StreamingReActLoop) RunStreaming(ctx context.Context, input string) <-chan ReActEvent {
	go func() {
		defer close(s.outputChan)
		result, err := s.Run(ctx, input)
		if err != nil {
			s.outputChan <- ReActEvent{
				Type:      EventError,
				Error:     err,
				Timestamp: time.Now(),
			}
		}
		s.outputChan <- ReActEvent{
			Type:      EventDone,
			State:     result.FinalState,
			Timestamp: time.Now(),
		}
	}()

	return s.outputChan
}
