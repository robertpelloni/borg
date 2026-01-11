package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Session manages a connection to a single MCP server
type Session struct {
	config    *ServerConfig
	transport Transport

	mu           sync.RWMutex
	state        ConnectionState
	serverInfo   *Implementation
	capabilities *ServerCapabilities
	tools        []ToolInfo
	resources    []ResourceInfo
	prompts      []PromptInfo
	lastError    error
	connectedAt  *time.Time
	lastActivity *time.Time

	// Request ID counter
	requestID atomic.Int64

	// Event handlers
	onStateChange      func(state ConnectionState)
	onNotification     func(method string, params json.RawMessage)
	onToolsChanged     func(tools []ToolInfo)
	onResourcesChanged func(resources []ResourceInfo)
	onPromptsChanged   func(prompts []PromptInfo)
}

// NewSession creates a new MCP session
func NewSession(config *ServerConfig) *Session {
	return &Session{
		config: config,
		state:  StateDisconnected,
	}
}

// Connect establishes the connection and performs initialization
func (s *Session) Connect(ctx context.Context) error {
	s.mu.Lock()
	if s.state != StateDisconnected && s.state != StateError {
		s.mu.Unlock()
		return fmt.Errorf("session already connected or connecting")
	}
	s.setState(StateConnecting)
	s.mu.Unlock()

	// Create transport
	transport, err := NewTransport(s.config)
	if err != nil {
		s.setError(fmt.Errorf("failed to create transport: %w", err))
		return err
	}

	// Set notification handler
	transport.OnNotification(s.handleNotification)

	// Start transport
	if err := transport.Start(ctx); err != nil {
		s.setError(fmt.Errorf("failed to start transport: %w", err))
		return err
	}

	s.mu.Lock()
	s.transport = transport
	s.setState(StateInitializing)
	s.mu.Unlock()

	// Perform MCP initialization handshake
	if err := s.initialize(ctx); err != nil {
		transport.Close()
		s.setError(fmt.Errorf("initialization failed: %w", err))
		return err
	}

	// Send initialized notification
	notif, _ := NewJSONRPCNotification(MethodInitialized, nil)
	if err := transport.SendNotification(ctx, notif); err != nil {
		transport.Close()
		s.setError(fmt.Errorf("failed to send initialized: %w", err))
		return err
	}

	// Fetch initial capabilities
	if err := s.refreshCapabilities(ctx); err != nil {
		// Non-fatal, continue anyway
		s.mu.Lock()
		s.lastError = err
		s.mu.Unlock()
	}

	now := time.Now()
	s.mu.Lock()
	s.connectedAt = &now
	s.setState(StateReady)
	s.mu.Unlock()

	return nil
}

// initialize performs the MCP initialization handshake
func (s *Session) initialize(ctx context.Context) error {
	initReq := InitializeRequest{
		ProtocolVersion: ProtocolVersion,
		Capabilities: ClientCapabilities{
			Roots: &RootsCapability{
				ListChanged: true,
			},
		},
		ClientInfo: Implementation{
			Name:    "superai-cli",
			Version: "1.6.0",
		},
	}

	req, err := NewJSONRPCRequest(s.nextID(), MethodInitialize, initReq)
	if err != nil {
		return fmt.Errorf("failed to create initialize request: %w", err)
	}

	resp, err := s.transport.Send(ctx, req)
	if err != nil {
		return fmt.Errorf("initialize request failed: %w", err)
	}

	if resp.Error != nil {
		return fmt.Errorf("initialize error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
	}

	var result InitializeResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return fmt.Errorf("failed to parse initialize result: %w", err)
	}

	s.mu.Lock()
	s.serverInfo = &result.ServerInfo
	s.capabilities = &result.Capabilities
	s.mu.Unlock()

	return nil
}

// refreshCapabilities fetches tools, resources, and prompts
func (s *Session) refreshCapabilities(ctx context.Context) error {
	s.mu.RLock()
	caps := s.capabilities
	s.mu.RUnlock()

	var wg sync.WaitGroup
	var errs []error
	var errMu sync.Mutex

	// Fetch tools
	if caps != nil && caps.Tools != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := s.refreshTools(ctx); err != nil {
				errMu.Lock()
				errs = append(errs, err)
				errMu.Unlock()
			}
		}()
	}

	// Fetch resources
	if caps != nil && caps.Resources != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := s.refreshResources(ctx); err != nil {
				errMu.Lock()
				errs = append(errs, err)
				errMu.Unlock()
			}
		}()
	}

	// Fetch prompts
	if caps != nil && caps.Prompts != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := s.refreshPrompts(ctx); err != nil {
				errMu.Lock()
				errs = append(errs, err)
				errMu.Unlock()
			}
		}()
	}

	wg.Wait()

	if len(errs) > 0 {
		return errs[0]
	}
	return nil
}

// refreshTools fetches the tool list
func (s *Session) refreshTools(ctx context.Context) error {
	var allTools []ToolInfo
	var cursor string

	for {
		params := map[string]interface{}{}
		if cursor != "" {
			params["cursor"] = cursor
		}

		req, err := NewJSONRPCRequest(s.nextID(), MethodToolsList, params)
		if err != nil {
			return err
		}

		resp, err := s.transport.Send(ctx, req)
		if err != nil {
			return err
		}

		if resp.Error != nil {
			return fmt.Errorf("tools/list error: %s", resp.Error.Message)
		}

		var result ToolsListResult
		if err := json.Unmarshal(resp.Result, &result); err != nil {
			return err
		}

		allTools = append(allTools, result.Tools...)

		if result.NextCursor == "" {
			break
		}
		cursor = result.NextCursor
	}

	s.mu.Lock()
	s.tools = allTools
	handler := s.onToolsChanged
	s.mu.Unlock()

	if handler != nil {
		handler(allTools)
	}

	return nil
}

// refreshResources fetches the resource list
func (s *Session) refreshResources(ctx context.Context) error {
	var allResources []ResourceInfo
	var cursor string

	for {
		params := map[string]interface{}{}
		if cursor != "" {
			params["cursor"] = cursor
		}

		req, err := NewJSONRPCRequest(s.nextID(), MethodResourcesList, params)
		if err != nil {
			return err
		}

		resp, err := s.transport.Send(ctx, req)
		if err != nil {
			return err
		}

		if resp.Error != nil {
			return fmt.Errorf("resources/list error: %s", resp.Error.Message)
		}

		var result ResourcesListResult
		if err := json.Unmarshal(resp.Result, &result); err != nil {
			return err
		}

		allResources = append(allResources, result.Resources...)

		if result.NextCursor == "" {
			break
		}
		cursor = result.NextCursor
	}

	s.mu.Lock()
	s.resources = allResources
	handler := s.onResourcesChanged
	s.mu.Unlock()

	if handler != nil {
		handler(allResources)
	}

	return nil
}

// refreshPrompts fetches the prompt list
func (s *Session) refreshPrompts(ctx context.Context) error {
	var allPrompts []PromptInfo
	var cursor string

	for {
		params := map[string]interface{}{}
		if cursor != "" {
			params["cursor"] = cursor
		}

		req, err := NewJSONRPCRequest(s.nextID(), MethodPromptsList, params)
		if err != nil {
			return err
		}

		resp, err := s.transport.Send(ctx, req)
		if err != nil {
			return err
		}

		if resp.Error != nil {
			return fmt.Errorf("prompts/list error: %s", resp.Error.Message)
		}

		var result PromptsListResult
		if err := json.Unmarshal(resp.Result, &result); err != nil {
			return err
		}

		allPrompts = append(allPrompts, result.Prompts...)

		if result.NextCursor == "" {
			break
		}
		cursor = result.NextCursor
	}

	s.mu.Lock()
	s.prompts = allPrompts
	handler := s.onPromptsChanged
	s.mu.Unlock()

	if handler != nil {
		handler(allPrompts)
	}

	return nil
}

// handleNotification processes incoming notifications
func (s *Session) handleNotification(notif *JSONRPCNotification) {
	s.updateActivity()

	s.mu.RLock()
	handler := s.onNotification
	s.mu.RUnlock()

	if handler != nil {
		handler(notif.Method, notif.Params)
	}

	// Handle specific notifications
	switch notif.Method {
	case MethodResourcesUpdated:
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			s.refreshResources(ctx)
		}()
	}
}

// CallTool invokes a tool on the server
func (s *Session) CallTool(ctx context.Context, name string, arguments map[string]interface{}) (*ToolCallResult, error) {
	s.mu.RLock()
	if s.state != StateReady {
		s.mu.RUnlock()
		return nil, fmt.Errorf("session not ready (state: %s)", s.state)
	}
	transport := s.transport
	s.mu.RUnlock()

	params := ToolCallParams{
		Name:      name,
		Arguments: arguments,
	}

	req, err := NewJSONRPCRequest(s.nextID(), MethodToolsCall, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create tool call request: %w", err)
	}

	s.updateActivity()
	resp, err := transport.Send(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("tool call failed: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("tool error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
	}

	var result ToolCallResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse tool result: %w", err)
	}

	return &result, nil
}

// ReadResource reads a resource from the server
func (s *Session) ReadResource(ctx context.Context, uri string) (*ResourceReadResult, error) {
	s.mu.RLock()
	if s.state != StateReady {
		s.mu.RUnlock()
		return nil, fmt.Errorf("session not ready (state: %s)", s.state)
	}
	transport := s.transport
	s.mu.RUnlock()

	params := ResourceReadParams{URI: uri}

	req, err := NewJSONRPCRequest(s.nextID(), MethodResourcesRead, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource read request: %w", err)
	}

	s.updateActivity()
	resp, err := transport.Send(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("resource read failed: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("resource error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
	}

	var result ResourceReadResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse resource result: %w", err)
	}

	return &result, nil
}

// GetPrompt gets a prompt from the server
func (s *Session) GetPrompt(ctx context.Context, name string, arguments map[string]string) (*PromptGetResult, error) {
	s.mu.RLock()
	if s.state != StateReady {
		s.mu.RUnlock()
		return nil, fmt.Errorf("session not ready (state: %s)", s.state)
	}
	transport := s.transport
	s.mu.RUnlock()

	params := PromptGetParams{
		Name:      name,
		Arguments: arguments,
	}

	req, err := NewJSONRPCRequest(s.nextID(), MethodPromptsGet, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create prompt get request: %w", err)
	}

	s.updateActivity()
	resp, err := transport.Send(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("prompt get failed: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("prompt error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
	}

	var result PromptGetResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse prompt result: %w", err)
	}

	return &result, nil
}

// Ping tests the connection
func (s *Session) Ping(ctx context.Context) error {
	s.mu.RLock()
	if s.state != StateReady {
		s.mu.RUnlock()
		return fmt.Errorf("session not ready (state: %s)", s.state)
	}
	transport := s.transport
	s.mu.RUnlock()

	req, err := NewJSONRPCRequest(s.nextID(), MethodPing, nil)
	if err != nil {
		return fmt.Errorf("failed to create ping request: %w", err)
	}

	s.updateActivity()
	resp, err := transport.Send(ctx, req)
	if err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}

	if resp.Error != nil {
		return fmt.Errorf("ping error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
	}

	return nil
}

// Close disconnects the session
func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.transport != nil {
		err := s.transport.Close()
		s.transport = nil
		s.state = StateDisconnected
		return err
	}

	s.state = StateDisconnected
	return nil
}

// Status returns the current session status
func (s *Session) Status() *ServerStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status := &ServerStatus{
		Name:           s.config.Name,
		State:          s.state,
		StateString:    s.state.String(),
		ServerInfo:     s.serverInfo,
		Capabilities:   s.capabilities,
		ToolCount:      len(s.tools),
		ResourceCount:  len(s.resources),
		PromptCount:    len(s.prompts),
		ConnectedAt:    s.connectedAt,
		LastActivityAt: s.lastActivity,
	}

	if s.lastError != nil {
		status.LastError = s.lastError.Error()
	}

	return status
}

// Tools returns the available tools
func (s *Session) Tools() []ToolInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]ToolInfo, len(s.tools))
	copy(result, s.tools)
	return result
}

// Resources returns the available resources
func (s *Session) Resources() []ResourceInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]ResourceInfo, len(s.resources))
	copy(result, s.resources)
	return result
}

// Prompts returns the available prompts
func (s *Session) Prompts() []PromptInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]PromptInfo, len(s.prompts))
	copy(result, s.prompts)
	return result
}

// State returns the current connection state
func (s *Session) State() ConnectionState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

// Config returns the session configuration
func (s *Session) Config() *ServerConfig {
	return s.config
}

// OnStateChange sets the state change handler
func (s *Session) OnStateChange(handler func(state ConnectionState)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onStateChange = handler
}

// OnNotification sets the notification handler
func (s *Session) OnNotificationHandler(handler func(method string, params json.RawMessage)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onNotification = handler
}

// OnToolsChanged sets the tools change handler
func (s *Session) OnToolsChanged(handler func(tools []ToolInfo)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onToolsChanged = handler
}

// OnResourcesChanged sets the resources change handler
func (s *Session) OnResourcesChanged(handler func(resources []ResourceInfo)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onResourcesChanged = handler
}

// OnPromptsChanged sets the prompts change handler
func (s *Session) OnPromptsChanged(handler func(prompts []PromptInfo)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onPromptsChanged = handler
}

// Helper methods

func (s *Session) nextID() int64 {
	return s.requestID.Add(1)
}

func (s *Session) setState(state ConnectionState) {
	s.state = state
	handler := s.onStateChange
	if handler != nil {
		go handler(state)
	}
}

func (s *Session) setError(err error) {
	s.mu.Lock()
	s.lastError = err
	s.setState(StateError)
	s.mu.Unlock()
}

func (s *Session) updateActivity() {
	now := time.Now()
	s.mu.Lock()
	s.lastActivity = &now
	s.mu.Unlock()
}

// MatchesAutoApprove checks if a tool name matches auto-approve patterns
func (s *Session) MatchesAutoApprove(toolName string) bool {
	for _, pattern := range s.config.AutoApprove {
		if matchPattern(pattern, toolName) {
			return true
		}
	}
	return false
}

// matchPattern performs simple glob matching
func matchPattern(pattern, name string) bool {
	if pattern == "*" {
		return true
	}

	// Handle prefix match (e.g., "read_*")
	if len(pattern) > 1 && pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		return len(name) >= len(prefix) && name[:len(prefix)] == prefix
	}

	// Handle suffix match (e.g., "*_file")
	if len(pattern) > 1 && pattern[0] == '*' {
		suffix := pattern[1:]
		return len(name) >= len(suffix) && name[len(name)-len(suffix):] == suffix
	}

	// Exact match
	return pattern == name
}
