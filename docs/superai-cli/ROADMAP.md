# SuperAI CLI Roadmap

> Development roadmap for the "Mecha Suit" orchestrator.

## Current Status: v1.5.0 (Production Ready)

✅ TUI Dashboard with Bubble Tea  
✅ Agent subprocess runner with streaming  
✅ Tool registry and orchestration skeleton  
✅ MCP hub client for tool discovery  
✅ Configuration system with agent detection  
✅ MCP tool execution with dual-panel UI  
✅ ReAct orchestration with LLM integration  
✅ Multi-agent collaboration system  
✅ Session persistence and replay  
✅ Advanced UI components (tabs, spinners, search/filter)  
✅ Plugin system with dynamic loading  
✅ Plugin SDK with example plugins  
✅ Metrics dashboard with cost tracking  
✅ Git integration with status overlay  
✅ Remote agents (SSH, Docker, Kubernetes)  
✅ Plugin marketplace  
✅ Voice input (speech-to-text)  
✅ Web UI (browser-based alternative)  

---

## Phase 1: Agent Integration (v0.2.0) ✅

**Goal**: Wire real agent binaries and enable basic agent switching.

### Completed
- [x] Configure actual binary paths for submodule agents
- [x] Implement agent detection (check if binaries exist)
- [x] Add agent configuration file (`~/.superai/config.yaml`)
- [x] Enable agent launching with `s` hotkey
- [x] Display real-time output in viewport
- [x] Handle agent lifecycle (start/stop/restart)

---

## Phase 2: Tool Execution (v0.3.0) ✅

**Goal**: Execute MCP tools through the borg hub.

### Completed
- [x] Implement `POST /api/hub/tools/{name}/execute` client
- [x] Add tool selection UI (dual-panel sidebar)
- [x] Support tool arguments via input prompts
- [x] Display tool results in viewport
- [x] Hub connection status indicator

---

## Phase 3: ReAct Orchestration (v0.4.0) ✅

**Goal**: LLM-driven tool selection and multi-step reasoning.

### Completed
- [x] Integrate LLM provider (OpenAI-compatible)
- [x] Implement ReAct loop (Thought-Action-Observation)
- [x] Add conversation history management
- [x] Implement tool result parsing
- [x] Add token usage tracking
- [x] Chat interface with `/` or `c` hotkey

---

## Phase 4: Multi-Agent Collaboration (v0.5.0) ✅

**Goal**: Parallel agent execution with result aggregation.

### Completed
- [x] Design agent collaboration protocol
- [x] Implement parallel agent spawning with goroutines
- [x] Add result aggregation (first, all, majority, best, merge, consensus)
- [x] Create agent communication channels (MessageBus)
- [x] Agent pool with role-based specialties
- [x] `Ctrl+P` for parallel task execution

---

## Phase 5: Session Persistence (v0.6.0) ✅

**Goal**: Save and restore orchestration sessions.

### Completed
- [x] Design session state schema (Session, Message, Checkpoint)
- [x] Implement session serialization (JSON to ~/.superai/sessions/)
- [x] Add session list/load/save UI (Ctrl+S, Ctrl+L, Ctrl+N)
- [x] Enable session sharing/export/import
- [x] Add session replay functionality
- [x] Auto-save on quit

---

## Phase 6: Advanced UI (v0.7.0) ✅

**Goal**: Enhanced TUI with panels, tabs, and visualizations.

### Completed
- [x] Add tabbed interface for multiple agents
- [x] Implement split-pane layouts
- [x] Add progress indicators and spinners
- [x] Create tool execution visualization
- [x] Add syntax highlighting for code output
- [x] Implement search/filter for logs

---

## Phase 7: Plugin System (v0.8.0) ✅

**Goal**: Extensible architecture for custom agents and tools.

### Completed
- [x] Define plugin interface specification
- [x] Implement plugin discovery and loading
- [x] Add plugin lifecycle management
- [x] Create plugin manager with typed getters
- [x] Build plugin list UI with hotkey `p`

### Technical Notes
- Go plugin system for .so/.dll/.dylib files
- Plugins stored in `~/.superai/plugins/`
- AgentPlugin, ToolPlugin, ThemePlugin interfaces

---

## Phase 8: Plugin SDK (v0.9.0) ✅

**Goal**: Developer tools and examples for plugin creation.

### Completed
- [x] Plugin SDK package with base implementations
- [x] BasePlugin, BaseAgentPlugin, BaseToolPlugin, BaseThemePlugin
- [x] Helper functions (ParseArgs, NewToolDef, property builders)
- [x] Example agent plugin (hello-agent)
- [x] Example tool plugin (hello-tool with 4 tools)
- [x] Example theme plugin (neon-theme)
- [x] Cross-platform build script (scripts/build-plugins.sh)

### Technical Notes
- SDK in `internal/plugin/sdk.go`
- Examples in `examples/plugins/`
- Generic ParseArgs[T] for type-safe argument parsing
- Property builders for JSON Schema generation

---

## Phase 9: Metrics Dashboard (v1.0.0) ✅

**Goal**: Real-time usage tracking and cost monitoring.

### Completed
- [x] Metrics collector with thread-safe recording
- [x] Token usage tracking (input, output, total)
- [x] Cost calculation with provider-specific pricing
- [x] Request success/failure tracking
- [x] Duration measurement per request
- [x] Metrics overlay UI with `Ctrl+M` hotkey
- [x] Per-provider and per-model breakdowns
- [x] Recent requests list with status indicators

### Technical Notes
- Metrics stored in `internal/metrics/`
- Auto-cost calculation based on model pricing
- Rolling buffer of 10,000 requests max
- Real-time updates in overlay

---

## Phase 10: Git Integration (v1.1.0) ✅

**Goal**: Built-in git operations and repository status tracking.

### Completed
- [x] Git client with thread-safe operations
- [x] Repository detection and status tracking
- [x] Branch info with ahead/behind counts
- [x] File status tracking (staged, modified, untracked)
- [x] Full git operations (add, commit, push, pull, fetch, stash, etc.)
- [x] Git overlay UI with `g` hotkey
- [x] GIT section in sidebar with branch and dirty indicator
- [x] Conflict detection

### Technical Notes
- Git operations in `internal/git/`
- Commands executed via `os/exec`
- Thread-safe with `sync.RWMutex`

---

## Phase 11: Remote Agents (v1.2.0) ✅

**Goal**: Execute agents on remote hosts via SSH, Docker, or Kubernetes.

### Completed
- [x] RemoteHost configuration struct
- [x] RemoteConnection with state management
- [x] RemoteManager for host/connection lifecycle
- [x] SSH connections with key-based auth
- [x] Docker container execution
- [x] Kubernetes pod execution
- [x] Local subprocess execution
- [x] Command execution with streaming
- [x] Latency measurement (ping)
- [x] SSH config resolution (~/.ssh/config)
- [x] Helper functions for testing connections
- [x] Remote overlay UI with `R` hotkey

### Technical Notes
- Remote configs in `~/.superai/remotes.json`
- Persistent shell sessions for SSH/Docker/K8s
- Thread-safe with `sync.RWMutex`

---

## Phase 12: Plugin Marketplace (v1.3.0) ✅

**Goal**: Browse, search, install, and update community plugins.

### Completed
- [x] PluginInfo metadata struct
- [x] Registry with categories and featured plugins
- [x] Marketplace client with HTTP sync
- [x] Search by name, description, tags
- [x] Category and featured browsing
- [x] Plugin install/uninstall/update
- [x] Multi-platform binary distribution
- [x] Enable/disable installed plugins
- [x] Marketplace overlay UI with `M` hotkey
- [x] Download/star counts and badges
- [x] Sample registry with example plugins

### Technical Notes
- Config in `~/.superai/marketplace.json`
- Cache in `~/.superai/cache/registry.json`
- Plugins in `~/.superai/plugins/`

---

## Phase 13: Voice Input (v1.4.0) ✅

**Goal**: Hands-free operation with speech-to-text transcription.

### Completed
- [x] VoiceConfig for provider/API settings
- [x] VoiceInput state machine (idle, listening, processing)
- [x] TranscriptionResult with confidence and segments
- [x] Multiple providers (whisper_api, whisper, google, azure, local)
- [x] Platform-specific recording (macOS sox, Linux arecord, Windows PowerShell)
- [x] Auto-detection of recording tools
- [x] Voice hotkey `V` to toggle recording
- [x] Transcribed text auto-fills chat input
- [x] OpenAI Whisper API integration with multipart uploads

### Technical Notes
- Voice package in `internal/voice/`
- Temp files in `~/.superai/voice/temp/`
- WAV format at 16kHz mono for optimal STT

---

## Phase 14: Web UI (v1.5.0) ✅

**Goal**: Browser-based alternative to the TUI interface.

### Completed
- [x] HTTP server with REST API
- [x] WebSocket hub for real-time updates
- [x] Embedded static file server
- [x] REST endpoints for agents, tools, sessions, metrics, config, logs, chat
- [x] Modern dark theme frontend
- [x] Agent sidebar with start/stop controls
- [x] Chat interface with message history
- [x] Tools panel with tool list
- [x] Live log viewer
- [x] Metrics display
- [x] WebSocket auto-reconnection
- [x] Dashboard `W` hotkey to toggle web server

### Technical Notes
- Web package in `internal/web/`
- Static files embedded via `//go:embed`
- Default server at `localhost:8080`
- CORS enabled for cross-origin requests

---

## Future Phases (v1.6.0 - v2.5.0)

See [ROADMAP-EXTENDED.md](./ROADMAP-EXTENDED.md) for advanced phases including:

| Version | Focus | Key Features |
|---------|-------|--------------|
| v1.6.0 | Enhanced MCP | Full MCP protocol (stdio + SSE), aggregator pattern, server mode |
| v1.7.0 | Advanced Agent | Plan/Act/Verify loop, rules system (.superai/rules/*.mdc) |
| v1.8.0 | Context System | Context providers, memory bank, custom slash commands |
| v1.9.0 | RAG System | Vector DB, embeddings, hybrid search (HNSW + BM25) |
| v1.10.0 | Architect Mode | Two-model approach (reasoning + editing), model roles |
| v2.0.0 | VS Code Extension | Chat Participants API, Webview panels, TreeView sidebar |
| v2.1.0 | JetBrains Plugin | Kotlin plugin, Tool Windows, ACP/MCP integration |
| v2.2.0 | Zed Extension | Rust/WASM, Agent Server (ACP), slash commands |
| v2.3.0 | Neovim Plugin | Lua plugin, Telescope integration, treesitter |
| v2.4.0 | Cursor & VS | MCP integration, VSIX for Visual Studio |
| v2.5.0 | Agent Council | Democratic debate, git worktree isolation |

Also see [FEATURE-MATRIX.md](./FEATURE-MATRIX.md) for comparison with other AI coding tools.

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0 | 2026-01-09 | Foundation - TUI, Runner, Registry |
| 0.2.0 | 2026-01-09 | Agent Integration |
| 0.3.0 | 2026-01-09 | Tool Execution |
| 0.4.0 | 2026-01-09 | ReAct Orchestration |
| 0.5.0 | 2026-01-09 | Multi-Agent Collaboration |
| 0.6.0 | 2026-01-09 | Session Persistence |
| 0.7.0 | 2026-01-09 | Advanced UI |
| 0.8.0 | 2026-01-09 | Plugin System |
| 0.9.0 | 2026-01-09 | Plugin SDK |
| 1.0.0 | 2026-01-09 | Production Ready - Metrics Dashboard |
| 1.1.0 | 2026-01-09 | Git Integration |
| 1.2.0 | 2026-01-09 | Remote Agents |
| 1.3.0 | 2026-01-09 | Plugin Marketplace |
| 1.4.0 | 2026-01-09 | Voice Input |
| 1.5.0 | 2026-01-09 | Web UI |

---

## Contributing

See [AGENTS.md](./AGENTS.md) for development guidelines and architecture details.
