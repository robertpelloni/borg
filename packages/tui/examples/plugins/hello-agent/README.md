# Hello Agent Plugin

A simple example agent plugin that demonstrates how to create custom AI agents for SuperAI CLI.

## Overview

This plugin shows how to:
- Implement the `AgentPlugin` interface
- Use the SDK's `BaseAgentPlugin` for boilerplate
- Handle input and return responses
- Support streaming output

## Building

```bash
# From the superai-cli root directory
go build -buildmode=plugin -o hello-agent.so ./examples/plugins/hello-agent/

# Or use the build script
./scripts/build-plugins.sh
```

## Installation

Copy the built `.so` (Linux), `.dll` (Windows), or `.dylib` (macOS) file to your plugins directory:

```bash
cp hello-agent.so ~/.superai/plugins/
```

## Usage

1. Start SuperAI CLI: `superai`
2. Press `p` to open the plugin list
3. Select "hello-agent" and press Enter to activate
4. The agent will appear in your agents list

## Code Structure

```go
// Required: Export NewPlugin function
func NewPlugin() plugin.Plugin {
    // Create and return your plugin
}

// Implement AgentPlugin interface:
// - Info() PluginInfo
// - Init(ctx, config) error
// - Start(ctx) error
// - Stop(ctx) error
// - Cleanup() error
// - Execute(ctx, input) (string, error)
// - Stream(ctx, input, output) error
```

## Customization

Modify the `handleExecute` function to implement your own agent logic:

```go
func (h *HelloAgent) handleExecute(ctx context.Context, input string) (string, error) {
    // Your custom logic here
    // - Call external APIs
    // - Process with local LLM
    // - Execute commands
    // - etc.
    return response, nil
}
```

## License

MIT - Part of SuperAI CLI
