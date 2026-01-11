// Package main provides an example agent plugin for SuperAI CLI.
//
// This plugin demonstrates how to create a custom AI agent that can be
// loaded dynamically into SuperAI CLI.
//
// Build with: go build -buildmode=plugin -o hello-agent.so main.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aios/superai-cli/internal/plugin"
)

// HelloAgent is a simple example agent that echoes input with a greeting.
type HelloAgent struct {
	*plugin.BaseAgentPlugin
	greeting string
}

// NewPlugin is the required entry point for all plugins.
// SuperAI CLI will call this function to instantiate the plugin.
func NewPlugin() plugin.Plugin {
	agent := &HelloAgent{
		BaseAgentPlugin: plugin.NewBaseAgentPlugin(plugin.PluginInfo{
			Name:        "hello-agent",
			Version:     "1.0.0",
			Description: "A friendly greeting agent that demonstrates plugin development",
			Author:      "SuperAI CLI Team",
			Homepage:    "https://github.com/aios/superai-cli",
		}),
		greeting: "Hello",
	}

	// Set up the execute function
	agent.ExecuteFunc = agent.handleExecute

	return agent
}

// Init initializes the agent with optional configuration.
func (h *HelloAgent) Init(ctx context.Context, config json.RawMessage) error {
	// Call base implementation first
	if err := h.BaseAgentPlugin.Init(ctx, config); err != nil {
		return err
	}

	// Parse custom config if provided
	if len(config) > 0 {
		// Example: could parse JSON config here
		// cfg, err := plugin.ParseArgs[HelloConfig](config)
	}

	return nil
}

// handleExecute processes the input and returns a response.
func (h *HelloAgent) handleExecute(ctx context.Context, input string) (string, error) {
	// Check for context cancellation
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}

	// Simple greeting logic
	input = strings.TrimSpace(input)
	if input == "" {
		return fmt.Sprintf("%s! I'm the Hello Agent. How can I help you today?", h.greeting), nil
	}

	// Echo with greeting
	response := fmt.Sprintf("%s! You said: %q\n\nI'm a simple example agent. "+
		"I demonstrate how to build plugins for SuperAI CLI.\n\n"+
		"Current time: %s", h.greeting, input, time.Now().Format(time.RFC1123))

	return response, nil
}

// Stream sends output incrementally to the channel.
func (h *HelloAgent) Stream(ctx context.Context, input string, output chan<- string) error {
	// Simulate streaming by sending words one at a time
	response, err := h.handleExecute(ctx, input)
	if err != nil {
		return err
	}

	words := strings.Fields(response)
	for i, word := range words {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			if i > 0 {
				output <- " "
			}
			output <- word
			time.Sleep(50 * time.Millisecond) // Simulate typing delay
		}
	}

	return nil
}

func main() {}
