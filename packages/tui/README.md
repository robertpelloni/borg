# SuperAI TUI - Borg Terminal Orchestrator

> Go-based terminal UI for orchestrating AI coding tools within the Borg ecosystem

## Overview

This package provides a powerful terminal user interface (TUI) built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) and [Lip Gloss](https://github.com/charmbracelet/lipgloss) for orchestrating multiple AI coding assistants. It serves as the interactive frontend for the Borg Meta-Orchestrator.

## Features

| Feature | Description |
|---------|-------------|
| **TUI Dashboard** | Interactive terminal interface with real-time status |
| **Agent Runner** | Subprocess management for AI coding tools |
| **Tool Registry** | JSON Schema-based tool definitions |
| **ReAct Loop** | Plan/Act/Verify autonomous execution |
| **Multi-Agent** | MessageBus with 6 aggregation modes |
| **Session Persistence** | Save/load sessions with checkpointing |
| **Plugin System** | Native plugins (.so/.dll/.dylib) |
| **MCP Integration** | Connects to Borg Core at localhost:3000 |
| **Git Integration** | Status, commit, conflict detection |
| **Voice Input** | Whisper API speech-to-text |
| **Remote Agents** | SSH, Docker, Kubernetes backends |
| **Metrics** | Cost tracking, token usage, response times |

## Prerequisites

- Go 1.25.5 or later
- Borg Core Service running at localhost:3000

## Installation

```bash
# From Borg root
cd packages/tui

# Build the binary
go build -o superai ./cmd/superai

# Or install to $GOPATH/bin
go install ./cmd/superai
```

## Usage

```bash
# Start the TUI
./superai

# Start with specific config
./superai --config ~/.superai/config.yaml

# Start web UI mode
./superai --web --port 8080
```

## Configuration

Default config location: `~/.superai/config.yaml`

```yaml
# MCP Hub connection (Borg Core)
mcp:
  hub_url: "http://localhost:3000"
  api_key: "${AIOS_API_KEY}"

# Default LLM provider
llm:
  provider: "anthropic"
  model: "claude-sonnet-4-20250514"
  api_key: "${ANTHROPIC_API_KEY}"

# Agent settings
agent:
  mode: "plan-act-verify"
  max_iterations: 10
  auto_approve: false

# Multi-agent collaboration
collaboration:
  enabled: true
  aggregation: "consensus"  # first, all, majority, best, merge, consensus

# Session persistence
session:
  auto_save: true
  save_path: "~/.superai/sessions/"
```

## Directory Structure

```
packages/tui/
├── cmd/superai/          # Main entry point
│   └── main.go
├── internal/
│   ├── agent/            # Agent subprocess management
│   ├── architect/        # Architect mode (two-model)
│   ├── collaboration/    # Multi-agent coordination
│   ├── config/           # YAML configuration
│   ├── context/          # Context providers
│   ├── git/              # Git operations
│   ├── llm/              # LLM provider abstraction
│   ├── marketplace/      # Plugin marketplace
│   ├── mcp/              # MCP hub client
│   ├── metrics/          # Usage/cost tracking
│   ├── model/            # Data models
│   ├── orchestrator/     # Tool execution & ReAct
│   ├── plugin/           # Plugin system
│   ├── provider/         # Provider abstraction
│   ├── rag/              # RAG system (HNSW + BM25)
│   ├── remote/           # SSH/Docker/K8s execution
│   ├── rules/            # Rules engine (.mdc)
│   ├── session/          # Session persistence
│   ├── tui/              # Bubble Tea components
│   ├── voice/            # Whisper speech-to-text
│   └── web/              # Web UI server
├── examples/             # Example configurations
├── scripts/              # Build/test scripts
├── go.mod
└── go.sum
```

## Integration with Borg Core

The TUI connects to Borg Core Service for:

1. **MCP Tool Access**: All registered MCP servers and tools
2. **Memory System**: Shared RAG and memory consolidation
3. **Agent Registry**: Access to defined agents and skills
4. **Council Debates**: Multi-model consensus via Council API

```go
// Example: Calling Borg Core from TUI
client := mcp.NewHubClient("http://localhost:3000", apiKey)
result, err := client.CallTool("filesystem", "read_file", map[string]any{
    "path": "/path/to/file.ts",
})
```

## Development

```bash
# Run tests
go test ./...

# Run with hot reload (requires air)
air

# Build for all platforms
./scripts/build-all.sh
```

## Documentation

- [Feature Matrix](../../docs/superai-cli/FEATURE-MATRIX.md) - AI coding tools comparison
- [Roadmap](../../docs/superai-cli/ROADMAP.md) - Development timeline
- [Agent Specs](../../docs/superai-cli/AGENTS.md) - Agent definition schemas
- [Changelog](../../docs/superai-cli/CHANGELOG.md) - Version history

## Related Packages

- `packages/core` - Borg Core Service (Fastify backend)
- `packages/ui` - Borg Dashboard (Next.js frontend)
- `packages/cli` - Borg CLI (Node.js)

## License

MIT - See [LICENSE](../../LICENSE) for details.
