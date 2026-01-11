package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Aggregator manages multiple MCP server sessions and provides a unified interface
type Aggregator struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	configs  []*ServerConfig

	// Tool index: qualified name -> session name
	toolIndex map[string]string

	// Event handlers
	onServerStateChange func(serverName string, state ConnectionState)
	onToolsUpdated      func()
}

// NewAggregator creates a new MCP aggregator
func NewAggregator() *Aggregator {
	return &Aggregator{
		sessions:  make(map[string]*Session),
		toolIndex: make(map[string]string),
	}
}

// AddServer adds a server configuration
func (a *Aggregator) AddServer(config *ServerConfig) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.configs = append(a.configs, config)
}

// AddServers adds multiple server configurations
func (a *Aggregator) AddServers(configs []*ServerConfig) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.configs = append(a.configs, configs...)
}

// ConnectAll connects to all configured servers
func (a *Aggregator) ConnectAll(ctx context.Context) error {
	a.mu.RLock()
	configs := make([]*ServerConfig, len(a.configs))
	copy(configs, a.configs)
	a.mu.RUnlock()

	var wg sync.WaitGroup
	errCh := make(chan error, len(configs))

	for _, config := range configs {
		if !config.Enabled {
			continue
		}

		wg.Add(1)
		go func(cfg *ServerConfig) {
			defer wg.Done()
			if err := a.Connect(ctx, cfg.Name); err != nil {
				errCh <- fmt.Errorf("%s: %w", cfg.Name, err)
			}
		}(config)
	}

	wg.Wait()
	close(errCh)

	// Collect errors
	var errs []error
	for err := range errCh {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to connect to %d servers: %v", len(errs), errs)
	}

	return nil
}

// Connect connects to a specific server by name
func (a *Aggregator) Connect(ctx context.Context, serverName string) error {
	a.mu.Lock()

	// Find config
	var config *ServerConfig
	for _, cfg := range a.configs {
		if cfg.Name == serverName {
			config = cfg
			break
		}
	}

	if config == nil {
		a.mu.Unlock()
		return fmt.Errorf("server not found: %s", serverName)
	}

	// Check if already connected
	if session, ok := a.sessions[serverName]; ok {
		if session.State() == StateReady {
			a.mu.Unlock()
			return nil // Already connected
		}
		// Close existing broken session
		session.Close()
	}

	// Create new session
	session := NewSession(config)

	// Set up event handlers
	session.OnStateChange(func(state ConnectionState) {
		a.mu.RLock()
		handler := a.onServerStateChange
		a.mu.RUnlock()
		if handler != nil {
			handler(serverName, state)
		}
	})

	session.OnToolsChanged(func(tools []ToolInfo) {
		a.rebuildToolIndex()
		a.mu.RLock()
		handler := a.onToolsUpdated
		a.mu.RUnlock()
		if handler != nil {
			handler()
		}
	})

	a.sessions[serverName] = session
	a.mu.Unlock()

	// Connect
	if err := session.Connect(ctx); err != nil {
		return err
	}

	// Rebuild tool index
	a.rebuildToolIndex()

	return nil
}

// Disconnect disconnects from a specific server
func (a *Aggregator) Disconnect(serverName string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	session, ok := a.sessions[serverName]
	if !ok {
		return fmt.Errorf("server not connected: %s", serverName)
	}

	err := session.Close()
	delete(a.sessions, serverName)
	a.rebuildToolIndexLocked()

	return err
}

// DisconnectAll disconnects from all servers
func (a *Aggregator) DisconnectAll() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	var lastErr error
	for name, session := range a.sessions {
		if err := session.Close(); err != nil {
			lastErr = err
		}
		delete(a.sessions, name)
	}

	a.toolIndex = make(map[string]string)
	return lastErr
}

// rebuildToolIndex rebuilds the tool name -> server mapping
func (a *Aggregator) rebuildToolIndex() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.rebuildToolIndexLocked()
}

func (a *Aggregator) rebuildToolIndexLocked() {
	a.toolIndex = make(map[string]string)

	for serverName, session := range a.sessions {
		if session.State() != StateReady {
			continue
		}

		for _, tool := range session.Tools() {
			// Create qualified name: server_name.tool_name
			qualifiedName := fmt.Sprintf("%s.%s", serverName, tool.Name)
			a.toolIndex[qualifiedName] = serverName

			// Also index by unqualified name if unique
			if _, exists := a.toolIndex[tool.Name]; !exists {
				a.toolIndex[tool.Name] = serverName
			} else {
				// Mark as ambiguous by setting to empty
				a.toolIndex[tool.Name] = ""
			}
		}
	}
}

// CallTool calls a tool by name (qualified or unqualified)
func (a *Aggregator) CallTool(ctx context.Context, toolName string, arguments map[string]interface{}) (*ToolCallResult, error) {
	a.mu.RLock()

	// Parse tool name
	serverName, actualToolName := a.parseToolName(toolName)

	if serverName == "" {
		// Look up in index
		serverName = a.toolIndex[toolName]
		actualToolName = toolName
	}

	if serverName == "" {
		a.mu.RUnlock()
		return nil, fmt.Errorf("tool not found or ambiguous: %s (use server.tool format)", toolName)
	}

	session, ok := a.sessions[serverName]
	if !ok {
		a.mu.RUnlock()
		return nil, fmt.Errorf("server not connected: %s", serverName)
	}
	a.mu.RUnlock()

	return session.CallTool(ctx, actualToolName, arguments)
}

// parseToolName splits "server.tool" into server and tool names
func (a *Aggregator) parseToolName(name string) (serverName, toolName string) {
	parts := strings.SplitN(name, ".", 2)
	if len(parts) == 2 {
		// Check if first part is a valid server name
		if _, ok := a.sessions[parts[0]]; ok {
			return parts[0], parts[1]
		}
	}
	return "", name
}

// ReadResource reads a resource from a server
func (a *Aggregator) ReadResource(ctx context.Context, serverName, uri string) (*ResourceReadResult, error) {
	a.mu.RLock()
	session, ok := a.sessions[serverName]
	a.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("server not connected: %s", serverName)
	}

	return session.ReadResource(ctx, uri)
}

// GetPrompt gets a prompt from a server
func (a *Aggregator) GetPrompt(ctx context.Context, serverName, promptName string, arguments map[string]string) (*PromptGetResult, error) {
	a.mu.RLock()
	session, ok := a.sessions[serverName]
	a.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("server not connected: %s", serverName)
	}

	return session.GetPrompt(ctx, promptName, arguments)
}

// AllTools returns all tools from all connected servers
func (a *Aggregator) AllTools() []AggregatedTool {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var result []AggregatedTool

	for serverName, session := range a.sessions {
		if session.State() != StateReady {
			continue
		}

		for _, tool := range session.Tools() {
			result = append(result, AggregatedTool{
				ServerName:    serverName,
				QualifiedName: fmt.Sprintf("%s.%s", serverName, tool.Name),
				Tool:          tool,
				AutoApprove:   session.MatchesAutoApprove(tool.Name),
			})
		}
	}

	return result
}

// AllResources returns all resources from all connected servers
func (a *Aggregator) AllResources() []AggregatedResource {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var result []AggregatedResource

	for serverName, session := range a.sessions {
		if session.State() != StateReady {
			continue
		}

		for _, resource := range session.Resources() {
			result = append(result, AggregatedResource{
				ServerName: serverName,
				Resource:   resource,
			})
		}
	}

	return result
}

// AllPrompts returns all prompts from all connected servers
func (a *Aggregator) AllPrompts() []AggregatedPrompt {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var result []AggregatedPrompt

	for serverName, session := range a.sessions {
		if session.State() != StateReady {
			continue
		}

		for _, prompt := range session.Prompts() {
			result = append(result, AggregatedPrompt{
				ServerName: serverName,
				Prompt:     prompt,
			})
		}
	}

	return result
}

// ServerStatuses returns the status of all servers
func (a *Aggregator) ServerStatuses() []*ServerStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var result []*ServerStatus

	// Include all configured servers
	for _, config := range a.configs {
		if session, ok := a.sessions[config.Name]; ok {
			result = append(result, session.Status())
		} else {
			// Not connected
			result = append(result, &ServerStatus{
				Name:        config.Name,
				State:       StateDisconnected,
				StateString: StateDisconnected.String(),
			})
		}
	}

	return result
}

// GetSession returns a specific session
func (a *Aggregator) GetSession(serverName string) *Session {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.sessions[serverName]
}

// OnServerStateChange sets the server state change handler
func (a *Aggregator) OnServerStateChange(handler func(serverName string, state ConnectionState)) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.onServerStateChange = handler
}

// OnToolsUpdated sets the tools updated handler
func (a *Aggregator) OnToolsUpdated(handler func()) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.onToolsUpdated = handler
}

// PingAll pings all connected servers
func (a *Aggregator) PingAll(ctx context.Context) map[string]error {
	a.mu.RLock()
	sessions := make(map[string]*Session)
	for k, v := range a.sessions {
		sessions[k] = v
	}
	a.mu.RUnlock()

	results := make(map[string]error)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for name, session := range sessions {
		wg.Add(1)
		go func(n string, s *Session) {
			defer wg.Done()
			err := s.Ping(ctx)
			mu.Lock()
			results[n] = err
			mu.Unlock()
		}(name, session)
	}

	wg.Wait()
	return results
}

// RefreshAll refreshes capabilities from all connected servers
func (a *Aggregator) RefreshAll(ctx context.Context) error {
	a.mu.RLock()
	sessions := make(map[string]*Session)
	for k, v := range a.sessions {
		sessions[k] = v
	}
	a.mu.RUnlock()

	var wg sync.WaitGroup
	errCh := make(chan error, len(sessions))

	for name, session := range sessions {
		if session.State() != StateReady {
			continue
		}

		wg.Add(1)
		go func(n string, s *Session) {
			defer wg.Done()
			if err := s.refreshCapabilities(ctx); err != nil {
				errCh <- fmt.Errorf("%s: %w", n, err)
			}
		}(name, session)
	}

	wg.Wait()
	close(errCh)

	// Rebuild index after refresh
	a.rebuildToolIndex()

	var errs []error
	for err := range errCh {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("refresh errors: %v", errs)
	}

	return nil
}

// StartHealthCheck starts a background health check loop
func (a *Aggregator) StartHealthCheck(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				a.healthCheck(ctx)
			}
		}
	}()
}

func (a *Aggregator) healthCheck(ctx context.Context) {
	a.mu.RLock()
	configs := make([]*ServerConfig, len(a.configs))
	copy(configs, a.configs)
	a.mu.RUnlock()

	for _, config := range configs {
		if !config.Enabled {
			continue
		}

		a.mu.RLock()
		session, exists := a.sessions[config.Name]
		a.mu.RUnlock()

		if !exists || session.State() != StateReady {
			// Try to reconnect
			go func(name string) {
				ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
				defer cancel()
				a.Connect(ctx, name)
			}(config.Name)
			continue
		}

		// Ping to check health
		pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		if err := session.Ping(pingCtx); err != nil {
			// Connection may be dead, try to reconnect
			go func(name string) {
				ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
				defer cancel()
				a.Disconnect(name)
				a.Connect(ctx, name)
			}(config.Name)
		}
		cancel()
	}
}

// ========== Aggregated Types ==========

// AggregatedTool represents a tool with server context
type AggregatedTool struct {
	ServerName    string   `json:"serverName"`
	QualifiedName string   `json:"qualifiedName"`
	Tool          ToolInfo `json:"tool"`
	AutoApprove   bool     `json:"autoApprove"`
}

// AggregatedResource represents a resource with server context
type AggregatedResource struct {
	ServerName string       `json:"serverName"`
	Resource   ResourceInfo `json:"resource"`
}

// AggregatedPrompt represents a prompt with server context
type AggregatedPrompt struct {
	ServerName string     `json:"serverName"`
	Prompt     PromptInfo `json:"prompt"`
}

// ========== Tool Schema for LLM ==========

// GenerateToolSchemas generates tool schemas for LLM consumption
func (a *Aggregator) GenerateToolSchemas() []map[string]interface{} {
	tools := a.AllTools()
	schemas := make([]map[string]interface{}, 0, len(tools))

	for _, tool := range tools {
		schema := map[string]interface{}{
			"name":        tool.QualifiedName,
			"description": tool.Tool.Description,
		}

		if tool.Tool.InputSchema != nil {
			schema["parameters"] = tool.Tool.InputSchema
		} else {
			schema["parameters"] = map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			}
		}

		schemas = append(schemas, schema)
	}

	return schemas
}

// GenerateToolSchemasJSON generates tool schemas as JSON
func (a *Aggregator) GenerateToolSchemasJSON() ([]byte, error) {
	return json.MarshalIndent(a.GenerateToolSchemas(), "", "  ")
}
