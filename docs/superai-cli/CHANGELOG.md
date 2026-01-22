# Changelog

All notable changes to SuperAI CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.10.0] - 2026-01-10

### Added
- **Architect Mode** (`internal/architect/`)
  - `architect.go`: Two-model approach (reasoning + editing), thought chain tracking
  - `router.go`: Model routing by role, backend abstraction, capability-aware selection
  - `session.go`: Session management, conversation history, thinking display

---

## [2.9.0] - 2026-01-10

### Added
- **RAG System** (`internal/rag/`)
  - `vector.go`: HNSW index with cosine similarity, save/load persistence
  - `embeddings.go`: OpenAI and Ollama embedding providers with caching
  - `loader.go`: Source code and markdown document loaders with .gitignore support
  - `search.go`: BM25 keyword search and hybrid search (vector + BM25)
  - `index.go`: Unified index with auto-indexing, incremental updates, context building

---

## [2.8.0] - 2026-01-10

### Added
- **Directory Navigation Tools**
  - `directory_tree`: Recursive directory structure with depth control and hidden file toggle
  
- **Git Workflow Tools**
  - `git_add`: Stage files for commit
  - `git_commit`: Create commits with messages
  - `git_branch`: List, create, switch, or delete branches

- **Code Analysis Tools**
  - `find_in_files`: Find symbol definitions and patterns with context lines

---

## [2.7.0] - 2026-01-10

### Added
- **Additional Built-in Tools**
  - `grep_search`: Regex-based content search with file glob filtering (cross-platform)
  - `git_status`: Get repository status including branch and modified files
  - `git_diff`: Show staged or unstaged changes with optional file filter
  - `git_log`: Show recent commit history with configurable count and format

### Changed
- **Enhanced ReAct Log Highlighting**
  - `[Thought]` tags now display in yellow/bold for visibility
  - `[Action]` tags display in green/bold with pink tool names
  - `[Observation]` tags display in cyan/italic with pink tool names
  - Dedicated regex patterns for ReAct output parsing

---

## [2.6.0] - 2026-01-10

### Added
- **Built-in Tools for ReAct Loop**
  - `ls`: List files with path parameter and detailed output
  - `read_file`: Read file contents
  - `write_file`: Write content to files
  - `shell_exec`: Execute shell commands (cross-platform: cmd on Windows, sh on Unix)
  - `search_files`: Glob-based file search
  - `get_cwd`: Get current working directory

### Changed
- Status bar now shows active chat modes: `[S]` for streaming, `[R]` for ReAct
- Help section updated with `^s stream  ^r react` hotkey hints

---

## [2.5.0] - 2026-01-10

### Added
- **Streaming Chat Support**
  - `sendChatStream()`: Stream tokens in real-time via LLMBridge
  - `readNextStreamToken()`: Continuous channel-based token reading
  - `Ctrl+S` hotkey to toggle streaming mode ON/OFF
  - `streamTokenCh`, `streamErrCh`, `streamBuffer` fields in DashboardModel
- **ReAct Loop Integration**
  - `sendChatReAct()`: Execute tool-enabled chat via ReAct loop
  - `Ctrl+R` hotkey to toggle ReAct mode (tools enabled)
  - `InitReActLoop(registry)` called during dashboard initialization
  - `useReAct` field in DashboardModel for mode tracking
- **Conversation Persistence via LLMBridge**
  - `AddUserMessage()`: Add user message to LLMBridge conversation
  - `AddAssistantMessage()`: Add assistant message to LLMBridge conversation
  - Session restore now populates both LLMBridge and legacy ReactEngine
  - Session save now pulls history from LLMBridge when available

### Changed
- Chat Enter handler now routes: ReAct → Streaming → Standard (priority order)
- `ClearHistory()` now clears both LLMBridge and ReactEngine
- `GetHistory()` prioritizes LLMBridge over ReactEngine

---

## [2.4.0] - 2026-01-10

### Added
- **LLMBridge Chat Integration**
  - `IsReady()`: Check if any LLM provider (legacy or new) is configured and ready
  - `GetProviderName()`: Get active provider name with fallback chain (activeProvider → legacyProvider → "unknown")
  - `sendChat()` now routes through LLMBridge when available, falls back to legacy ReactEngine

### Changed
- `ChatResponseMsg` handler now fetches provider/model info from LLMBridge first
- Removed duplicate `ChatStreamChunkMsg` and `ChatStreamDoneMsg` type declarations (already in chat.go)

### Fixed
- Build error from duplicate message type declarations between dashboard.go and chat.go

---

## [2.3.0] - 2026-01-10

### Added
- **LLMBridge Integration into Dashboard**
  - `llmBridge` field in `DashboardModel` for unified LLM access
  - Bridge initialization in `NewDashboard()` with provider setup
  - Real-time callbacks for thought/action/observation logging to viewport

- **Provider Selection Overlay** (`P` hotkey)
  - List all registered providers from LLMBridge
  - Navigate providers with `j`/`k` or `↑`/`↓`
  - Navigate models within provider with `h`/`l` or `←`/`→`
  - Select provider/model with `Enter`
  - Toggle between legacy and new multi-provider system with `n`
  - Shows active provider/model status

- **LLMBridge Enhancements** (`internal/tui/llmbridge.go`)
  - `activeProvider` field for tracking current selection
  - `GetActiveProvider()`: Get currently active provider name
  - `SetActiveProvider()`: Switch active provider with model selection

### Changed
- Dashboard initializes all configured providers on startup
- Provider system now accessible from TUI via overlay

### Technical Details
- Provider overlay renders full-screen with provider/model columns
- Adaptive colors for selected/active items
- Thread-safe provider switching via LLMBridge mutex

---

## [2.2.0] - 2026-01-09

### Added
- **LLM Bridge Layer** (`internal/tui/llmbridge.go`)
  - `LLMBridge`: Unified interface bridging old `internal/llm/` and new `internal/orchestrator/` systems
  - `BridgeConfig`: Configuration for system selection, model, tokens, persona
  - Seamless toggle between legacy and new provider systems via `useNewSystem` flag

- **Bridge Methods**
  - `Chat()` / `ChatStream()`: Synchronous and streaming chat with automatic system routing
  - `RunReAct()`: ReAct loop execution through either legacy or new orchestrator
  - `RegisterTool()`: Tool registration with automatic handler adaptation between systems
  - `SetCallbacks()`: Unified callback system for thought/action/observation events
  - `InitNewProvider()` / `InitLegacyProvider()`: Provider initialization for both systems
  - `InitReActLoop()`: Initialize new orchestrator's ReAct loop with conversation support

- **Provider Management**
  - `ListProviders()`: List all registered providers with capabilities
  - `SelectProvider()`: Switch active provider
  - `GetTotalUsage()`: Aggregate token usage tracking

- **System Interoperability**
  - Handler adaptation: Converts between `map[string]interface{}` (legacy) and `json.RawMessage` (new)
  - Callback bridging: Translates callback signatures between systems
  - Message conversion: `GetHistory()` returns `llm.Message` from either system

### Changed
- Dashboard can now leverage both v2.0.0 provider system and legacy LLM package
- Orchestrator integration preparation complete for TUI

### Technical Details
- New file: `internal/tui/llmbridge.go` (~480 lines)
- Thread-safe with `sync.RWMutex` for all operations
- Supports conversation management via orchestrator.Conversation
- Prompter integration with persona support
- ReAct loop with configurable callbacks for UI integration

---

## [2.1.0] - 2026-01-09

### Added
- **Enhanced Orchestrator** (`internal/orchestrator/`)
  - `LLMClient`: Provider-agnostic LLM client with multi-provider support
  - `ReActLoop`: Full ReAct (Reasoning+Acting) implementation with state machine
  - `Prompter`: Configurable system prompts with personas and tool formatting
  - `Conversation`: Thread-safe conversation history with token management

- **LLM Client** (`internal/orchestrator/llm.go`)
  - `Chat()` and `ChatStream()` for synchronous and streaming completions
  - `ChatMultiple()` with parallel, fastest, and consensus strategies
  - `SelectModel()`, `SelectCheapest()`, `SelectFastest()` for model selection
  - Token counting and automatic message truncation
  - Provider inference from model names

- **ReAct Loop** (`internal/orchestrator/react.go`)
  - State machine: idle→thinking→acting→observing→answering→complete
  - Parallel tool execution support
  - Configurable max iterations, tool calls, and timeouts
  - Auto-approve with dangerous tool detection
  - Event callbacks: OnThought, OnAction, OnObservation, OnAnswer, OnStream
  - `StreamingReActLoop` for real-time event streaming

- **Prompt System** (`internal/orchestrator/prompt.go`)
  - Multiple personas: default, coder, analyst, creative
  - Tool list formatting with JSON schema
  - Tool result formatting with truncation
  - XML and JSON tool call parsing
  - Thinking tag extraction

- **Conversation Management** (`internal/orchestrator/conversation.go`)
  - Token-aware message history
  - Automatic compaction when exceeding limits
  - `Fork()` and `Branch()` for conversation branching
  - `ConversationStore` for multi-conversation management
  - Snapshot serialization for persistence

- **Chat Component** (`internal/tui/chat.go`)
  - Bubble Tea chat component with streaming support
  - Tool call visualization with status icons
  - Thinking display toggle
  - Word wrapping and timestamp formatting
  - History export/import

### Changed
- Dashboard version updated to v2.1.0
- Orchestrator now integrates with v2.0.0 provider system

### Technical Details
- New files in `internal/orchestrator/`: `llm.go`, `react.go`, `prompt.go`, `conversation.go`
- New file: `internal/tui/chat.go`
- ~2,200 lines of new orchestrator infrastructure
- ReAct loop supports 20 max iterations, 50 max tool calls by default
- Conversation compaction preserves last 10 messages

---

## [2.0.0] - 2026-01-09

### Added
- **Multi-Provider System** (`internal/provider/`)
  - Unified provider abstraction supporting multiple LLM backends
  - Provider registry with auto-discovery from environment variables
  - Factory pattern for dynamic provider instantiation

- **LLM Providers**
  - `OpenAIProvider`: Full OpenAI API support with streaming, tool calling, vision
  - `AnthropicProvider`: Claude API with extended thinking, vision, caching
  - `GoogleProvider`: Gemini API (2.0-flash-exp, 1.5-pro, 1.5-flash) with safety settings
  - `OllamaProvider`: Local Ollama with model pull/delete, streaming

- **Smart Routing** (`internal/provider/router.go`)
  - 7 routing strategies: priority, round_robin, weighted, least_load, latency, cost_optimal, failover
  - Circuit breaker pattern (closed/open/half-open states)
  - Retry policy with exponential backoff + jitter
  - Load balancer with active connection tracking
  - `RouteMultiple()`: Parallel provider requests
  - `RouteFastest()`: Race providers for fastest response
  - `RouteConsensus()`: Multi-provider agreement

- **Model System** (`internal/model/`)
  - `Model` struct with capabilities, pricing, performance tiers
  - `ModelFamily` constants (GPT-4, Claude-3, Gemini, Llama, Qwen, etc.)
  - `SpeedTier` and `QualityTier` enums for categorization
  - `TaskType` for task-based model selection
  - 20+ pre-configured models with context limits and pricing

- **Model Selection** (`internal/model/selector.go`)
  - `Selector` with preference-based scoring algorithm
  - `Select()`: General purpose selection with weights
  - `SelectForTask()`: Task-optimized selection (coding, reasoning, vision, creative)
  - `SelectCheapest()`, `SelectFastest()`, `SelectBestQuality()`, `SelectLocal()`
  - Caching with TTL for repeated selections

- **Provider Configuration** (`internal/config/config.go`)
  - `ProviderConfig`: Name, type, API key (env var), base URL, enabled
  - `RoutingConfig`: Strategy, retries, timeouts, circuit breaker settings
  - `ModelSelConfig`: Preferences for quality, speed, cost weights
  - Default providers: OpenAI, Anthropic, Google, Ollama

- **Dashboard Enhancements**
  - PROVIDERS section in sidebar showing enabled/total count
  - Provider status indicators (● enabled, ○ disabled)
  - Routing strategy display
  - Version updated to v2.0.0

### Changed
- Config version updated to 2.0.0
- Dashboard version updated to v2.0.0
- `ProvidersConfig` added to main Config struct

### Technical Details
- New package: `internal/provider/` (~2,900 lines)
  - `provider.go` (~370 lines): Core interfaces and types
  - `registry.go` (~350 lines): Provider registry with discovery
  - `openai.go` (~675 lines): OpenAI implementation
  - `anthropic.go` (~480 lines): Anthropic implementation
  - `google.go` (~580 lines): Google Gemini implementation
  - `ollama.go` (~650 lines): Ollama local implementation
  - `router.go` (~750 lines): Smart routing system
- New package: `internal/model/` (~1,050 lines)
  - `model.go` (~550 lines): Model definitions
  - `selector.go` (~500 lines): Model selection
- Circuit breaker: 5 failure threshold, 30s recovery
- Retry: 3 attempts, 1s base delay, 2x multiplier, 0.1 jitter
- Load balancer tracks active connections per provider

---

## [1.9.0] - 2026-01-09

### Added
- **Enhanced Plugin Architecture** (`internal/plugin/`)
  - Complete plugin system rewrite with production-ready infrastructure
  - Hot-reload support with file watching and hash-based change detection
  - Lifecycle management with health checks and state machine
  - Dependency resolution with cycle detection
  - Resource sandboxing with violation tracking
  - Event system with pub/sub and hook management

- **Plugin Loader** (`internal/plugin/loader.go`)
  - `Loader`: Dynamic plugin loading with hot-reload support
  - `LoaderConfig`: WatchInterval, AutoReload, PluginDir settings
  - `PluginManifest`: JSON manifest for plugin metadata
  - `LoadedPluginInfo`: Runtime info with hash, load time, dependencies
  - File watcher with debounced reload on changes
  - Event types: Discovered, Loaded, Reloaded, Unloaded, Error, Changed

- **Plugin Lifecycle** (`internal/plugin/lifecycle.go`)
  - `LifecycleState`: State machine (unloaded→loaded→initializing→ready→running→stopping→stopped→error)
  - `HealthStatus`: Healthy, Degraded, Unhealthy with message and timestamp
  - `HealthCheck`: Configurable health checks with intervals and thresholds
  - `PluginLifecycle`: Per-plugin lifecycle with hooks (pre/post init/start/stop, error)
  - `LifecycleManager`: Manage multiple plugin lifecycles concurrently

- **Plugin Registry** (`internal/plugin/registry.go`)
  - `Registry`: Thread-safe plugin registration with capabilities tracking
  - `DependencyNode`: Dependency graph node with version constraints
  - `ResolveDependencies()`: Topological sort with cycle detection
  - `ResolveAll()`: Batch resolution for all registered plugins
  - Conflict detection between incompatible plugins

- **Plugin Sandbox** (`internal/plugin/sandbox.go`)
  - `ResourceLimits`: Memory, CPU, goroutines, file descriptors, network
  - `Permission`: Read, Write, Execute, Network, System permission flags
  - `SandboxConfig`: Configurable limits and allowed paths/hosts
  - `Sandbox`: Runtime sandbox with violation tracking
  - `SandboxManager`: Manage multiple sandboxes with global limits

- **Plugin Events** (`internal/plugin/events.go`)
  - `EventType`: Plugin, Tool, Agent, System event categories
  - `EventBus`: Pub/sub with filtering, priorities, and metrics
  - `HookManager`: Hook points (BeforeLoad, AfterLoad, BeforeStart, etc.)
  - Priority-based hook execution with error handling
  - Event metrics: published count, subscriber count, dropped count

- **Enhanced Plugin SDK** (`internal/plugin/sdk.go`)
  - `BasePlugin`: Enhanced with EventBus, HookManager, Sandbox, Logger, Metrics
  - `BaseAgentPlugin`: Capabilities, maxTokens, temperature settings
  - `BaseToolPlugin`: Middleware chain support for tool execution
  - `BaseThemePlugin`: Dark mode, font family, font size, spacing
  - `BaseProviderPlugin`: LLM provider plugin base (NEW)
  - `BaseStoragePlugin`: Storage backend plugin base (NEW)
  - `BaseTransportPlugin`: Transport layer plugin base (NEW)
  - `PluginBuilder`: Fluent API for plugin construction
  - Middleware helpers: Logging, Timeout, Retry, Validation
  - Theme presets: Default, Light, Monokai, Nord color schemes

- **Plugin Configuration** (`internal/config/config.go`)
  - `PluginConfig`: HotReload, WatchIntervalMs, PluginDir
  - `PluginSandboxConfig`: Resource limits and permissions
  - `PluginLifecycleConfig`: Timeouts, health check settings
  - `PluginEventBusConfig`: Buffer size, worker count
  - `PluginInstanceConfig`: Per-plugin overrides

- **Dashboard Enhancements**
  - PLUGINS section shows active/loaded/error counts with icons
  - Hot-reload indicator when enabled
  - Version updated to v1.9.0

### Changed
- Dashboard version updated to v1.9.0
- Plugin types extended: Provider, Storage, Transport
- Config struct includes Plugin field with nested configs

### Technical Details
- New files: `loader.go` (~560 lines), `lifecycle.go` (~500 lines), `registry.go` (~400 lines), `sandbox.go` (~450 lines), `events.go` (~450 lines)
- Enhanced: `sdk.go` (~750 lines), `plugin.go`, `config.go`
- ~3,100 lines of new plugin infrastructure
- State machine with 8 lifecycle states
- Event bus supports 1000+ events/sec with buffering
- Sandbox tracks violations with timestamps

---

## [1.8.0] - 2026-01-09

### Added
- **Context System** (`internal/context/`)
  - Flexible context management for LLM prompts with token budget awareness
  - Provider-based architecture for different context sources
  - Progressive focus chain for layered context building
  - Slash command system for common AI operations

- **Context Providers** (`internal/context/provider.go`, `providers/builtin.go`)
  - `Provider` interface: Type, Name, Description, Fetch, Validate
  - `ContextItem`: Unified context representation with priority and token count
  - `Registry`: Thread-safe provider registration with factory functions
  - `ContextBuilder`: Token-aware context assembly with priority-based eviction
  - Built-in providers: File, Diff, Terminal, HTTP, Folder, Search, Code

- **Memory Bank** (`internal/context/memory.go`)
  - Persistent project knowledge in `.superai/memory/`
  - `MemoryEntry`: ID, Type, Title, Content, Tags, Metadata, timestamps
  - `MemoryType` enum: fact, decision, pattern, error, todo, note
  - Markdown files with YAML frontmatter for human-readable storage
  - Search with filters: ByType, ByTag, ByPriority, ByAge
  - Import/Export JSON for portability
  - `BuildContext()`: Token-budget-aware memory retrieval

- **Focus Chain** (`internal/context/focus.go`)
  - `FocusLayer` enum: system, project, task, history, user
  - `FocusChain`: Layered context with per-layer token budgets
  - `ProgressiveFocus`: Start narrow, expand as needed pattern
  - `FocusManager`: Session-based focus chain management
  - Token compaction and priority-based eviction
  - Usage tracking and expansion threshold

- **Slash Commands** (`internal/context/commands.go`)
  - `SlashCommand` interface: Name, Description, Usage, Execute
  - `CommandRegistry`: Thread-safe command registration with aliases
  - Built-in commands:
    - `/summarize`: Summarize context or content
    - `/test`: Generate unit tests for code
    - `/doc`: Generate documentation (markdown/jsdoc/godoc)
    - `/refactor`: Suggest code improvements
    - `/explain`: Explain code or concepts
    - `/review`: Perform code review
    - `/fix`: Analyze and fix errors
    - `/clear`: Clear context layers
    - `/stats`: Show context statistics
    - `/help`: List commands or get help
  - Command aliases: /s, /t, /d, /r, /e, /?, /h
  - Custom command support via config templates

- **Context Configuration** (`internal/config/config.go`)
  - `ContextConfig`: TokenBudget, LayerBudgets, EnableCompaction, etc.
  - `CustomCommandConfig`: Define custom slash commands in YAML
  - `MemoryConfig`: Memory bank settings (enabled, max entries, retention)
  - Default 100k token budget with layer distribution

- **Dashboard Integration**
  - CONTEXT section in sidebar showing budget, usage, memory status

### Changed
- Dashboard version updated to v1.8.0
- Config struct now includes Context field
- DefaultConfig includes context defaults

### Technical Details
- New package: `internal/context/`
- Files: `provider.go` (~231 lines), `providers/builtin.go` (~420 lines), `memory.go` (~480 lines), `focus.go` (~410 lines), `commands.go` (~510 lines)
- ~2,050 lines of new context infrastructure
- Token estimation: len(text)/4 approximation
- Layer priorities: system(100) > project(80) > task(60) > history(40) > user(20)

---

## [1.7.0] - 2026-01-09

### Added
- **Advanced Agent Mode** (`internal/agent/`)
  - Plan/Act/Verify autonomous agent loop with state machine
  - Human-in-the-loop approval system with risk assessment
  - Agent personas for specialized tasks

- **Agent Loop** (`internal/agent/loop.go`)
  - `Loop` struct: state machine (idle→planning→acting→verifying→completed/failed)
  - `Plan` and `Step` types with dependencies and status tracking
  - `LoopConfig`: approval mode, max iterations, timeouts, auto-approve patterns
  - Event system for UI integration (`LoopEvent` types)
  - Automatic re-planning on step failures
  - Checkpoint support for long-running tasks

- **Agent Personas** (`internal/agent/persona.go`)
  - `Researcher`: Read-only analysis, codebase exploration
  - `Coder`: Implementation, feature development, bug fixes
  - `Reviewer`: Code review, quality checks, suggestions
  - `Architect`: System design, high-level planning
  - `Debugger`: Bug investigation, root cause analysis
  - Per-persona tool restrictions and system prompts

- **Approval System** (`internal/agent/approval.go`)
  - `ApprovalMode`: conservative, balanced, yolo
  - `RiskLevel`: low, medium, high, critical
  - `ApprovalPolicy`: configurable auto-approve rules
  - `AssessStepRisk()`: automatic risk assessment for steps
  - Diff preview generation for write operations
  - Command preview for execute operations
  - Dangerous command detection (rm -rf, sudo, etc.)

- **Rules System** (`internal/rules/rules.go`)
  - `.superai/rules/*.mdc` file parser (Markdown with YAML frontmatter)
  - Glob-based file pattern matching for rule application
  - `always_apply` rules for global context
  - `BuildContext()` aggregates rules for LLM prompts
  - Global rules support (`~/.superai/rules/`)
  - CRUD operations for rules management

- **Configuration** (`internal/config/config.go`)
  - `AgentLoopConfig`: enabled, approval_mode, default_persona, max_iterations, etc.
  - `auto_approve_tools` list for balanced mode
  - `rules_dir` for custom rules location

- **Dashboard** (`internal/tui/dashboard.go`)
  - Agent Loop status section in sidebar
  - Shows enabled state, approval mode, and persona

### Changed
- Dashboard version updated to v1.7.0
- Config version updated to 1.7.0

### Technical Details
- New files: `loop.go` (~495 lines), `persona.go` (~175 lines), `approval.go` (~280 lines), `rules.go` (~290 lines)
- ~1,240 lines of new agent infrastructure
- State machine: StateIdle, StatePlanning, StateActing, StateVerifying, StateWaiting, StateCompleted, StateFailed, StateCancelled
- Step types: read, write, execute, verify

---

## [1.6.0] - 2026-01-09

### Added
- **Enhanced MCP System** (`internal/mcp/`)
  - Complete rewrite of MCP infrastructure for full protocol compliance
  - Multi-transport support: Stdio, SSE (Server-Sent Events), HTTP (Streamable)
  - Multi-server aggregation with tool namespacing
  - MCP server mode (expose SuperAI as MCP server)

- **Transport Layer** (`internal/mcp/transport.go`)
  - `Transport` interface: Send, SendNotification, OnNotification, Close
  - `StdioTransport`: Spawn subprocess, JSON-RPC via stdin/stdout
  - `SSETransport`: Server-Sent Events over HTTP for real-time streaming
  - `HTTPTransport`: Streamable HTTP (MCP recommended transport)
  - `NewTransport()` factory function based on ServerConfig

- **Session Manager** (`internal/mcp/session.go`)
  - Full MCP handshake: initialize → initialized → ready
  - `CallTool()`, `ReadResource()`, `GetPrompt()`, `Ping()` methods
  - Auto-refresh of tools/resources/prompts lists
  - Notification handling with callbacks
  - `MatchesAutoApprove()` for tool pattern matching

- **Multi-Server Aggregator** (`internal/mcp/aggregator.go`)
  - Manage multiple MCP server sessions concurrently
  - Tool namespacing: `server_name.tool_name` qualified names
  - `ConnectAll()`, `Disconnect()`, `CallTool()` across servers
  - `AllTools()`, `AllResources()`, `AllPrompts()` aggregated views
  - `GenerateToolSchemas()` for LLM consumption
  - Health check loop with auto-reconnection

- **MCP Server Mode** (`internal/mcp/server.go`)
  - Expose SuperAI tools to external MCP clients
  - `RegisterTool()`, `RegisterResource()`, `RegisterPrompt()`
  - `ServeStdio()` for stdio transport
  - `ServeHTTP()` for HTTP/SSE transport
  - Built-in `echo` and `server_info` tools

- **MCP Server Configuration** (`internal/config/config.go`)
  - `MCPServerConfig` struct: name, type, command, args, url, headers, env, auto_approve
  - `MCPServers []MCPServerConfig` in main Config
  - Default servers: filesystem, github, memory, brave-search, puppeteer
  - All using `@modelcontextprotocol/*` official servers

### Changed
- Dashboard version updated to v1.6.0
- Config version updated to 1.6.0
- MCP package restructured for protocol compliance

### Technical Details
- New files: `transport.go`, `session.go`, `aggregator.go`, `server.go`
- ~2,100 lines of new MCP infrastructure
- Transport types: `stdio`, `sse`, `http`
- Qualified tool names prevent collision across servers
- Auto-approve patterns use glob matching

---

## [1.5.1] - 2026-01-09

### Added
- **Extended Roadmap Documentation**
  - `ROADMAP-EXTENDED.md`: Advanced phases v1.6.0 - v2.5.0
  - `FEATURE-MATRIX.md`: Comprehensive comparison of AI coding tools
- **Research Synthesis** (11 tools analyzed)
  - AIChat: 20+ LLM providers, RAG (HNSW+BM25), MCP support
  - Aider: 100+ providers via LiteLLM, architect mode, voice input
  - Claude Code: Full MCP, hooks, skills, sessions, SDK
  - OpenCode-Autopilot: AI council with democratic debate
  - Cursor/Continue/Cline/Cody/Copilot: Editor patterns
  - Claude-Squad: Multi-agent with git worktree isolation
  - Vibe-Kanban: MCP server with 10+ agent schemas
- **Editor Extension Roadmap**
  - v2.0.0: VS Code (Chat Participants API, Webview, TreeView)
  - v2.1.0: JetBrains (Kotlin, Tool Windows, ACP/MCP)
  - v2.2.0: Zed (Rust/WASM, Agent Server)
  - v2.3.0: Neovim (Lua, Telescope, treesitter)
  - v2.4.0: Cursor & Visual Studio

### Changed
- ROADMAP.md now references ROADMAP-EXTENDED.md for future phases
- Added feature matrix link to roadmap

---

## [1.5.0] - 2026-01-09

### Added
- **Web UI** (`internal/web/`)
  - `Server`: HTTP server with REST API and WebSocket support
  - `WebSocketHub`: Real-time updates via WebSocket connections
  - Embedded static file server for frontend assets
- **REST API Endpoints**
  - `/api/health`, `/api/status`: Server health and status
  - `/api/agents`: List, get, start, stop agents
  - `/api/tools`: List tools, execute tool
  - `/api/sessions`: CRUD operations for sessions
  - `/api/metrics`: Metrics and summary data
  - `/api/config`: Configuration access
  - `/api/logs`: Log retrieval
  - `/api/chat`: Chat message handling
  - `/ws`: WebSocket for real-time updates
- **Web Frontend**
  - Modern dark theme UI
  - Agent sidebar with start/stop controls
  - Chat interface with message history
  - Tools panel with tool list
  - Live log viewer
  - Metrics display (requests, tokens, cost)
  - WebSocket auto-reconnection
- **Dashboard Integration**
  - `W`: Toggle web server
  - `webServer`, `webEnabled` fields in DashboardModel

### Changed
- Dashboard version updated to v1.5.0
- Added gorilla/websocket dependency

### Technical Details
- New package: `internal/web/`
- Static files embedded via `//go:embed`
- CORS middleware for cross-origin requests
- Graceful server shutdown

---

## [1.4.0] - 2026-01-09

### Added
- **Voice Input** (`internal/voice/voice.go`)
  - `VoiceConfig`: Provider settings, API keys, audio parameters
  - `VoiceInput`: Recording and transcription manager with state machine
  - `TranscriptionResult`: Text, language, duration, confidence, segments
- **Speech-to-Text Providers**
  - `whisper_api`: OpenAI Whisper API (default)
  - `whisper`: Local Whisper installation
  - `google`: Google Cloud Speech-to-Text
  - `azure`: Azure Cognitive Services
  - `local`: Platform-native recognition
- **Platform Recording**
  - macOS: sox/rec command
  - Linux: arecord (ALSA)
  - Windows: PowerShell System.Speech
- **Voice UI**
  - `V`: Toggle voice recording
  - Transcribed text auto-fills chat input
  - Voice status indicators in logs
  - Auto-detection of recording tools

### Changed
- Dashboard version updated to v1.4.0
- Added `voiceInput`, `voiceEnabled` fields to DashboardModel

### Technical Details
- New package: `internal/voice/`
- Temp files stored in `~/.superai/voice/temp/`
- MultipartWriter for OpenAI file uploads
- Platform-specific binary detection

---

## [1.3.0] - 2026-01-09

### Added
- **Plugin Marketplace** (`internal/marketplace/marketplace.go`)
  - `PluginInfo`: Plugin metadata (name, version, author, downloads, stars, etc.)
  - `Registry`: Plugin registry with categories and featured plugins
  - `InstalledPlugin`: Tracking for installed plugins
  - `Marketplace`: Full marketplace client with sync, search, install
- **Marketplace Operations**
  - `Sync()`: Fetch registry from remote URL
  - `Search()`: Search plugins by name, description, tags
  - `ListByCategory()`, `ListFeatured()`, `ListAll()`: Browse plugins
  - `Install()`, `Uninstall()`: Plugin lifecycle
  - `Update()`, `UpdateAll()`: Version management
  - `Enable()`, `Disable()`: Plugin state control
- **Plugin Distribution**
  - Multi-platform binary support (linux, macos, windows)
  - Automatic platform detection
  - Checksum verification support
  - Sample registry with example plugins
- **Marketplace UI**
  - `M`: Toggle marketplace overlay
  - Featured and verified badges
  - Download/star counts
  - Category browsing
  - Install/update status indicators

### Changed
- Dashboard version updated to v1.3.0
- Added `market`, `showMarket`, `marketResults`, `activeMarketItem` fields

### Technical Details
- New package: `internal/marketplace/`
- Config stored in `~/.superai/marketplace.json`
- Registry cached in `~/.superai/cache/registry.json`
- Plugins installed to `~/.superai/plugins/`

---

## [1.2.0] - 2026-01-09

### Added
- **Remote Agents** (`internal/remote/remote.go`)
  - `RemoteHost`: Configuration for SSH, Docker, Kubernetes, Local connections
  - `RemoteConnection`: Active connection with state tracking
  - `RemoteManager`: Thread-safe host and connection management
  - `ExecutionResult`: Command output with exit code, stdout, stderr, duration
- **Connection Types**
  - `ssh`: SSH connections with key-based auth
  - `docker`: Docker container execution
  - `kubernetes`: Kubernetes pod execution
  - `local`: Local subprocess execution
- **Remote Operations**
  - `Connect()`, `Disconnect()`: Connection lifecycle
  - `Execute()`: Run commands on remote hosts
  - `ExecuteStream()`: Stream command output in real-time
  - `Ping()`: Latency measurement
- **Helper Functions**
  - `TestSSHConnection()`, `TestDockerConnection()`, `TestKubernetesConnection()`
  - `ListDockerContainers()`, `ListKubernetesPods()`
  - `ResolveSSHConfig()`: Parse ~/.ssh/config
  - `IsPortOpen()`: TCP port connectivity test
- **Remote UI**
  - `R`: Toggle remote agents overlay
  - Host list with connection status indicators
  - Connection latency display
  - Support for SSH, Docker, and Kubernetes remotes

### Changed
- Dashboard version updated to v1.2.0
- Added `remoteMgr`, `showRemotes`, `activeRemote` fields to DashboardModel

### Technical Details
- New package: `internal/remote/`
- Host configs stored in `~/.superai/remotes.json`
- Thread-safe with `sync.RWMutex`
- Persistent shell sessions for SSH/Docker/K8s

---

## [1.1.0] - 2026-01-09

### Added
- **Git Integration** (`internal/git/git.go`)
  - `FileStatus`: File path, status code, staged state
  - `CommitInfo`: Hash, author, email, date, message
  - `BranchInfo`: Name, current, remote, upstream, ahead/behind
  - `RepoStatus`: Complete repository state snapshot
  - `Client`: Thread-safe git operations wrapper
- **Git Operations**
  - `IsRepo()`, `Root()`, `CurrentBranch()`: Repository info
  - `Status()`, `LastCommit()`: Working tree state
  - `Diff()`, `DiffFull()`: Change inspection
  - `Add()`, `AddAll()`, `Commit()`, `CommitAmend()`: Staging and commits
  - `Push()`, `PushSetUpstream()`, `Pull()`, `Fetch()`: Remote sync
  - `Checkout()`, `CheckoutNew()`, `Branches()`: Branch management
  - `Stash()`, `StashPop()`: Stash operations
  - `Log()`, `Reset()`, `ResetFile()`, `Clean()`: History and cleanup
  - `Remote()`, `Remotes()`: Remote repository info
- **Git UI**
  - `g`: Toggle git overlay with detailed status
  - GIT section in sidebar showing branch and dirty indicator
  - Branch name with ahead/behind sync status
  - Staged/modified/untracked file counts
  - Last commit info in overlay
  - Conflict detection warning

### Changed
- Dashboard version updated to v1.1.0
- Sidebar now includes GIT section with live status

### Technical Details
- New package: `internal/git/`
- Git commands executed via `os/exec`
- Thread-safe with `sync.RWMutex`
- Auto-detects git repository from working directory

---

## [1.0.0] - 2026-01-09

### Added
- **Metrics Dashboard** (`internal/metrics/`)
  - `TokenUsage`: Input, output, and total token counts
  - `RequestMetrics`: Per-request tracking (provider, model, tokens, cost, duration, success)
  - `SessionStats`: Aggregated session statistics with breakdown by model and provider
  - `ProviderPricing`: Default pricing for OpenAI, Anthropic, and Google models
  - `Collector`: Thread-safe metrics collection with auto-cost calculation
- **Metrics UI**
  - `Ctrl+M`: Toggle metrics dashboard overlay
  - Session overview (ID, start time, duration)
  - Request stats (total, successful, failed, success rate, avg duration)
  - Token usage (input, output, total)
  - Cost estimate with total and per-provider breakdown
  - Tokens by model breakdown
  - Recent requests list with status indicators
- **Automatic Cost Tracking**
  - Metrics recorded on each LLM request completion
  - Duration tracking from request start to response
  - Error recording for failed requests

### Changed
- Dashboard version updated to v1.0.0
- `DashboardModel` now includes `metricsCollector`, `showMetrics`, and `chatStartTime` fields
- `sendChat()` records start time for duration calculation
- `ChatResponseMsg` handler records metrics with full request details

### Technical Details
- New package: `internal/metrics/`
- `Collector.Record()` auto-calculates cost based on provider pricing
- Thread-safe with `sync.RWMutex`
- Max 10,000 requests stored in memory (rolling buffer)
- Cost calculation: (input_tokens / 1000 * input_rate) + (output_tokens / 1000 * output_rate)

---

## [0.9.0] - 2026-01-09

### Added
- **Plugin SDK** (`internal/plugin/sdk.go`)
  - `BasePlugin`: Default implementation with config storage
  - `BaseAgentPlugin`: Foundation for agent plugins with Execute/Stream
  - `BaseToolPlugin`: Foundation for tool plugins with RegisterTool
  - `BaseThemePlugin`: Foundation for theme plugins with Colors
  - `ParseArgs[T]`: Generic JSON argument parsing
  - `NewToolDef`: Helper for creating tool definitions
  - Property builders: `StringProperty`, `IntProperty`, `BoolProperty`, `ArrayProperty`
  - `DefaultThemeColors`: Sensible color palette defaults
- **Example Plugins** (`examples/plugins/`)
  - `hello-agent`: Demonstrates agent plugin with greeting responses
  - `hello-tool`: Four example tools (greet, random_number, word_count, reverse_text)
  - `neon-theme`: Cyberpunk-inspired neon color scheme
  - README.md for each plugin with build/install instructions
- **Build Script** (`scripts/build-plugins.sh`)
  - Cross-platform plugin compilation (Linux/macOS/Windows)
  - Auto-detection of file extension (.so/.dylib/.dll)
  - Colored output with success/failure indicators
  - Installs to `~/.superai/plugins/` by default

### Changed
- Dashboard version updated to v0.9.0

### Technical Details
- SDK uses Go generics for type-safe argument parsing
- BasePlugin implements full Plugin interface lifecycle
- Tool plugins use handler map for dispatch
- Examples serve as templates for community plugins

---

## [0.8.0] - 2026-01-09

### Added
- **Plugin System** (`internal/plugin/`)
  - `Plugin` interface: Init, Start, Stop, Cleanup lifecycle methods
  - `AgentPlugin` interface: Execute and Stream for custom agents
  - `ToolPlugin` interface: Tools registry and ExecuteTool
  - `ThemePlugin` interface: Colors and Apply for custom themes
  - `PluginInfo`: Name, Version, Description, Author, Type, Homepage
  - `PluginState`: Unloaded, Loaded, Active, Error with state tracking
- **Plugin Manager** (`internal/plugin/manager.go`)
  - `Discover()`: Scans `~/.superai/plugins/` for .so/.dll/.dylib files
  - `Load(path)`: Dynamic loading via Go plugin system
  - `Init/Start/Stop/Unload`: Full lifecycle management
  - `LoadAll/StopAll/UnloadAll`: Batch operations
  - `GetAgentPlugins/GetToolPlugins/GetThemePlugins`: Typed getters
  - Thread-safe with `sync.RWMutex`
- **Plugin UI in Dashboard**
  - `p`: Open plugin list overlay
  - PLUGINS section in sidebar (count, active status)
  - Plugin list with state indicators (●/○/✗)
  - Navigate with j/k, Enter to start/stop, u to unload
  - Plugin discovery and loading on startup

### Changed
- Dashboard version updated to v0.8.0
- Init() now includes checkPlugins() command
- Sidebar shows plugin count and active count

### Technical Details
- New package: `internal/plugin/`
- `PluginsLoadedMsg` tea.Msg for async plugin loading
- Plugins must export `func NewPlugin() plugin.Plugin`
- Cross-platform support: .so (Linux), .dll (Windows), .dylib (macOS)

---

## [0.7.0] - 2026-01-09

### Added
- **Advanced UI Components** (`internal/tui/components/`)
  - TabBar: Tabbed interface for multi-agent output (soft-serve pattern)
  - Spinner: Animated loading indicators with multiple styles (dots, line, pulse, etc.)
  - ProgressBar: Visual progress tracking
  - MultiSpinner: Concurrent spinner management
  - SplitPane/TripleSplitPane: Flexible layout components
  - SearchBar: Log search with regex support and match highlighting
  - FilterBar: Real-time log filtering
  - CodeHighlighter: Syntax highlighting for Go, Python, JavaScript
  - LogHighlighter: Semantic highlighting for log levels (error, warn, info, debug)
- **Search/Filter Hotkeys**
  - `Ctrl+F`: Toggle search bar with match navigation (n/N for next/prev)
  - `Ctrl+G`: Toggle filter bar for log filtering
- **Processing Indicators**
  - Spinner animation during LLM chat and parallel task execution
  - Spinner displayed in status bar while processing
- **Log Highlighting**
  - Automatic syntax highlighting for system logs
  - Error/warning/info keywords styled distinctly
  - Bracket and timestamp highlighting

### Changed
- Dashboard version updated to v0.7.0
- Chat and parallel task commands now show animated spinner
- Viewport content highlighted when search is active

### Technical Details
- New package: `internal/tui/components/`
- `SpinnerTickMsg` tea.Msg for animation frames
- Components follow Bubble Tea MVU pattern
- SearchBar/FilterBar integrate with textinput bubbles

---

## [0.6.0] - 2026-01-09

### Added
- **Session Persistence System** (`internal/session/`)
  - Save and restore orchestration sessions across runs
  - Session state: active, paused, completed, archived
  - JSON serialization to `~/.superai/sessions/`
- **Session Data Model** (`internal/session/session.go`)
  - `Session`: Complete orchestration session with metadata
  - `Message`: Chat message with role, content, timestamp, tool calls
  - `ToolCallRecord`: Tool invocation history with duration
  - `UsageStats`: Token and cost tracking per session
  - `AgentExecution`: External agent run records
  - `Checkpoint`: Named save points within sessions
  - `SessionSummary`: Lightweight view for listing
- **Session Manager**
  - `Save()`: Persist session to disk with timestamp
  - `Load()`: Retrieve session by ID with caching
  - `List()`: Get all sessions sorted by update time
  - `Delete()`: Remove session from disk and cache
  - `Export()`: Serialize session for sharing
  - `Import()`: Load session from exported data (new ID)
  - `Archive()`: Mark session as archived
  - `Search()`: Find sessions by name or tags
  - `GetRecent()`: Get N most recently updated sessions
- **Session UI in Dashboard**
  - `Ctrl+S`: Save current session
  - `Ctrl+L`: Open session list/load modal
  - `Ctrl+N`: Create new session
  - Session indicator in sidebar (name, message count)
  - Session list overlay with navigation
  - Auto-save on quit if session has content
- **Session Replay**
  - `ConvertLLMMessages()`: Convert LLM messages to session format
  - `ToLLMMessages()`: Restore session to LLM conversation
  - `ReplayTo()`: Replay messages up to a checkpoint
  - History restoration when loading sessions

### Changed
- Dashboard version updated to v0.6.0
- NewDashboard initializes SessionManager and creates new session
- Status bar shows session hotkeys
- Quit handler auto-saves current session

### Technical Details
- New package: `internal/session/`
- `SessionSavedMsg`, `SessionLoadedMsg`, `SessionListMsg`, `SessionDeletedMsg` tea.Msg types
- Sessions stored as `{id}.json` in `~/.superai/sessions/`
- Thread-safe manager with `sync.RWMutex` and in-memory cache
- Random hex IDs generated with `crypto/rand`

---

## [0.5.0] - 2026-01-09

### Added
- **Multi-Agent Collaboration System** (`internal/collaboration/`)
  - Agent collaboration protocol with message passing
  - Message types: task, result, error, status, broadcast, handoff
  - Agent roles: coordinator, worker, specialist, reviewer
- **Agent Pool** (`internal/collaboration/pool.go`)
  - Manages multiple concurrent LLM-powered agents
  - Parallel task spawning with goroutines
  - Agent state tracking (idle, working, waiting, completed, error)
  - Specialty-based agent selection
  - Pool statistics (total, idle, working, error agents)
- **Task Coordinator** (`internal/collaboration/coordinator.go`)
  - Task queue with priority dispatch
  - Automatic agent assignment based on specialties
  - Retry logic with configurable max retries
  - Parallel task submission with result collection
- **Result Aggregation** (`internal/collaboration/aggregator.go`)
  - Multiple aggregation strategies:
    - `first`: Return first successful result
    - `all`: Collect all results
    - `majority`: Vote-based selection
    - `best`: Score-based selection (speed + quality)
    - `merge`: Combine all outputs
    - `consensus`: Require >50% agreement
  - Confidence scoring for aggregated results
- **TUI Integration**
  - New "AGENT POOL" section in sidebar
  - Shows pool status, agent count, working agents, active tasks
  - `Ctrl+P` in chat mode to run parallel multi-agent task
  - Pool results with success/failure indicators
- **Pre-configured Pool Agents**
  - Research Agent (specialty: research, analysis)
  - Coding Agent (specialty: coding, implementation)
  - Review Agent (specialty: review, verification)

### Changed
- Dashboard version updated to v0.5.0
- Added collaboration package import
- Quit command now properly stops agent pool
- Reduced max displayed tools to 4 (accommodate pool section)

### Technical Details
- New package: `internal/collaboration/`
- `PooledAgent` wraps `CollaborationAgent` with ReAct engine
- `MessageBus` routes messages between agents
- Goroutine-per-agent message loop
- Thread-safe with `sync.RWMutex`

---

## [0.4.0] - 2026-01-09

### Added
- **LLM Provider Abstraction** (`internal/llm/provider.go`)
  - Generic `Provider` interface for LLM backends
  - Support for chat completions and streaming
  - Tool calling with JSON Schema definitions
  - Message types: system, user, assistant, tool
- **OpenAI Provider** (`internal/llm/openai.go`)
  - Full OpenAI API integration
  - Streaming support with Server-Sent Events
  - Tool/function calling support
  - Configurable model, temperature, max tokens
- **ReAct Orchestration Engine** (`internal/llm/react.go`)
  - Thought-Action-Observation loop implementation
  - Tool registration and execution
  - Conversation history management
  - Max iterations safeguard (default: 10)
  - Callbacks for streaming updates (OnThought, OnAction, OnObservation)
- **Chat Interface in TUI**
  - Press `/` or `c` to enter chat mode
  - Text input with 2000 character limit
  - User/Assistant message styling
  - Processing indicator during LLM calls
  - `x` key to clear conversation history
- **Built-in Tools for ReAct**
  - `list_files`: List directory contents
  - `read_file`: Read file contents
  - `run_command`: Execute shell commands
- **LLM Configuration** (`~/.superai/config.yaml`)
  - `llm.provider`: Provider name (openai, anthropic, ollama)
  - `llm.api_key` or `llm.api_key_env`: API key configuration
  - `llm.model`: Model selection (default: gpt-4o)
  - `llm.max_tokens`, `llm.temperature`: Generation parameters
- **Token Usage Tracking**
  - Displays total tokens used in sidebar
  - Accumulates across conversation

### Changed
- Dashboard version updated to v0.4.0
- Config version updated to 0.4.0
- Added `textinput` bubbles component for chat
- Sidebar now shows LLM status (● online / ✗ offline)

### Technical Details
- New package: `internal/llm/` with provider abstraction
- Added `github.com/charmbracelet/bubbles/textinput` dependency
- `LLMConfig` struct in config package
- `FocusChat` panel focus mode
- `ChatResponseMsg` tea.Msg for async LLM responses

---

## [0.3.0] - 2026-01-09

### Added
- **MCP Tool Execution** (`internal/mcp/client.go`)
  - `ExecuteTool()`: POST /api/hub/tools/{name}/execute
  - `GetTool()`: GET /api/hub/tools/{name}
  - `Ping()`: Health check for hub connectivity
  - HTTP client with 30s timeout
- **Dual-Panel Sidebar**
  - AGENTS panel: List of configured AI agents
  - MCP TOOLS panel: Discovered tools from hub
  - `Tab` key switches focus between panels
  - Hub connection status indicator (● online / ✗ offline)
- **Tool Execution from TUI**
  - Select tool with j/k, execute with s/Enter
  - Results displayed in viewport
- **New Hotkey**: `m` to refresh MCP tools

### Changed
- Dashboard version updated to v0.3.0
- MCP client now has proper request/response types
- Sidebar shows max 5 tools with "+N more" overflow indicator

### Technical Details
- Added `ToolExecuteRequest`, `ToolExecuteResponse` types
- Added `ToolsDiscoveredMsg`, `ToolExecutedMsg` tea.Msg types
- Added `PanelFocus` enum for dual-panel navigation
- Hub ping on startup to detect connectivity

---

## [0.2.0] - 2026-01-09

### Added
- **Configuration System** (`internal/config/config.go`)
  - YAML-based config file at `~/.superai/config.yaml`
  - Auto-detection of agent binaries in PATH
  - Default config with 7 pre-configured agents
  - Hot-reload config with `r` key
- **Real Agent Integration**
  - aichat (Rust CLI - LLM REPL, RAG, agents)
  - vibe-kanban (npx - Kanban for AI agents)
  - opencode (OpenCode AI assistant)
  - claude-code (Anthropic Claude CLI)
  - plandex (AI coding with planning)
  - aider (AI pair programming)
  - mcp-cli (MCP command line)
- **Agent Status Indicators**
  - ● Green: Running
  - ○ Gray: Stopped
  - ✗ Red: Error
  - ? Orange: Not found in PATH
- **New Hotkey**: `r` to reload configuration

### Changed
- Dashboard now loads agents from config instead of hardcoded list
- Sidebar shows status indicators next to each agent
- Status bar updated to v0.2.0
- Agent start (`s`/`Enter`) now validates binary availability

### Fixed
- Agent subprocess now properly streams output to viewport

### Technical Details
- Added `gopkg.in/yaml.v3` dependency for config parsing
- Config auto-creates `~/.superai/` directory on first save
- Binary detection checks PATH and common install locations

---

## [0.1.0] - 2026-01-09

### Added
- Initial release of SuperAI CLI "Mecha Suit"
- TUI dashboard with Bubble Tea framework
  - Sidebar with agent list navigation (j/k keys)
  - Viewport for real-time log streaming
  - Status bar with hotkey hints
  - Adaptive color scheme (light/dark terminal support)
- Agent subprocess runner
  - Spawn and manage external CLI tools
  - Stream stdout/stderr via channels
  - Thread-safe agent registry
- Tool orchestration engine
  - JSON Schema-based tool definitions
  - Thread-safe tool registry
  - Tool execution with context support
  - ReAct loop skeleton (placeholder for LLM integration)
- MCP hub client
  - HTTP client for tool discovery
  - Connects to borg hub at localhost:3000
- Hotkeys: `q`/`Ctrl+C` quit, `j`/`k` navigate, `s` start agent, `t` test tool
- Built-in `ls` tool for demonstration

### Technical Details
- Go 1.25.5
- Charm.sh ecosystem (Bubble Tea v1.3.10, Lip Gloss v1.1.0, Bubbles v0.21.0)
- MVU architecture pattern
- Goroutine-based concurrency with channels

### Known Limitations
- ReAct loop not yet connected to LLM
