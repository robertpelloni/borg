package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
)

// Server implements an MCP server that exposes tools to external clients
type Server struct {
	info         Implementation
	capabilities ServerCapabilities

	mu        sync.RWMutex
	tools     map[string]*ServerTool
	resources map[string]*ServerResource
	prompts   map[string]*ServerPrompt

	// Request ID for notifications
	notifyID atomic.Int64

	// Handlers
	onToolCall     func(ctx context.Context, name string, args map[string]interface{}) (*ToolCallResult, error)
	onResourceRead func(ctx context.Context, uri string) (*ResourceReadResult, error)
	onPromptGet    func(ctx context.Context, name string, args map[string]string) (*PromptGetResult, error)
}

// ServerTool represents a tool exposed by the server
type ServerTool struct {
	Info    ToolInfo
	Handler func(ctx context.Context, args map[string]interface{}) (*ToolCallResult, error)
}

// ServerResource represents a resource exposed by the server
type ServerResource struct {
	Info    ResourceInfo
	Handler func(ctx context.Context) (*ResourceContent, error)
}

// ServerPrompt represents a prompt exposed by the server
type ServerPrompt struct {
	Info    PromptInfo
	Handler func(ctx context.Context, args map[string]string) (*PromptGetResult, error)
}

// NewServer creates a new MCP server
func NewServer(name, version string) *Server {
	return &Server{
		info: Implementation{
			Name:    name,
			Version: version,
		},
		capabilities: ServerCapabilities{
			Tools:     &ToolsCapability{ListChanged: true},
			Resources: &ResourcesCapability{ListChanged: true, Subscribe: false},
			Prompts:   &PromptsCapability{ListChanged: true},
			Logging:   &LoggingCapability{},
		},
		tools:     make(map[string]*ServerTool),
		resources: make(map[string]*ServerResource),
		prompts:   make(map[string]*ServerPrompt),
	}
}

// RegisterTool registers a tool with the server
func (s *Server) RegisterTool(tool *ServerTool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tools[tool.Info.Name] = tool
}

// RegisterResource registers a resource with the server
func (s *Server) RegisterResource(resource *ServerResource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.resources[resource.Info.URI] = resource
}

// RegisterPrompt registers a prompt with the server
func (s *Server) RegisterPrompt(prompt *ServerPrompt) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prompts[prompt.Info.Name] = prompt
}

// UnregisterTool removes a tool
func (s *Server) UnregisterTool(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tools, name)
}

// UnregisterResource removes a resource
func (s *Server) UnregisterResource(uri string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.resources, uri)
}

// UnregisterPrompt removes a prompt
func (s *Server) UnregisterPrompt(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.prompts, name)
}

// OnToolCall sets a fallback handler for tool calls
func (s *Server) OnToolCall(handler func(ctx context.Context, name string, args map[string]interface{}) (*ToolCallResult, error)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onToolCall = handler
}

// OnResourceRead sets a fallback handler for resource reads
func (s *Server) OnResourceRead(handler func(ctx context.Context, uri string) (*ResourceReadResult, error)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onResourceRead = handler
}

// OnPromptGet sets a fallback handler for prompt gets
func (s *Server) OnPromptGet(handler func(ctx context.Context, name string, args map[string]string) (*PromptGetResult, error)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onPromptGet = handler
}

// ServeStdio runs the server using stdio transport
func (s *Server) ServeStdio(ctx context.Context) error {
	reader := bufio.NewReader(os.Stdin)
	writer := os.Stdout

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return fmt.Errorf("read error: %w", err)
		}

		response := s.handleMessage(ctx, line)
		if response != nil {
			data, err := json.Marshal(response)
			if err != nil {
				continue
			}
			writer.Write(append(data, '\n'))
		}
	}
}

// ServeHTTP implements http.Handler for HTTP transport
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	switch r.Method {
	case http.MethodPost:
		s.handleHTTPPost(ctx, w, r)
	case http.MethodGet:
		// SSE endpoint for notifications (if needed)
		s.handleHTTPSSE(ctx, w, r)
	case http.MethodDelete:
		// Session termination
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleHTTPPost(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}

	response := s.handleMessage(ctx, body)
	if response == nil {
		// Notification, no response needed
		w.WriteHeader(http.StatusAccepted)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleHTTPSSE(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Send endpoint event
	fmt.Fprintf(w, "event: endpoint\ndata: %s\n\n", r.URL.Path)
	flusher.Flush()

	// Keep connection open
	<-ctx.Done()
}

// handleMessage processes a JSON-RPC message
func (s *Server) handleMessage(ctx context.Context, data []byte) interface{} {
	// Try to parse as request or notification
	var msg struct {
		ID     interface{} `json:"id"`
		Method string      `json:"method"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return s.errorResponse(nil, ErrCodeParse, "Parse error", nil)
	}

	if msg.ID != nil {
		// Request
		var req JSONRPCRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return s.errorResponse(nil, ErrCodeParse, "Parse error", nil)
		}
		return s.handleRequest(ctx, &req)
	}

	// Notification (no response)
	var notif JSONRPCNotification
	if err := json.Unmarshal(data, &notif); err != nil {
		return nil
	}
	s.handleNotification(ctx, &notif)
	return nil
}

func (s *Server) handleRequest(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	switch req.Method {
	case MethodInitialize:
		return s.handleInitialize(req)
	case MethodPing:
		return s.handlePing(req)
	case MethodToolsList:
		return s.handleToolsList(req)
	case MethodToolsCall:
		return s.handleToolsCall(ctx, req)
	case MethodResourcesList:
		return s.handleResourcesList(req)
	case MethodResourcesRead:
		return s.handleResourcesRead(ctx, req)
	case MethodPromptsList:
		return s.handlePromptsList(req)
	case MethodPromptsGet:
		return s.handlePromptsGet(ctx, req)
	default:
		return s.errorResponse(req.ID, ErrCodeMethodNotFound, "Method not found", nil)
	}
}

func (s *Server) handleNotification(ctx context.Context, notif *JSONRPCNotification) {
	switch notif.Method {
	case MethodInitialized:
		// Client acknowledged initialization
	case MethodCancelled:
		// Request cancellation (could implement cancellation tokens)
	}
}

func (s *Server) handleInitialize(req *JSONRPCRequest) *JSONRPCResponse {
	var params InitializeRequest
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, "Invalid params", nil)
	}

	result := InitializeResult{
		ProtocolVersion: ProtocolVersion,
		Capabilities:    s.capabilities,
		ServerInfo:      s.info,
		Instructions:    "SuperAI CLI MCP Server - provides unified access to AI coding tools",
	}

	return s.successResponse(req.ID, result)
}

func (s *Server) handlePing(req *JSONRPCRequest) *JSONRPCResponse {
	return s.successResponse(req.ID, map[string]interface{}{})
}

func (s *Server) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tools := make([]ToolInfo, 0, len(s.tools))
	for _, tool := range s.tools {
		tools = append(tools, tool.Info)
	}

	result := ToolsListResult{
		Tools: tools,
	}

	return s.successResponse(req.ID, result)
}

func (s *Server) handleToolsCall(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	var params ToolCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, "Invalid params", nil)
	}

	s.mu.RLock()
	tool, ok := s.tools[params.Name]
	fallbackHandler := s.onToolCall
	s.mu.RUnlock()

	var result *ToolCallResult
	var err error

	if ok && tool.Handler != nil {
		result, err = tool.Handler(ctx, params.Arguments)
	} else if fallbackHandler != nil {
		result, err = fallbackHandler(ctx, params.Name, params.Arguments)
	} else {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, fmt.Sprintf("Tool not found: %s", params.Name), nil)
	}

	if err != nil {
		return s.successResponse(req.ID, &ToolCallResult{
			Content: []ContentBlock{NewTextContent(err.Error())},
			IsError: true,
		})
	}

	return s.successResponse(req.ID, result)
}

func (s *Server) handleResourcesList(req *JSONRPCRequest) *JSONRPCResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	resources := make([]ResourceInfo, 0, len(s.resources))
	for _, resource := range s.resources {
		resources = append(resources, resource.Info)
	}

	result := ResourcesListResult{
		Resources: resources,
	}

	return s.successResponse(req.ID, result)
}

func (s *Server) handleResourcesRead(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	var params ResourceReadParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, "Invalid params", nil)
	}

	s.mu.RLock()
	resource, ok := s.resources[params.URI]
	fallbackHandler := s.onResourceRead
	s.mu.RUnlock()

	var result *ResourceReadResult
	var err error

	if ok && resource.Handler != nil {
		content, err := resource.Handler(ctx)
		if err != nil {
			return s.errorResponse(req.ID, ErrCodeInternal, err.Error(), nil)
		}
		result = &ResourceReadResult{
			Contents: []ResourceContent{*content},
		}
	} else if fallbackHandler != nil {
		result, err = fallbackHandler(ctx, params.URI)
		if err != nil {
			return s.errorResponse(req.ID, ErrCodeInternal, err.Error(), nil)
		}
	} else {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, fmt.Sprintf("Resource not found: %s", params.URI), nil)
	}

	return s.successResponse(req.ID, result)
}

func (s *Server) handlePromptsList(req *JSONRPCRequest) *JSONRPCResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	prompts := make([]PromptInfo, 0, len(s.prompts))
	for _, prompt := range s.prompts {
		prompts = append(prompts, prompt.Info)
	}

	result := PromptsListResult{
		Prompts: prompts,
	}

	return s.successResponse(req.ID, result)
}

func (s *Server) handlePromptsGet(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	var params PromptGetParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, "Invalid params", nil)
	}

	s.mu.RLock()
	prompt, ok := s.prompts[params.Name]
	fallbackHandler := s.onPromptGet
	s.mu.RUnlock()

	var result *PromptGetResult
	var err error

	if ok && prompt.Handler != nil {
		result, err = prompt.Handler(ctx, params.Arguments)
	} else if fallbackHandler != nil {
		result, err = fallbackHandler(ctx, params.Name, params.Arguments)
	} else {
		return s.errorResponse(req.ID, ErrCodeInvalidParams, fmt.Sprintf("Prompt not found: %s", params.Name), nil)
	}

	if err != nil {
		return s.errorResponse(req.ID, ErrCodeInternal, err.Error(), nil)
	}

	return s.successResponse(req.ID, result)
}

// Helper methods for responses

func (s *Server) successResponse(id interface{}, result interface{}) *JSONRPCResponse {
	data, _ := json.Marshal(result)
	return &JSONRPCResponse{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Result:  data,
	}
}

func (s *Server) errorResponse(id interface{}, code int, message string, data interface{}) *JSONRPCResponse {
	return &JSONRPCResponse{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Error: &JSONRPCError{
			Code:    code,
			Message: message,
			Data:    data,
		},
	}
}

// ========== Built-in Tools ==========

// RegisterBuiltinTools registers common built-in tools
func (s *Server) RegisterBuiltinTools() {
	// Echo tool for testing
	s.RegisterTool(&ServerTool{
		Info: ToolInfo{
			Name:        "echo",
			Description: "Echoes back the input message",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"message": map[string]interface{}{
						"type":        "string",
						"description": "Message to echo",
					},
				},
				"required": []string{"message"},
			},
		},
		Handler: func(ctx context.Context, args map[string]interface{}) (*ToolCallResult, error) {
			message, _ := args["message"].(string)
			return &ToolCallResult{
				Content: []ContentBlock{NewTextContent(message)},
			}, nil
		},
	})

	// Server info tool
	s.RegisterTool(&ServerTool{
		Info: ToolInfo{
			Name:        "server_info",
			Description: "Returns information about this MCP server",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		Handler: func(ctx context.Context, args map[string]interface{}) (*ToolCallResult, error) {
			s.mu.RLock()
			info := map[string]interface{}{
				"name":          s.info.Name,
				"version":       s.info.Version,
				"toolCount":     len(s.tools),
				"resourceCount": len(s.resources),
				"promptCount":   len(s.prompts),
			}
			s.mu.RUnlock()

			data, _ := json.MarshalIndent(info, "", "  ")
			return &ToolCallResult{
				Content: []ContentBlock{NewTextContent(string(data))},
			}, nil
		},
	})
}

// ========== Convenience Methods ==========

// ListenAndServe starts an HTTP server
func (s *Server) ListenAndServe(addr string) error {
	return http.ListenAndServe(addr, s)
}

// Tools returns all registered tools
func (s *Server) Tools() []ToolInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tools := make([]ToolInfo, 0, len(s.tools))
	for _, tool := range s.tools {
		tools = append(tools, tool.Info)
	}
	return tools
}

// Resources returns all registered resources
func (s *Server) Resources() []ResourceInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	resources := make([]ResourceInfo, 0, len(s.resources))
	for _, resource := range s.resources {
		resources = append(resources, resource.Info)
	}
	return resources
}

// Prompts returns all registered prompts
func (s *Server) Prompts() []PromptInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	prompts := make([]PromptInfo, 0, len(s.prompts))
	for _, prompt := range s.prompts {
		prompts = append(prompts, prompt.Info)
	}
	return prompts
}
