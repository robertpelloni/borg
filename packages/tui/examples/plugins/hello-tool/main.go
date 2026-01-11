// Package main provides an example tool plugin for SuperAI CLI.
//
// This plugin demonstrates how to create custom tools that can be
// called by the ReAct orchestrator or used directly from the TUI.
//
// Build with: go build -buildmode=plugin -o hello-tool.so main.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/aios/superai-cli/internal/plugin"
)

// HelloToolPlugin provides example tools for demonstration.
type HelloToolPlugin struct {
	*plugin.BaseToolPlugin
}

// NewPlugin is the required entry point for all plugins.
func NewPlugin() plugin.Plugin {
	p := &HelloToolPlugin{
		BaseToolPlugin: plugin.NewBaseToolPlugin(plugin.PluginInfo{
			Name:        "hello-tool",
			Version:     "1.0.0",
			Description: "Example tools demonstrating plugin development",
			Author:      "SuperAI CLI Team",
			Homepage:    "https://github.com/aios/superai-cli",
		}),
	}

	// Register tools
	p.registerTools()

	return p
}

func (h *HelloToolPlugin) registerTools() {
	// Tool 1: greet - Generate a greeting
	h.RegisterTool(
		plugin.NewToolDef(
			"greet",
			"Generate a personalized greeting message",
			map[string]interface{}{
				"name": plugin.StringProperty("The name to greet"),
				"style": map[string]interface{}{
					"type":        "string",
					"description": "Greeting style: formal, casual, or enthusiastic",
					"enum":        []string{"formal", "casual", "enthusiastic"},
				},
			},
			[]string{"name"},
		),
		h.greetHandler,
	)

	// Tool 2: random_number - Generate a random number
	h.RegisterTool(
		plugin.NewToolDef(
			"random_number",
			"Generate a random number within a range",
			map[string]interface{}{
				"min": plugin.IntProperty("Minimum value (inclusive)"),
				"max": plugin.IntProperty("Maximum value (inclusive)"),
			},
			[]string{"min", "max"},
		),
		h.randomNumberHandler,
	)

	// Tool 3: word_count - Count words in text
	h.RegisterTool(
		plugin.NewToolDef(
			"word_count",
			"Count the number of words, characters, and lines in text",
			map[string]interface{}{
				"text": plugin.StringProperty("The text to analyze"),
			},
			[]string{"text"},
		),
		h.wordCountHandler,
	)

	// Tool 4: reverse_text - Reverse a string
	h.RegisterTool(
		plugin.NewToolDef(
			"reverse_text",
			"Reverse the characters in a string",
			map[string]interface{}{
				"text": plugin.StringProperty("The text to reverse"),
			},
			[]string{"text"},
		),
		h.reverseTextHandler,
	)
}

// =============================================================================
// Tool Handlers
// =============================================================================

type greetArgs struct {
	Name  string `json:"name"`
	Style string `json:"style"`
}

func (h *HelloToolPlugin) greetHandler(ctx context.Context, args json.RawMessage) (interface{}, error) {
	params, err := plugin.ParseArgs[greetArgs](args)
	if err != nil {
		return nil, err
	}

	if params.Style == "" {
		params.Style = "casual"
	}

	var greeting string
	switch params.Style {
	case "formal":
		greeting = fmt.Sprintf("Good day, %s. I hope this message finds you well.", params.Name)
	case "enthusiastic":
		greeting = fmt.Sprintf("HEY %s!!! SO GREAT TO SEE YOU! 🎉", strings.ToUpper(params.Name))
	default: // casual
		greeting = fmt.Sprintf("Hey %s! What's up?", params.Name)
	}

	return map[string]interface{}{
		"greeting":  greeting,
		"style":     params.Style,
		"timestamp": time.Now().Format(time.RFC3339),
	}, nil
}

type randomNumberArgs struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

func (h *HelloToolPlugin) randomNumberHandler(ctx context.Context, args json.RawMessage) (interface{}, error) {
	params, err := plugin.ParseArgs[randomNumberArgs](args)
	if err != nil {
		return nil, err
	}

	if params.Min > params.Max {
		return nil, fmt.Errorf("min (%d) cannot be greater than max (%d)", params.Min, params.Max)
	}

	number := rand.Intn(params.Max-params.Min+1) + params.Min

	return map[string]interface{}{
		"number": number,
		"min":    params.Min,
		"max":    params.Max,
	}, nil
}

type wordCountArgs struct {
	Text string `json:"text"`
}

func (h *HelloToolPlugin) wordCountHandler(ctx context.Context, args json.RawMessage) (interface{}, error) {
	params, err := plugin.ParseArgs[wordCountArgs](args)
	if err != nil {
		return nil, err
	}

	words := len(strings.Fields(params.Text))
	chars := len(params.Text)
	charsNoSpace := len(strings.ReplaceAll(params.Text, " ", ""))
	lines := strings.Count(params.Text, "\n") + 1
	if params.Text == "" {
		lines = 0
	}

	return map[string]interface{}{
		"words":               words,
		"characters":          chars,
		"characters_no_space": charsNoSpace,
		"lines":               lines,
	}, nil
}

type reverseTextArgs struct {
	Text string `json:"text"`
}

func (h *HelloToolPlugin) reverseTextHandler(ctx context.Context, args json.RawMessage) (interface{}, error) {
	params, err := plugin.ParseArgs[reverseTextArgs](args)
	if err != nil {
		return nil, err
	}

	runes := []rune(params.Text)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}

	return map[string]interface{}{
		"original": params.Text,
		"reversed": string(runes),
		"length":   len(runes),
	}, nil
}

// main is required for plugin build mode but not called
func main() {}
