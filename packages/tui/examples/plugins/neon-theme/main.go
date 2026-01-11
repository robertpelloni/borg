// Package main provides an example theme plugin for SuperAI CLI.
//
// This plugin demonstrates how to create custom themes that change
// the visual appearance of the TUI.
//
// Build with: go build -buildmode=plugin -o neon-theme.so main.go
package main

import (
	"context"
	"encoding/json"

	"github.com/aios/superai-cli/internal/plugin"
)

// NeonThemePlugin provides a cyberpunk-inspired neon color scheme.
type NeonThemePlugin struct {
	*plugin.BaseThemePlugin
}

// NewPlugin is the required entry point for all plugins.
func NewPlugin() plugin.Plugin {
	return &NeonThemePlugin{
		BaseThemePlugin: plugin.NewBaseThemePlugin(
			plugin.PluginInfo{
				Name:        "neon-theme",
				Version:     "1.0.0",
				Description: "Cyberpunk-inspired neon color scheme",
				Author:      "SuperAI CLI Team",
				Homepage:    "https://github.com/aios/superai-cli",
			},
			plugin.ThemeColors{
				Primary:    "#FF00FF", // Magenta
				Secondary:  "#00FFFF", // Cyan
				Background: "#0D0D0D", // Near black
				Foreground: "#E0E0E0", // Light gray
				Accent:     "#FF1493", // Deep pink
				Error:      "#FF0040", // Bright red
				Warning:    "#FFD700", // Gold
				Success:    "#00FF00", // Lime green
			},
		),
	}
}

// Init allows for custom configuration.
func (n *NeonThemePlugin) Init(ctx context.Context, config json.RawMessage) error {
	if err := n.BaseThemePlugin.Init(ctx, config); err != nil {
		return err
	}
	// Could parse custom config to override colors
	return nil
}

// Apply applies the theme to the TUI.
func (n *NeonThemePlugin) Apply() error {
	// Theme application would be handled by the dashboard
	// This is called when the theme is activated
	return nil
}

// main is required for plugin build mode but not called
func main() {}
