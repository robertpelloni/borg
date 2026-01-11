# SuperAI CLI Extended Roadmap

> Advanced development phases for the "Mecha Suit" orchestrator - from v1.6.0 to v2.5.0.

**See also**: [ROADMAP.md](./ROADMAP.md) for phases v0.1.0-v1.5.0 (completed)

---

## Current Status: v1.5.0 (Production Ready)

All foundational phases complete. Ready for advanced features and editor extensions.

---

## Phase 15: Enhanced MCP (v1.6.0)

**Goal**: Full MCP protocol implementation with aggregator pattern.

### Planned Features
- [ ] **MCP Client Rewrite**
  - stdio transport (spawn subprocess, communicate via stdin/stdout)
  - SSE transport (Server-Sent Events over HTTP)
  - Streamable HTTP transport (recommended by spec)
  - Connection pooling and reconnection
- [ ] **MCP Aggregator Pattern**
  - Multiple MCP servers as single unified interface
  - Tool deduplication and namespacing
  - Server health monitoring
- [ ] **MCP Server Mode**
  - Expose SuperAI tools to external clients
  - Implement resources and prompts primitives
  - OAuth 2.1 with PKCE for authentication
- [ ] **Configuration**
  ```yaml
  mcp_servers:
    - name: "github-mcp"
      type: "sse"
      url: "http://localhost:3000"
      auto_approve: ["read_*"]
    - name: "filesystem"
      type: "stdio"
      command: "npx"
      args: ["-y", "@anthropic/mcp-server-filesystem"]
  ```
- [ ] **UI Updates**
  - MCP server status in sidebar
  - Tool browser with server grouping
  - Auto-approve rules configuration

### Technical Notes
- Follow MCP spec: https://modelcontextprotocol.io/specification
- JSON-RPC 2.0 message format
- Support for tool, resource, and prompt primitives

---

## Phase 16: Advanced Agent Mode (v1.7.0)

**Goal**: Autonomous agent with Plan/Act/Verify loop.

### Planned Features
- [ ] **Plan/Act/Verify Loop** (inspired by Cline)
  - Plan: Break down task into atomic steps
  - Act: Execute tools with streaming output
  - Verify: Check results before proceeding
  - Iterate: Re-plan on failures
- [ ] **Rules System** (.superai/rules/*.mdc)
  - Markdown with YAML frontmatter
  - Project-specific instructions
  - Glob-based file matching
  - Example:
    ```markdown
    ---
    description: TypeScript coding rules
    globs: ["**/*.ts", "**/*.tsx"]
    ---
    # TypeScript Rules
    - Use strict TypeScript
    - Prefer interfaces over types
    - Always handle errors explicitly
    ```
- [ ] **Human-in-the-Loop Controls**
  - Diff preview before file changes
  - Command approval for shell execution
  - Checkpoint creation at key points
- [ ] **Auto-Approve Modes**
  - Conservative: Approve reads, require approval for writes
  - Balanced: Approve safe operations automatically
  - YOLO: Auto-approve everything (like Cursor)
- [ ] **Agent Personas**
  - Researcher: Focus on reading and analysis
  - Coder: Focus on implementation
  - Reviewer: Focus on verification

### Technical Notes
- State machine for agent lifecycle
- Rollback support via git stash/checkout
- Token budget management per task

---

## Phase 17: Context System (v1.8.0)

**Goal**: Intelligent context management with providers.

### Planned Features
- [ ] **Context Providers** (inspired by Continue.dev)
  - File: Include specific files
  - Code: Include code blocks
  - Diff: Include git diff
  - Terminal: Include terminal output
  - HTTP: Fetch from URLs
  - Folder: Include directory structure
  - Search: Include grep/ripgrep results
  - Debugger: Include debug state
  - Tree: Include AST/parse tree
  - Custom: User-defined providers
- [ ] **Memory Bank** (inspired by Cline)
  - Persistent project knowledge
  - Key facts, decisions, patterns
  - Auto-updated from conversations
  - Markdown storage in .superai/memory/
- [ ] **Focus Chain**
  - Progressive context building
  - Start narrow, expand as needed
  - Token budget awareness
- [ ] **Custom Slash Commands**
  - `/summarize`: Summarize selected code
  - `/test`: Generate tests for selection
  - `/doc`: Generate documentation
  - `/refactor`: Suggest refactoring
  - User-defined commands via config

### Technical Notes
- Context providers as plugin interface
- LRU cache for frequently accessed context
- Compression for large contexts

---

## Phase 18: RAG System (v1.9.0)

**Goal**: Retrieval-Augmented Generation for codebase understanding.

### Planned Features
- [ ] **Vector Database**
  - Embedded vector store (no external deps)
  - HNSW index for similarity search
  - Persistent storage in ~/.superai/vectors/
- [ ] **Embeddings**
  - OpenAI text-embedding-3-small (default)
  - Local embeddings via Ollama
  - Chunking strategies (semantic, sliding window)
- [ ] **Document Loaders**
  - Source code (with AST awareness)
  - Markdown/documentation
  - Git history (commits, diffs)
  - Comments and docstrings
- [ ] **Hybrid Search** (inspired by AIChat)
  - Vector similarity (semantic)
  - BM25 keyword matching
  - Reranking with cross-encoder
- [ ] **Indexing**
  - Incremental updates on file change
  - Exclude patterns (.gitignore aware)
  - Progress indicator during indexing
- [ ] **UI Updates**
  - RAG status in sidebar
  - Index management overlay
  - Search results preview

### Technical Notes
- Use go-faiss or custom HNSW implementation
- Chunk size: 512 tokens with 50 token overlap
- Embedding cache to reduce API calls

---

## Phase 19: Architect Mode (v1.10.0)

**Goal**: Two-model approach for complex reasoning.

### Planned Features
- [ ] **Architect Model** (inspired by Aider)
  - Reasoning model: Plans and designs
  - Editor model: Implements changes
  - Communication via structured prompts
- [ ] **Model Roles** (inspired by Continue.dev)
  - chat: Conversation model
  - autocomplete: Fast completion model
  - edit: Code editing model
  - agent: Autonomous task model
  - architect: High-level reasoning model
- [ ] **Configuration**
  ```yaml
  models:
    roles:
      chat: "claude-3-5-sonnet-20241022"
      autocomplete: "codestral-latest"
      edit: "gpt-4o"
      agent: "claude-3-5-sonnet-20241022"
      architect: "gpt-4o"
  ```
- [ ] **Architect Workflow**
  1. User describes high-level goal
  2. Architect model creates detailed plan
  3. Editor model implements each step
  4. Architect reviews and iterates

### Technical Notes
- Architect prompts cached for consistency
- Cost optimization: Use cheaper model for edits
- Quality tracking: Compare architect vs direct

---

## Phase 20: VS Code Extension (v2.0.0)

**Goal**: First-class VS Code integration.

### Planned Features
- [ ] **Chat Participant API**
  - Register @superai chat participant
  - Slash commands: /explain, /refactor, /test, /doc
  - Context from active editor
- [ ] **Webview Panel**
  - Full chat interface in sidebar
  - Tool execution visualization
  - Session management
- [ ] **TreeView Sidebar**
  - Agent list with status
  - MCP tools browser
  - Session history
- [ ] **Editor Integration**
  - Inline completions (optional)
  - Code actions (quick fixes)
  - Diagnostics from AI analysis
- [ ] **Terminal Integration**
  - Execute commands in integrated terminal
  - Capture terminal output for context
- [ ] **WorkspaceEdit API**
  - Multi-file edits with preview
  - Undo/redo support
- [ ] **Configuration**
  - VS Code settings integration
  - Workspace-specific overrides
- [ ] **Publishing**
  - VS Code Marketplace
  - Open VSX Registry

### Technical Architecture
```
┌─────────────────────────────────────────┐
│         VS Code Extension               │
│  (TypeScript, thin facade)              │
└──────────────┬──────────────────────────┘
               │ JSON-RPC / WebSocket
               ▼
┌─────────────────────────────────────────┐
│         SuperAI CLI Backend             │
│  (Go, runs as subprocess or server)     │
└─────────────────────────────────────────┘
```

### File Structure
```
extensions/vscode/
├── package.json
├── src/
│   ├── extension.ts       # Entry point
│   ├── chatParticipant.ts # @superai handler
│   ├── webview/           # Chat UI
│   ├── treeView/          # Sidebar
│   └── backend.ts         # SuperAI CLI bridge
├── media/                 # Icons, CSS
└── README.md
```

---

## Phase 21: JetBrains Plugin (v2.1.0)

**Goal**: IntelliJ-based IDE support (IDEA, PyCharm, WebStorm, etc.).

### Planned Features
- [ ] **Tool Window**
  - Chat interface panel
  - Agent status sidebar
  - MCP tools browser
- [ ] **Actions**
  - Context menu: Explain, Refactor, Generate Tests
  - Keyboard shortcuts
  - Intention actions (quick fixes)
- [ ] **Editor Integration**
  - PSI-based code analysis
  - WriteCommandAction for safe edits
  - Diff preview before changes
- [ ] **Terminal Integration**
  - Execute commands in IDE terminal
  - Reworked Terminal API (2025.2+)
- [ ] **ACP Integration** (2025.3+)
  - Agent Client Protocol support
  - Native AI agent registration
- [ ] **MCP Server Mode**
  - Expose IDE tools via MCP
  - File operations, refactoring, debugging
- [ ] **Publishing**
  - JetBrains Marketplace
  - Plugin signing

### Technical Architecture
```
┌─────────────────────────────────────────┐
│       JetBrains Plugin (Kotlin)         │
│  Tool Window + Actions + PSI            │
└──────────────┬──────────────────────────┘
               │ JSON-RPC / gRPC
               ▼
┌─────────────────────────────────────────┐
│         SuperAI CLI Backend             │
└─────────────────────────────────────────┘
```

### File Structure
```
extensions/jetbrains/
├── build.gradle.kts
├── src/main/kotlin/
│   ├── AIPlugin.kt
│   ├── toolwindow/
│   ├── actions/
│   └── services/
├── src/main/resources/
│   └── META-INF/plugin.xml
└── README.md
```

---

## Phase 22: Zed Extension (v2.2.0)

**Goal**: Native Zed editor integration.

### Planned Features
- [ ] **WASM Extension**
  - Rust compiled to WebAssembly
  - zed_extension_api crate
- [ ] **Agent Server (ACP)**
  - Register as Zed AI agent
  - Tool invocation from Zed
- [ ] **Slash Commands**
  - /superai for chat
  - /explain, /refactor, /test
- [ ] **Context Providers**
  - File, selection, diagnostics
- [ ] **Language Server**
  - Optional LSP for completions
- [ ] **Configuration**
  - extension.toml manifest
  - Settings in Zed preferences

### Technical Architecture
```
┌─────────────────────────────────────────┐
│        Zed Extension (Rust/WASM)        │
│  ACP Agent + Slash Commands             │
└──────────────┬──────────────────────────┘
               │ ACP Protocol
               ▼
┌─────────────────────────────────────────┐
│         SuperAI CLI Backend             │
└─────────────────────────────────────────┘
```

### File Structure
```
extensions/zed/
├── extension.toml
├── Cargo.toml
├── src/
│   └── lib.rs           # WASM entry
├── languages/           # Optional language support
└── README.md
```

---

## Phase 23: Neovim Plugin (v2.3.0)

**Goal**: Native Neovim integration via Lua.

### Planned Features
- [ ] **Lua Plugin** (inspired by avante.nvim, codecompanion.nvim)
  - Pure Lua implementation
  - Lazy.nvim compatible
- [ ] **Chat Interface**
  - Split window for chat
  - Markdown rendering
  - Code block highlighting
- [ ] **Keybindings**
  - `<leader>ai` for chat toggle
  - `<leader>ae` for explain
  - `<leader>ar` for refactor
- [ ] **Telescope Integration**
  - Session picker
  - Tool browser
  - MCP server selector
- [ ] **LSP Integration**
  - Diagnostics from AI
  - Code actions
- [ ] **Treesitter Integration**
  - AST-aware context
  - Smart selection
- [ ] **Dependencies**
  - plenary.nvim (async, curl)
  - nui.nvim (UI components)
  - nvim-treesitter (optional)

### Technical Architecture
```
┌─────────────────────────────────────────┐
│        Neovim Plugin (Lua)              │
│  Chat UI + Commands + Telescope         │
└──────────────┬──────────────────────────┘
               │ HTTP / JSON-RPC
               ▼
┌─────────────────────────────────────────┐
│         SuperAI CLI Backend             │
│  (running as server or subprocess)      │
└─────────────────────────────────────────┘
```

### File Structure
```
extensions/neovim/
├── lua/
│   └── superai/
│       ├── init.lua      # Entry point
│       ├── chat.lua      # Chat window
│       ├── actions.lua   # Commands
│       ├── telescope.lua # Telescope integration
│       └── config.lua    # Configuration
├── plugin/
│   └── superai.lua       # Auto-load
├── doc/
│   └── superai.txt       # Help docs
└── README.md
```

---

## Phase 24: Cursor & Visual Studio (v2.4.0)

**Goal**: Support for Cursor and Visual Studio.

### Cursor Extension
- [ ] **MCP Integration**
  - SuperAI as MCP server
  - Tools available in Cursor's AI
- [ ] **Rules Files**
  - .cursor/rules/*.mdc compatibility
  - Convert to .superai/rules/ format
- [ ] **Composer Integration**
  - Multi-file edit support
  - Project-wide refactoring

### Visual Studio Extension (VSIX)
- [ ] **Tool Window**
  - Chat interface
  - Agent status
- [ ] **Editor Integration**
  - Context menu actions
  - Code lens (optional)
- [ ] **LSP Client**
  - Connect to SuperAI language server
- [ ] **Publishing**
  - Visual Studio Marketplace

### File Structure
```
extensions/cursor/
├── .cursorrules           # Cursor-specific config
└── mcp-server.json        # MCP server registration

extensions/visualstudio/
├── SuperAI.sln
├── SuperAI/
│   ├── SuperAI.csproj
│   ├── SuperAIPackage.cs
│   ├── ToolWindow/
│   └── Commands/
└── README.md
```

---

## Phase 25: Agent Council (v2.5.0)

**Goal**: Multi-agent collaboration with democratic decision-making.

### Planned Features
- [ ] **Agent Council** (inspired by OpenCode-Autopilot)
  - Multiple specialized agents
  - Democratic debate on decisions
  - Weighted voting based on expertise
- [ ] **Git Worktree Isolation** (inspired by Claude-Squad)
  - Each agent gets isolated worktree
  - No conflicts during parallel work
  - Merge results back to main
- [ ] **Agent Specializations**
  - Architect: System design
  - Frontend: UI/UX implementation
  - Backend: API and data layer
  - Tester: Test generation
  - Reviewer: Code review
  - Security: Security analysis
- [ ] **Consensus Strategies**
  - Majority vote
  - Weighted by confidence
  - Expert override
  - Human tiebreaker
- [ ] **Workflow Orchestration**
  - Define multi-agent workflows
  - Parallel and sequential steps
  - Dependency management

### Technical Notes
- Build on v0.5.0 multi-agent system
- Add worktree support to git package
- Voting via structured output

---

## Version Timeline

| Version | Target | Focus |
|---------|--------|-------|
| v1.6.0 | Q1 2026 | Enhanced MCP |
| v1.7.0 | Q1 2026 | Advanced Agent Mode |
| v1.8.0 | Q2 2026 | Context System |
| v1.9.0 | Q2 2026 | RAG System |
| v1.10.0 | Q2 2026 | Architect Mode |
| v2.0.0 | Q3 2026 | VS Code Extension |
| v2.1.0 | Q3 2026 | JetBrains Plugin |
| v2.2.0 | Q4 2026 | Zed Extension |
| v2.3.0 | Q4 2026 | Neovim Plugin |
| v2.4.0 | Q4 2026 | Cursor & Visual Studio |
| v2.5.0 | Q1 2027 | Agent Council |

---

## Architecture Vision

```
                    ┌─────────────────────────────────────┐
                    │           Editor Extensions         │
                    │  VS Code │ JetBrains │ Zed │ Neovim │
                    └──────────────┬──────────────────────┘
                                   │
                                   │ JSON-RPC / WebSocket / ACP
                                   │
┌──────────────────────────────────┼──────────────────────────────────┐
│                                  ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    SuperAI CLI Core (Go)                      │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │  TUI    │ │ Web UI  │ │  API    │ │  MCP    │ │ Plugins │ │ │
│  │  │Dashboard│ │ Server  │ │ Server  │ │ Client  │ │ System  │ │ │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │ │
│  │       │           │           │           │           │       │ │
│  │  ┌────┴───────────┴───────────┴───────────┴───────────┴────┐ │ │
│  │  │                    Core Services                        │ │ │
│  │  │  Agent Pool │ Session │ Metrics │ Git │ RAG │ Context  │ │ │
│  │  └─────────────────────────┬───────────────────────────────┘ │ │
│  │                            │                                  │ │
│  │  ┌─────────────────────────┴───────────────────────────────┐ │ │
│  │  │                    LLM Providers                        │ │ │
│  │  │  OpenAI │ Anthropic │ Google │ Azure │ Ollama │ Custom │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                         SuperAI CLI "Mecha Suit"                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Contributing

See [AGENTS.md](./AGENTS.md) for development guidelines.

See [FEATURE-MATRIX.md](./FEATURE-MATRIX.md) for feature comparison with other tools.
