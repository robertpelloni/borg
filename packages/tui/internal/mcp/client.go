package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// HubTool represents a tool available from the MCP hub
type HubTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	ServerName  string                 `json:"serverName,omitempty"`
}

// HubToolsResponse is the response from listing tools
type HubToolsResponse struct {
	Tools []HubTool `json:"tools"`
}

// ToolExecuteRequest is the request body for tool execution
type ToolExecuteRequest struct {
	Arguments map[string]interface{} `json:"arguments"`
}

// ToolExecuteResponse is the response from tool execution
type ToolExecuteResponse struct {
	Success bool        `json:"success"`
	Result  interface{} `json:"result,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// SSEEvent represents a Server-Sent Event from the hub
type SSEEvent struct {
	Event string                 `json:"event"`
	Data  map[string]interface{} `json:"data"`
}

// Client is an HTTP client for the MCP hub
type Client struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

// NewClient creates a new MCP hub client
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NewClientWithAuth creates a new MCP hub client with API key authentication
func NewClientWithAuth(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) addAuthHeaders(req *http.Request) {
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
		req.Header.Set("X-API-Key", c.APIKey)
	}
}

// ListTools fetches all available tools from the hub
func (c *Client) ListTools() ([]HubTool, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/hub/tools", c.BaseURL), nil)
	if err != nil {
		return nil, err
	}
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to list tools: %s", resp.Status)
	}

	var toolsResp HubToolsResponse
	if err := json.NewDecoder(resp.Body).Decode(&toolsResp); err != nil {
		return nil, err
	}

	return toolsResp.Tools, nil
}

// ExecuteTool calls a tool on the MCP hub with the given arguments
func (c *Client) ExecuteTool(ctx context.Context, toolName string, args map[string]interface{}) (*ToolExecuteResponse, error) {
	reqBody := ToolExecuteRequest{Arguments: args}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/hub/tools/%s/execute", c.BaseURL, toolName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute tool: %w", err)
	}
	defer resp.Body.Close()

	var execResp ToolExecuteResponse
	if err := json.NewDecoder(resp.Body).Decode(&execResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		if execResp.Error != "" {
			return nil, fmt.Errorf("tool execution failed: %s", execResp.Error)
		}
		return nil, fmt.Errorf("tool execution failed: %s", resp.Status)
	}

	return &execResp, nil
}

// GetTool fetches details for a specific tool
func (c *Client) GetTool(toolName string) (*HubTool, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/hub/tools/%s", c.BaseURL, toolName), nil)
	if err != nil {
		return nil, err
	}
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("tool not found: %s", toolName)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get tool: %s", resp.Status)
	}

	var tool HubTool
	if err := json.NewDecoder(resp.Body).Decode(&tool); err != nil {
		return nil, err
	}

	return &tool, nil
}

// Ping checks if the MCP hub is reachable
func (c *Client) Ping() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/health", c.BaseURL), nil)
	if err != nil {
		return err
	}
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("hub unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("hub unhealthy: %s", resp.Status)
	}

	return nil
}

// SubscribeSSE connects to the SSE endpoint and streams events
func (c *Client) SubscribeSSE(ctx context.Context, eventChan chan<- SSEEvent) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/hub/sse", c.BaseURL), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	c.addAuthHeaders(req)

	client := &http.Client{Timeout: 0}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("SSE connection failed: %w", err)
	}

	go func() {
		defer resp.Body.Close()
		defer close(eventChan)

		scanner := bufio.NewScanner(resp.Body)
		var eventName, eventData string

		for scanner.Scan() {
			line := scanner.Text()

			if strings.HasPrefix(line, "event:") {
				eventName = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			} else if strings.HasPrefix(line, "data:") {
				eventData = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			} else if line == "" && eventData != "" {
				var data map[string]interface{}
				if json.Unmarshal([]byte(eventData), &data) == nil {
					select {
					case eventChan <- SSEEvent{Event: eventName, Data: data}:
					case <-ctx.Done():
						return
					}
				}
				eventName, eventData = "", ""
			}
		}
	}()

	return nil
}

// CallMemorySearch searches the AIOS memory system
func (c *Client) CallMemorySearch(ctx context.Context, query string) ([]map[string]interface{}, error) {
	reqBody := map[string]string{"query": query}
	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/memory/search", c.BaseURL), bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var results []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}
	return results, nil
}

// CallMemoryRemember stores content in AIOS memory
func (c *Client) CallMemoryRemember(ctx context.Context, content string, tags []string) error {
	reqBody := map[string]interface{}{"content": content, "tags": tags}
	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/memory/remember", c.BaseURL), bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to store memory: %s", resp.Status)
	}
	return nil
}

// GetSystemStatus fetches AIOS system health and status
func (c *Client) GetSystemStatus(ctx context.Context) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/system/status", c.BaseURL), nil)
	if err != nil {
		return nil, err
	}
	c.addAuthHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var status map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	return status, nil
}
