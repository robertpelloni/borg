# AGENTS.md - SuperAI CLI

> AI agent instructions for the SuperAI CLI "Mecha Suit" project.

## Project Overview

**SuperAI CLI** is a unified CLI/TUI aggregator that consolidates multiple AI coding tools (claude-code, qwen-code, opencode-autopilot, vibe-kanban, aider) into a single orchestrator interface. Think of it as a "Mecha Suit" that wraps around existing AI tools, providing a cohesive interface and shared tool execution layer.

### Tech Stack
- **Language**: Go 1.25.5 (chosen for goroutine concurrency, instant startup, single binary deployment)
- **TUI Framework**: Charm.sh ecosystem (Bubble Tea + Lip Gloss + Bubbles)
- **Architecture**: MVU (Model-View-Update) pattern
- **Concurrency**: Goroutines + channels for parallel agent execution

### Why Go (NOT Rust)
User explicitly rejected Rust. Go was chosen for:
- Goroutine-based concurrency (simpler than async/await)
- Fast compilation and instant startup
- Single binary deployment
- Mature TUI ecosystem (Charm.sh)

## Directory Structure

```
superai-cli/
├── cmd/superai/          # Entry point
│   └── main.go           # Creates tea.Program, launches TUI
├── internal/
│   ├── tui/              # Terminal UI layer
│   │   └── dashboard.go  # Main dashboard (sidebar, viewport, status bar)
│   ├── agent/            # Subprocess management
│   │   └── runner.go     # Spawns and streams agent processes
│   ├── config/           # Configuration system (v0.2.0+)
│   │   └── config.go     # YAML config loader, agent detection
│   ├── orchestrator/     # Tool execution engine
│   │   ├── registry.go   # Thread-safe tool registry
│   │   └── orchestrator.go # ReAct loop skeleton
│   └── mcp/              # MCP hub integration
│       └── client.go     # HTTP client for tool discovery
├── AGENTS.md             # This file
├── VERSION               # Single source of truth for version
├── CHANGELOG.md          # Release history
├── ROADMAP.md            # Development roadmap
├── README.md             # User documentation
└── go.mod                # Module: github.com/borg/superai-cli
```

## Configuration System (v0.2.0+)

### Config File Location
```
~/.superai/config.yaml
```

### Config Schema
```yaml
version: "0.2.0"
agents:
  - name: aichat
    command: aichat
    args: []
    description: "All-in-one LLM CLI (Rust) - REPL, shell assistant, RAG, agents"
    enabled: true
  - name: vibe-kanban
    command: npx
    args: ["vibe-kanban"]
    description: "Kanban board for AI coding agents"
    enabled: true
  - name: opencode
    command: opencode
    args: []
    description: "OpenCode AI coding assistant"
    enabled: true
  - name: claude-code
    command: claude
    args: []
    description: "Anthropic Claude CLI for coding"
    enabled: true
  - name: plandex
    command: plandex
    args: []
    description: "AI coding agent with planning capabilities"
    enabled: true
  - name: aider
    command: aider
    args: []
    description: "AI pair programming in your terminal"
    enabled: true
mcp_hub:
  url: "http://localhost:3000"
  enabled: true
```

### Adding a Custom Agent via Config
Edit `~/.superai/config.yaml`:
```yaml
agents:
  - name: my-agent
    command: /path/to/my-agent
    args: ["--some-flag"]
    dir: /working/directory  # optional
    description: "My custom agent"
    enabled: true
```

### Agent Detection
The config system auto-detects if agent binaries are available:
- Checks PATH environment variable
- Checks common install locations (~/.cargo/bin, ~/go/bin, etc.)
- Shows status indicator in sidebar:
  - `●` Green: Running
  - `○` Gray: Stopped (available)
  - `?` Orange: Not found in PATH
  - `✗` Red: Error

## Architecture

### MVU Pattern (Model-View-Update)
The TUI follows Bubble Tea's MVU architecture:
- **Model**: `DashboardModel` holds all state (viewport, agents, logs, etc.)
- **View**: `View()` renders the UI using Lip Gloss styles
- **Update**: `Update()` handles messages and user input

### Concurrency Model
```
┌─────────────────────────────────────────────────────────────┐
│                    DashboardModel                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Runner    │  │ Orchestrator│  │     MCP Client      │ │
│  │ (goroutines)│  │  (tool exec)│  │ (HTTP to localhost) │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          ▼                                  │
│                    logChan (chan string)                    │
│                          │                                  │
│                          ▼                                  │
│                    Viewport (logs)                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Config (`internal/config/config.go`)
Configuration management. ~180 lines.
- YAML-based config at `~/.superai/config.yaml`
- `Load()`: Reads config or returns defaults
- `Save()`: Writes config to disk
- `DetectAgent()`: Checks if binary exists in PATH
- Auto-creates config directory on first save

#### 2. Dashboard (`internal/tui/dashboard.go`)
Main TUI component. ~320 lines.
- **Layout**: Sidebar (agent list with status) | Viewport (logs) | Status bar
- **Styles**: Adaptive colors via `lipgloss.AdaptiveColor`
- **Hotkeys**: `q`/`Ctrl+C` quit, `j`/`k` navigate, `s`/`Enter` start agent, `t` test tool, `r` reload config
- **Channels**: `logChan` receives output from agents/tools

#### 3. Runner (`internal/agent/runner.go`)
Subprocess manager. 86 lines.
- Spawns external processes (claude-code, qwen-code, etc.)
- Streams stdout/stderr via `bufio.Scanner` to channel
- Thread-safe agent map with `sync.RWMutex`

#### 4. Registry (`internal/orchestrator/registry.go`)
Tool registry. 64 lines.
- `ToolDefinition`: Name, Description, InputSchema (JSON Schema)
- `Tool`: Definition + Handler function
- Thread-safe with `sync.RWMutex`

#### 5. Orchestrator (`internal/orchestrator/orchestrator.go`)
ReAct loop engine. 48 lines.
- `ExecuteTool()`: Looks up and runs tool handler
- `RunLoop()`: Placeholder for LLM-driven orchestration (not yet implemented)

#### 6. MCP Client (`internal/mcp/client.go`)
MCP hub integration. 45 lines.
- Connects to borg MCP hub at `localhost:3000`
- `ListTools()`: GET /api/hub/tools → []HubTool

## Development Guidelines

### Building
```bash
go build ./cmd/superai        # Build binary
go run ./cmd/superai          # Run directly
```

### Adding a New Tool (Programmatic)
```go
// In dashboard.go or separate file
registry.Register(&orchestrator.Tool{
    Definition: orchestrator.ToolDefinition{
        Name:        "tool_name",
        Description: "What the tool does",
        InputSchema: map[string]interface{}{"type": "object"},
    },
    Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
        // Implementation
        return result, nil
    },
})
```

### Adding a New Agent (Programmatic)
```go
runner.AddAgent(&agent.Agent{
    Name:    "agent-name",
    Command: "binary-name",
    Args:    []string{"--flag"},
    Dir:     "/working/directory",
})
```

### Code Style
- Follow standard Go conventions (`gofmt`, `go vet`)
- Use `context.Context` for cancellation
- Channel-based communication between goroutines
- `sync.RWMutex` for shared state

## Hotkeys Reference

| Key | Action |
|-----|--------|
| `j` / `↓` | Navigate down |
| `k` / `↑` | Navigate up |
| `s` / `Enter` | Start selected agent |
| `t` | Test tool execution (ls) |
| `r` | Reload configuration |
| `q` / `Ctrl+C` | Quit |

## Anti-Patterns (DO NOT)

1. **Never use `as any` or type assertions without checks** - Go is statically typed
2. **Never block the main goroutine** - Use channels for async communication
3. **Never ignore errors** - Always handle or propagate
4. **Never use global state** - Pass dependencies explicitly
5. **Never taskkill all nodes** - This kills user sessions

## Integration Points

### MCP Hub (borg)
The CLI connects to the borg MCP hub running at `localhost:3000`:
- Tool discovery: `GET /api/hub/tools`
- Tool execution: (planned) `POST /api/hub/tools/{name}/execute`

### Discovered Submodule Agents
Located in parent repo at `C:\Users\hyper\workspace\borg\submodules\`:

| Agent | Type | Invocation |
|-------|------|------------|
| `aichat` | Rust CLI | `aichat` |
| `vibe-kanban` | NPM CLI | `npx vibe-kanban` |
| `mcp-cli` | NPM CLI | `npx mcpc` |
| `mcp-zen` | NPM CLI | `npx zen-mcp-server` |
| `ii-agent` | Python | `python src/ii_tool/integrations/app/main.py` |
| `opencode-autopilot` | TS Plugin | OpenCode plugin (not standalone) |
| `jules-autopilot` | Next.js App | `npm run dev` |

## Versioning

- Version stored in `VERSION` file (single source of truth)
- Every release should increment version
- Changelog maintained in `CHANGELOG.md`
- Commit messages should reference version bumps

## Future Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development phases:

1. ✅ **v0.1.0** - Foundation (TUI, Runner, Registry)
2. ✅ **v0.2.0** - Agent Integration (config system, binary detection)
3. 🔜 **v0.3.0** - Tool Execution (MCP hub integration)
4. 🔜 **v0.4.0** - ReAct Orchestration (LLM-driven)
5. 🔜 **v0.5.0** - Multi-Agent Collaboration
6. 🔜 **v0.6.0** - Session Persistence
7. 🔜 **v0.7.0** - Advanced UI
8. 🔜 **v0.8.0** - Plugin System
