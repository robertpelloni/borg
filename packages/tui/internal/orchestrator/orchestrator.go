package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
)

type Orchestrator struct {
	registry *Registry
}

func NewOrchestrator(r *Registry) *Orchestrator {
	return &Orchestrator{
		registry: r,
	}
}

type ToolCall struct {
	ToolName string          `json:"tool"`
	Args     json.RawMessage `json:"args"`
}

type OrchestrationResult struct {
	ToolResults map[string]interface{}
	FinalAnswer string
	Error       error
}

func (o *Orchestrator) ExecuteTool(ctx context.Context, call ToolCall) (interface{}, error) {
	tool, ok := o.registry.GetTool(call.ToolName)
	if !ok {
		return nil, fmt.Errorf("tool not found: %s", call.ToolName)
	}

	return tool.Handler(ctx, call.Args)
}

func (o *Orchestrator) RunLoop(ctx context.Context, input string) (*OrchestrationResult, error) {
	result := &OrchestrationResult{
		ToolResults: make(map[string]interface{}),
	}

	result.FinalAnswer = fmt.Sprintf("Processed input: %s (No LLM connected yet)", input)

	return result, nil
}
