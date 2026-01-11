# Hello Tool Plugin

An example tool plugin that demonstrates how to create custom tools for SuperAI CLI.

## Overview

This plugin provides several example tools:

| Tool | Description |
|------|-------------|
| `greet` | Generate personalized greetings |
| `random_number` | Generate random numbers in a range |
| `word_count` | Count words, characters, and lines |
| `reverse_text` | Reverse a string |

## Building

```bash
# From the superai-cli root directory
go build -buildmode=plugin -o hello-tool.so ./examples/plugins/hello-tool/

# Or use the build script
./scripts/build-plugins.sh
```

## Installation

```bash
cp hello-tool.so ~/.superai/plugins/
```

## Usage

Once installed and activated, these tools become available to:
1. The ReAct orchestrator (LLM can call them)
2. Direct execution from the TUI

### Example Tool Calls

```json
// greet
{"name": "Alice", "style": "enthusiastic"}
// Returns: {"greeting": "HEY ALICE!!! SO GREAT TO SEE YOU! 🎉", ...}

// random_number
{"min": 1, "max": 100}
// Returns: {"number": 42, "min": 1, "max": 100}

// word_count
{"text": "Hello world, this is a test."}
// Returns: {"words": 6, "characters": 28, ...}

// reverse_text
{"text": "SuperAI"}
// Returns: {"original": "SuperAI", "reversed": "IAreapuS", ...}
```

## Creating Your Own Tools

1. Create a new tool plugin using `BaseToolPlugin`:

```go
p := plugin.NewBaseToolPlugin(plugin.PluginInfo{
    Name: "my-tools",
    // ...
})
```

2. Register tools with `RegisterTool`:

```go
p.RegisterTool(
    plugin.NewToolDef(
        "tool_name",
        "Tool description",
        map[string]interface{}{
            "param1": plugin.StringProperty("Description"),
        },
        []string{"param1"}, // required params
    ),
    handlerFunction,
)
```

3. Implement handlers:

```go
func handler(ctx context.Context, args json.RawMessage) (interface{}, error) {
    params, err := plugin.ParseArgs[MyParams](args)
    if err != nil {
        return nil, err
    }
    // Your logic here
    return result, nil
}
```

## License

MIT - Part of SuperAI CLI
