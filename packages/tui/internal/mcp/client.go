package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

// Client is an HTTP client for the MCP hub
type Client struct {
	BaseURL    string
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

// ListTools fetches all available tools from the hub
func (c *Client) ListTools() ([]HubTool, error) {
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/api/hub/tools", c.BaseURL))
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
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/api/hub/tools/%s", c.BaseURL, toolName))
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
