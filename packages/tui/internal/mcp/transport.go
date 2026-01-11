package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// Transport defines the interface for MCP communication
type Transport interface {
	// Start initializes the transport connection
	Start(ctx context.Context) error

	// Send sends a JSON-RPC message and returns the response
	Send(ctx context.Context, msg *JSONRPCRequest) (*JSONRPCResponse, error)

	// SendNotification sends a notification (no response expected)
	SendNotification(ctx context.Context, msg *JSONRPCNotification) error

	// OnNotification registers a handler for incoming notifications
	OnNotification(handler NotificationHandler)

	// Close shuts down the transport
	Close() error

	// Type returns the transport type
	Type() TransportType
}

// NotificationHandler is called when a notification is received
type NotificationHandler func(notification *JSONRPCNotification)

// ========== Stdio Transport ==========

// StdioTransport communicates with MCP servers via stdin/stdout
type StdioTransport struct {
	command string
	args    []string
	env     map[string]string
	workDir string

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser

	mu            sync.Mutex
	pending       map[interface{}]chan *JSONRPCResponse
	notifyHandler NotificationHandler
	closed        bool
	readErr       error

	stderrLog bytes.Buffer
}

// NewStdioTransport creates a new stdio transport
func NewStdioTransport(command string, args []string, env map[string]string, workDir string) *StdioTransport {
	return &StdioTransport{
		command: command,
		args:    args,
		env:     env,
		workDir: workDir,
		pending: make(map[interface{}]chan *JSONRPCResponse),
	}
}

// Type returns the transport type
func (t *StdioTransport) Type() TransportType {
	return TransportStdio
}

// Start spawns the subprocess and begins reading
func (t *StdioTransport) Start(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.cmd != nil {
		return fmt.Errorf("transport already started")
	}

	t.cmd = exec.CommandContext(ctx, t.command, t.args...)

	// Set working directory if specified
	if t.workDir != "" {
		t.cmd.Dir = t.workDir
	}

	// Set environment
	t.cmd.Env = os.Environ()
	for k, v := range t.env {
		t.cmd.Env = append(t.cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	var err error
	t.stdin, err = t.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdin pipe: %w", err)
	}

	t.stdout, err = t.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	t.stderr, err = t.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := t.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start command: %w", err)
	}

	// Read stderr in background
	go t.readStderr()

	// Read stdout messages in background
	go t.readMessages()

	return nil
}

// readStderr captures stderr output for debugging
func (t *StdioTransport) readStderr() {
	scanner := bufio.NewScanner(t.stderr)
	for scanner.Scan() {
		t.stderrLog.WriteString(scanner.Text())
		t.stderrLog.WriteByte('\n')
	}
}

// readMessages reads JSON-RPC messages from stdout
func (t *StdioTransport) readMessages() {
	decoder := json.NewDecoder(t.stdout)
	for {
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			t.mu.Lock()
			if !t.closed {
				t.readErr = err
			}
			t.mu.Unlock()
			return
		}

		// Try to parse as response (has id) or notification (no id)
		var msg struct {
			ID     interface{} `json:"id"`
			Method string      `json:"method"`
		}
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		if msg.ID != nil {
			// This is a response
			var resp JSONRPCResponse
			if err := json.Unmarshal(raw, &resp); err != nil {
				continue
			}

			t.mu.Lock()
			if ch, ok := t.pending[msg.ID]; ok {
				ch <- &resp
				delete(t.pending, msg.ID)
			}
			t.mu.Unlock()
		} else if msg.Method != "" {
			// This is a notification
			var notif JSONRPCNotification
			if err := json.Unmarshal(raw, &notif); err != nil {
				continue
			}

			t.mu.Lock()
			handler := t.notifyHandler
			t.mu.Unlock()

			if handler != nil {
				go handler(&notif)
			}
		}
	}
}

// Send sends a request and waits for response
func (t *StdioTransport) Send(ctx context.Context, msg *JSONRPCRequest) (*JSONRPCResponse, error) {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return nil, fmt.Errorf("transport closed")
	}
	if t.readErr != nil {
		t.mu.Unlock()
		return nil, fmt.Errorf("transport read error: %w", t.readErr)
	}

	// Create response channel
	respCh := make(chan *JSONRPCResponse, 1)
	t.pending[msg.ID] = respCh
	t.mu.Unlock()

	// Send the message
	data, err := json.Marshal(msg)
	if err != nil {
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	t.mu.Lock()
	_, err = t.stdin.Write(append(data, '\n'))
	t.mu.Unlock()
	if err != nil {
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, fmt.Errorf("failed to write request: %w", err)
	}

	// Wait for response
	select {
	case resp := <-respCh:
		return resp, nil
	case <-ctx.Done():
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, ctx.Err()
	}
}

// SendNotification sends a notification without waiting for response
func (t *StdioTransport) SendNotification(ctx context.Context, msg *JSONRPCNotification) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.closed {
		return fmt.Errorf("transport closed")
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	_, err = t.stdin.Write(append(data, '\n'))
	return err
}

// OnNotification registers a notification handler
func (t *StdioTransport) OnNotification(handler NotificationHandler) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.notifyHandler = handler
}

// Close shuts down the transport
func (t *StdioTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.closed {
		return nil
	}
	t.closed = true

	// Close pending channels
	for id, ch := range t.pending {
		close(ch)
		delete(t.pending, id)
	}

	if t.stdin != nil {
		t.stdin.Close()
	}

	if t.cmd != nil && t.cmd.Process != nil {
		// Give it a moment to exit gracefully
		done := make(chan error, 1)
		go func() {
			done <- t.cmd.Wait()
		}()

		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.cmd.Process.Kill()
		}
	}

	return nil
}

// StderrLog returns captured stderr output
func (t *StdioTransport) StderrLog() string {
	return t.stderrLog.String()
}

// ========== SSE Transport ==========

// SSETransport communicates with MCP servers via Server-Sent Events
type SSETransport struct {
	url     string
	headers map[string]string
	client  *http.Client

	mu              sync.Mutex
	pending         map[interface{}]chan *JSONRPCResponse
	notifyHandler   NotificationHandler
	closed          bool
	cancelFunc      context.CancelFunc
	messageEndpoint string
}

// NewSSETransport creates a new SSE transport
func NewSSETransport(url string, headers map[string]string) *SSETransport {
	return &SSETransport{
		url:     url,
		headers: headers,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		pending: make(map[interface{}]chan *JSONRPCResponse),
	}
}

// Type returns the transport type
func (t *SSETransport) Type() TransportType {
	return TransportSSE
}

// Start connects to the SSE endpoint
func (t *SSETransport) Start(ctx context.Context) error {
	t.mu.Lock()
	if t.cancelFunc != nil {
		t.mu.Unlock()
		return fmt.Errorf("transport already started")
	}

	ctx, cancel := context.WithCancel(ctx)
	t.cancelFunc = cancel
	t.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, "GET", t.url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	for k, v := range t.headers {
		req.Header.Set(k, v)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	// Start reading SSE events in background
	go t.readSSE(ctx, resp.Body)

	return nil
}

// readSSE reads Server-Sent Events
func (t *SSETransport) readSSE(ctx context.Context, body io.ReadCloser) {
	defer body.Close()
	reader := bufio.NewReader(body)

	var eventType string
	var data bytes.Buffer

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}

		line = strings.TrimRight(line, "\r\n")

		if line == "" {
			// End of event
			if data.Len() > 0 {
				t.handleSSEEvent(eventType, data.Bytes())
				data.Reset()
				eventType = ""
			}
			continue
		}

		if strings.HasPrefix(line, "event:") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			dataLine := strings.TrimPrefix(line, "data:")
			data.WriteString(dataLine)
		}
	}
}

// handleSSEEvent processes an SSE event
func (t *SSETransport) handleSSEEvent(eventType string, data []byte) {
	switch eventType {
	case "endpoint":
		// Server is telling us where to send messages
		t.mu.Lock()
		t.messageEndpoint = strings.TrimSpace(string(data))
		t.mu.Unlock()

	case "message":
		// JSON-RPC message
		var msg struct {
			ID     interface{} `json:"id"`
			Method string      `json:"method"`
		}
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}

		if msg.ID != nil {
			var resp JSONRPCResponse
			if err := json.Unmarshal(data, &resp); err != nil {
				return
			}

			t.mu.Lock()
			if ch, ok := t.pending[msg.ID]; ok {
				ch <- &resp
				delete(t.pending, msg.ID)
			}
			t.mu.Unlock()
		} else if msg.Method != "" {
			var notif JSONRPCNotification
			if err := json.Unmarshal(data, &notif); err != nil {
				return
			}

			t.mu.Lock()
			handler := t.notifyHandler
			t.mu.Unlock()

			if handler != nil {
				go handler(&notif)
			}
		}
	}
}

// Send sends a request via HTTP POST
func (t *SSETransport) Send(ctx context.Context, msg *JSONRPCRequest) (*JSONRPCResponse, error) {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return nil, fmt.Errorf("transport closed")
	}

	endpoint := t.messageEndpoint
	if endpoint == "" {
		endpoint = t.url // Fallback to base URL
	}

	respCh := make(chan *JSONRPCResponse, 1)
	t.pending[msg.ID] = respCh
	t.mu.Unlock()

	// Send via HTTP POST
	data, err := json.Marshal(msg)
	if err != nil {
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(data))
	if err != nil {
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range t.headers {
		req.Header.Set(k, v)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	resp.Body.Close()

	// Wait for response via SSE
	select {
	case result := <-respCh:
		return result, nil
	case <-ctx.Done():
		t.mu.Lock()
		delete(t.pending, msg.ID)
		t.mu.Unlock()
		return nil, ctx.Err()
	}
}

// SendNotification sends a notification via HTTP POST
func (t *SSETransport) SendNotification(ctx context.Context, msg *JSONRPCNotification) error {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return fmt.Errorf("transport closed")
	}

	endpoint := t.messageEndpoint
	if endpoint == "" {
		endpoint = t.url
	}
	t.mu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range t.headers {
		req.Header.Set(k, v)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	resp.Body.Close()

	return nil
}

// OnNotification registers a notification handler
func (t *SSETransport) OnNotification(handler NotificationHandler) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.notifyHandler = handler
}

// Close shuts down the transport
func (t *SSETransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.closed {
		return nil
	}
	t.closed = true

	if t.cancelFunc != nil {
		t.cancelFunc()
	}

	for id, ch := range t.pending {
		close(ch)
		delete(t.pending, id)
	}

	return nil
}

// ========== HTTP Streamable Transport ==========

// HTTPTransport communicates with MCP servers via streamable HTTP (recommended)
type HTTPTransport struct {
	url     string
	headers map[string]string
	client  *http.Client

	mu            sync.Mutex
	notifyHandler NotificationHandler
	closed        bool
	sessionID     string
}

// NewHTTPTransport creates a new HTTP transport
func NewHTTPTransport(url string, headers map[string]string) *HTTPTransport {
	return &HTTPTransport{
		url:     url,
		headers: headers,
		client: &http.Client{
			Timeout: 0, // No timeout for streaming
		},
	}
}

// Type returns the transport type
func (t *HTTPTransport) Type() TransportType {
	return TransportStreamableHTTP
}

// Start initializes the HTTP transport (no persistent connection needed)
func (t *HTTPTransport) Start(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.closed {
		return fmt.Errorf("transport closed")
	}

	return nil
}

// Send sends a request and handles streaming response
func (t *HTTPTransport) Send(ctx context.Context, msg *JSONRPCRequest) (*JSONRPCResponse, error) {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return nil, fmt.Errorf("transport closed")
	}
	sessionID := t.sessionID
	t.mu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", t.url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
	for k, v := range t.headers {
		req.Header.Set(k, v)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Store session ID if provided
	if sid := resp.Header.Get("Mcp-Session-Id"); sid != "" {
		t.mu.Lock()
		t.sessionID = sid
		t.mu.Unlock()
	}

	contentType := resp.Header.Get("Content-Type")

	if strings.HasPrefix(contentType, "application/json") {
		// Direct JSON response
		var result JSONRPCResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}
		return &result, nil
	}

	if strings.HasPrefix(contentType, "text/event-stream") {
		// SSE streaming response
		return t.readStreamingResponse(ctx, resp.Body, msg.ID)
	}

	return nil, fmt.Errorf("unexpected content type: %s", contentType)
}

// readStreamingResponse reads SSE events until we get our response
func (t *HTTPTransport) readStreamingResponse(ctx context.Context, body io.Reader, expectedID interface{}) (*JSONRPCResponse, error) {
	reader := bufio.NewReader(body)
	var data bytes.Buffer

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				return nil, fmt.Errorf("connection closed before response received")
			}
			return nil, fmt.Errorf("failed to read response: %w", err)
		}

		line = strings.TrimRight(line, "\r\n")

		if line == "" {
			// End of event
			if data.Len() > 0 {
				var msg struct {
					ID     interface{} `json:"id"`
					Method string      `json:"method"`
				}
				if err := json.Unmarshal(data.Bytes(), &msg); err == nil {
					if msg.ID != nil {
						// Check if this is our response
						if fmt.Sprintf("%v", msg.ID) == fmt.Sprintf("%v", expectedID) {
							var result JSONRPCResponse
							if err := json.Unmarshal(data.Bytes(), &result); err != nil {
								return nil, fmt.Errorf("failed to decode response: %w", err)
							}
							return &result, nil
						}
					} else if msg.Method != "" {
						// Notification
						var notif JSONRPCNotification
						if err := json.Unmarshal(data.Bytes(), &notif); err == nil {
							t.mu.Lock()
							handler := t.notifyHandler
							t.mu.Unlock()
							if handler != nil {
								go handler(&notif)
							}
						}
					}
				}
				data.Reset()
			}
			continue
		}

		if strings.HasPrefix(line, "data:") {
			dataLine := strings.TrimPrefix(line, "data:")
			data.WriteString(dataLine)
		}
	}
}

// SendNotification sends a notification
func (t *HTTPTransport) SendNotification(ctx context.Context, msg *JSONRPCNotification) error {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return fmt.Errorf("transport closed")
	}
	sessionID := t.sessionID
	t.mu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", t.url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
	for k, v := range t.headers {
		req.Header.Set(k, v)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	resp.Body.Close()

	// Store session ID if provided
	if sid := resp.Header.Get("Mcp-Session-Id"); sid != "" {
		t.mu.Lock()
		t.sessionID = sid
		t.mu.Unlock()
	}

	return nil
}

// OnNotification registers a notification handler
func (t *HTTPTransport) OnNotification(handler NotificationHandler) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.notifyHandler = handler
}

// Close shuts down the transport
func (t *HTTPTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.closed {
		return nil
	}
	t.closed = true

	// Send DELETE to end session if we have one
	if t.sessionID != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		req, _ := http.NewRequestWithContext(ctx, "DELETE", t.url, nil)
		if req != nil {
			req.Header.Set("Mcp-Session-Id", t.sessionID)
			resp, err := t.client.Do(req)
			if err == nil {
				resp.Body.Close()
			}
		}
	}

	return nil
}

// SessionID returns the current session ID
func (t *HTTPTransport) SessionID() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.sessionID
}

// ========== Transport Factory ==========

// NewTransport creates a transport based on server config
func NewTransport(config *ServerConfig) (Transport, error) {
	switch config.Type {
	case TransportStdio:
		if config.Command == "" {
			return nil, fmt.Errorf("command required for stdio transport")
		}
		return NewStdioTransport(config.Command, config.Args, config.Env, ""), nil

	case TransportSSE:
		if config.URL == "" {
			return nil, fmt.Errorf("url required for SSE transport")
		}
		return NewSSETransport(config.URL, config.Headers), nil

	case TransportStreamableHTTP:
		if config.URL == "" {
			return nil, fmt.Errorf("url required for HTTP transport")
		}
		return NewHTTPTransport(config.URL, config.Headers), nil

	default:
		return nil, fmt.Errorf("unknown transport type: %s", config.Type)
	}
}
