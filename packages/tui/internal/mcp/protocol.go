package mcp

import (
	"encoding/json"
	"time"
)

// MCP Protocol Version
const ProtocolVersion = "2024-11-05"

// JSON-RPC 2.0 Message Types
const (
	JSONRPCVersion = "2.0"
)

// Standard MCP Methods
const (
	MethodInitialize       = "initialize"
	MethodInitialized      = "notifications/initialized"
	MethodToolsList        = "tools/list"
	MethodToolsCall        = "tools/call"
	MethodResourcesList    = "resources/list"
	MethodResourcesRead    = "resources/read"
	MethodPromptsList      = "prompts/list"
	MethodPromptsGet       = "prompts/get"
	MethodPing             = "ping"
	MethodCancelled        = "notifications/cancelled"
	MethodProgress         = "notifications/progress"
	MethodLoggingMessage   = "notifications/message"
	MethodResourcesUpdated = "notifications/resources/list_changed"
)

// Transport Types
type TransportType string

const (
	TransportStdio          TransportType = "stdio"
	TransportSSE            TransportType = "sse"
	TransportStreamableHTTP TransportType = "streamable-http"
)

// ========== JSON-RPC Base Types ==========

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"` // string or number
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

// JSONRPCError represents a JSON-RPC 2.0 error
type JSONRPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Standard JSON-RPC Error Codes
const (
	ErrCodeParse          = -32700
	ErrCodeInvalidRequest = -32600
	ErrCodeMethodNotFound = -32601
	ErrCodeInvalidParams  = -32602
	ErrCodeInternal       = -32603
)

// JSONRPCNotification represents a JSON-RPC 2.0 notification (no ID)
type JSONRPCNotification struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// ========== MCP Initialize Types ==========

// InitializeRequest is sent by client to start connection
type InitializeRequest struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ClientCapabilities `json:"capabilities"`
	ClientInfo      Implementation     `json:"clientInfo"`
}

// InitializeResult is the server's response to initialize
type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      Implementation     `json:"serverInfo"`
	Instructions    string             `json:"instructions,omitempty"`
}

// Implementation identifies a client or server
type Implementation struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// ClientCapabilities declares what the client supports
type ClientCapabilities struct {
	Roots    *RootsCapability    `json:"roots,omitempty"`
	Sampling *SamplingCapability `json:"sampling,omitempty"`
}

// ServerCapabilities declares what the server supports
type ServerCapabilities struct {
	Tools     *ToolsCapability     `json:"tools,omitempty"`
	Resources *ResourcesCapability `json:"resources,omitempty"`
	Prompts   *PromptsCapability   `json:"prompts,omitempty"`
	Logging   *LoggingCapability   `json:"logging,omitempty"`
}

// RootsCapability indicates root support
type RootsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// SamplingCapability indicates sampling support
type SamplingCapability struct{}

// ToolsCapability indicates tools support
type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// ResourcesCapability indicates resources support
type ResourcesCapability struct {
	Subscribe   bool `json:"subscribe,omitempty"`
	ListChanged bool `json:"listChanged,omitempty"`
}

// PromptsCapability indicates prompts support
type PromptsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// LoggingCapability indicates logging support
type LoggingCapability struct{}

// ========== Tool Types ==========

// ToolInfo describes an available tool
type ToolInfo struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// ToolsListResult is the response for tools/list
type ToolsListResult struct {
	Tools      []ToolInfo `json:"tools"`
	NextCursor string     `json:"nextCursor,omitempty"`
}

// ToolCallParams are parameters for tools/call
type ToolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// ToolCallResult is the response for tools/call
type ToolCallResult struct {
	Content []ContentBlock `json:"content"`
	IsError bool           `json:"isError,omitempty"`
}

// ContentBlock represents content in tool results
type ContentBlock struct {
	Type     string `json:"type"` // "text", "image", "resource"
	Text     string `json:"text,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
	Data     string `json:"data,omitempty"` // base64 for images
	URI      string `json:"uri,omitempty"`  // for resources
}

// ========== Resource Types ==========

// ResourceInfo describes an available resource
type ResourceInfo struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
}

// ResourcesListResult is the response for resources/list
type ResourcesListResult struct {
	Resources  []ResourceInfo `json:"resources"`
	NextCursor string         `json:"nextCursor,omitempty"`
}

// ResourceReadParams are parameters for resources/read
type ResourceReadParams struct {
	URI string `json:"uri"`
}

// ResourceReadResult is the response for resources/read
type ResourceReadResult struct {
	Contents []ResourceContent `json:"contents"`
}

// ResourceContent represents resource content
type ResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType,omitempty"`
	Text     string `json:"text,omitempty"`
	Blob     string `json:"blob,omitempty"` // base64
}

// ========== Prompt Types ==========

// PromptInfo describes an available prompt
type PromptInfo struct {
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	Arguments   []PromptArgument `json:"arguments,omitempty"`
}

// PromptArgument describes a prompt argument
type PromptArgument struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required,omitempty"`
}

// PromptsListResult is the response for prompts/list
type PromptsListResult struct {
	Prompts    []PromptInfo `json:"prompts"`
	NextCursor string       `json:"nextCursor,omitempty"`
}

// PromptGetParams are parameters for prompts/get
type PromptGetParams struct {
	Name      string            `json:"name"`
	Arguments map[string]string `json:"arguments,omitempty"`
}

// PromptGetResult is the response for prompts/get
type PromptGetResult struct {
	Description string          `json:"description,omitempty"`
	Messages    []PromptMessage `json:"messages"`
}

// PromptMessage represents a message in a prompt
type PromptMessage struct {
	Role    string       `json:"role"` // "user" or "assistant"
	Content ContentBlock `json:"content"`
}

// ========== Progress & Logging Types ==========

// ProgressNotification represents progress updates
type ProgressNotification struct {
	ProgressToken interface{} `json:"progressToken"`
	Progress      float64     `json:"progress"`
	Total         float64     `json:"total,omitempty"`
}

// LoggingLevel represents log severity
type LoggingLevel string

const (
	LogLevelDebug     LoggingLevel = "debug"
	LogLevelInfo      LoggingLevel = "info"
	LogLevelNotice    LoggingLevel = "notice"
	LogLevelWarning   LoggingLevel = "warning"
	LogLevelError     LoggingLevel = "error"
	LogLevelCritical  LoggingLevel = "critical"
	LogLevelAlert     LoggingLevel = "alert"
	LogLevelEmergency LoggingLevel = "emergency"
)

// LoggingMessage represents a log message
type LoggingMessage struct {
	Level  LoggingLevel `json:"level"`
	Logger string       `json:"logger,omitempty"`
	Data   interface{}  `json:"data"`
}

// ========== Server Configuration ==========

// ServerConfig defines how to connect to an MCP server
type ServerConfig struct {
	Name        string            `yaml:"name" json:"name"`
	Type        TransportType     `yaml:"type" json:"type"`
	Command     string            `yaml:"command,omitempty" json:"command,omitempty"`           // For stdio
	Args        []string          `yaml:"args,omitempty" json:"args,omitempty"`                 // For stdio
	Env         map[string]string `yaml:"env,omitempty" json:"env,omitempty"`                   // For stdio
	URL         string            `yaml:"url,omitempty" json:"url,omitempty"`                   // For SSE/HTTP
	Headers     map[string]string `yaml:"headers,omitempty" json:"headers,omitempty"`           // For SSE/HTTP
	AutoApprove []string          `yaml:"auto_approve,omitempty" json:"auto_approve,omitempty"` // Tool patterns to auto-approve
	Enabled     bool              `yaml:"enabled" json:"enabled"`
	Timeout     time.Duration     `yaml:"timeout,omitempty" json:"timeout,omitempty"`
}

// ========== Connection State ==========

// ConnectionState represents the state of an MCP connection
type ConnectionState int

const (
	StateDisconnected ConnectionState = iota
	StateConnecting
	StateInitializing
	StateReady
	StateError
)

func (s ConnectionState) String() string {
	switch s {
	case StateDisconnected:
		return "disconnected"
	case StateConnecting:
		return "connecting"
	case StateInitializing:
		return "initializing"
	case StateReady:
		return "ready"
	case StateError:
		return "error"
	default:
		return "unknown"
	}
}

// ServerStatus represents the status of an MCP server connection
type ServerStatus struct {
	Name           string              `json:"name"`
	State          ConnectionState     `json:"state"`
	StateString    string              `json:"stateString"`
	ServerInfo     *Implementation     `json:"serverInfo,omitempty"`
	Capabilities   *ServerCapabilities `json:"capabilities,omitempty"`
	ToolCount      int                 `json:"toolCount"`
	ResourceCount  int                 `json:"resourceCount"`
	PromptCount    int                 `json:"promptCount"`
	LastError      string              `json:"lastError,omitempty"`
	ConnectedAt    *time.Time          `json:"connectedAt,omitempty"`
	LastActivityAt *time.Time          `json:"lastActivityAt,omitempty"`
}

// ========== Helper Functions ==========

// NewJSONRPCRequest creates a new JSON-RPC request
func NewJSONRPCRequest(id interface{}, method string, params interface{}) (*JSONRPCRequest, error) {
	var paramsBytes json.RawMessage
	if params != nil {
		b, err := json.Marshal(params)
		if err != nil {
			return nil, err
		}
		paramsBytes = b
	}
	return &JSONRPCRequest{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Method:  method,
		Params:  paramsBytes,
	}, nil
}

// NewJSONRPCNotification creates a new JSON-RPC notification
func NewJSONRPCNotification(method string, params interface{}) (*JSONRPCNotification, error) {
	var paramsBytes json.RawMessage
	if params != nil {
		b, err := json.Marshal(params)
		if err != nil {
			return nil, err
		}
		paramsBytes = b
	}
	return &JSONRPCNotification{
		JSONRPC: JSONRPCVersion,
		Method:  method,
		Params:  paramsBytes,
	}, nil
}

// NewTextContent creates a text content block
func NewTextContent(text string) ContentBlock {
	return ContentBlock{
		Type: "text",
		Text: text,
	}
}

// NewImageContent creates an image content block
func NewImageContent(mimeType, base64Data string) ContentBlock {
	return ContentBlock{
		Type:     "image",
		MimeType: mimeType,
		Data:     base64Data,
	}
}

// NewResourceContent creates a resource content block
func NewResourceContent(uri, mimeType, text string) ContentBlock {
	return ContentBlock{
		Type:     "resource",
		URI:      uri,
		MimeType: mimeType,
		Text:     text,
	}
}
