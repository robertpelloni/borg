package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type ToolHandler func(ctx context.Context, args json.RawMessage) (interface{}, error)

type Tool struct {
	Definition ToolDefinition
	Handler    ToolHandler
}

type Registry struct {
	tools map[string]*Tool
	mu    sync.RWMutex
}

func NewRegistry() *Registry {
	return &Registry{
		tools: make(map[string]*Tool),
	}
}

func (r *Registry) Register(t *Tool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.tools[t.Definition.Name]; exists {
		return fmt.Errorf("tool already registered: %s", t.Definition.Name)
	}

	r.tools[t.Definition.Name] = t
	return nil
}

func (r *Registry) GetTool(name string) (*Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, ok := r.tools[name]
	return t, ok
}

func (r *Registry) ListDefinitions() []ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	defs := make([]ToolDefinition, 0, len(r.tools))
	for _, t := range r.tools {
		defs = append(defs, t.Definition)
	}
	return defs
}
