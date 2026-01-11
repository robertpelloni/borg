package plugin

import (
	"context"
	"encoding/json"
)

type PluginType string

const (
	PluginTypeAgent     PluginType = "agent"
	PluginTypeTool      PluginType = "tool"
	PluginTypeTheme     PluginType = "theme"
	PluginTypeProvider  PluginType = "provider"
	PluginTypeStorage   PluginType = "storage"
	PluginTypeTransport PluginType = "transport"
)

type PluginInfo struct {
	Name        string     `json:"name"`
	Version     string     `json:"version"`
	Description string     `json:"description"`
	Author      string     `json:"author"`
	Type        PluginType `json:"type"`
	Homepage    string     `json:"homepage,omitempty"`
}

type PluginState int

const (
	PluginStateUnloaded PluginState = iota
	PluginStateLoaded
	PluginStateActive
	PluginStateError
)

func (s PluginState) String() string {
	switch s {
	case PluginStateUnloaded:
		return "unloaded"
	case PluginStateLoaded:
		return "loaded"
	case PluginStateActive:
		return "active"
	case PluginStateError:
		return "error"
	default:
		return "unknown"
	}
}

type Plugin interface {
	Info() PluginInfo
	Init(ctx context.Context, config json.RawMessage) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	Cleanup() error
}

type AgentPlugin interface {
	Plugin
	Execute(ctx context.Context, input string) (string, error)
	Stream(ctx context.Context, input string, output chan<- string) error
}

type ToolPlugin interface {
	Plugin
	Tools() []ToolDefinition
	ExecuteTool(ctx context.Context, name string, args json.RawMessage) (interface{}, error)
}

type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

type ThemePlugin interface {
	Plugin
	Colors() ThemeColors
	Apply() error
}

type ThemeColors struct {
	Primary    string `json:"primary"`
	Secondary  string `json:"secondary"`
	Background string `json:"background"`
	Foreground string `json:"foreground"`
	Accent     string `json:"accent"`
	Error      string `json:"error"`
	Warning    string `json:"warning"`
	Success    string `json:"success"`
}

type LoadedPlugin struct {
	Info   PluginInfo
	State  PluginState
	Path   string
	Plugin Plugin
	Error  error
}
