# borg Roadmap: The Ultimate SuperAI

## Phase 13: Local AI Tool Governance (In Progress)
- [x] **Tool Spreadsheet:** Dashboard inventory of local tools (Docker, Redis, etc.).
- [x] **Status Detection:** Auto-discovery of installed CLI tools.
- [x] **Process Monitor:** Watchdog for background services.
- [x] **Hardware Stats:** Real-time resource monitoring.
- [x] **Ecosystem Dashboard:** Auto-generated `SUBMODULES.md` tracking 200+ integrated tools.
- [x] **Massive Submodule Integration:** Import and categorize 100+ external tools into `external/`.
- [x] **Resource Indexing:** `FEATURES_CATALOG.md` created with research status.
- [ ] **Unified Dashboarding:** Create UI pages for Jules, Opencode, and General Tool management.

## Phase X: Deep Research & Absorption (Continuous)
**Goal:** Achieve feature parity with the "Definitive Borg Resource Index" (432 tools).
- [ ] **Ingest:** Process `reference/aios_master_index.csv`.
- [ ] **Analyze:** Sub-agents to scrape and summarize every tool.
- [ ] **Absorb:** Re-implement key features into Borg Core.
- [ ] **Submodules:** Add all relevant repos as upstream references.

## Phase 20: Borg Core Implementation (New)
**Goal:** Build the "Director + Swarm" Orchestrator.
- [x] **Scaffolding:** Monorepo (Turborepo), Next.js Dashboard, Core Package initialized.
- [x] **ModelSelector:** Quota management logic and **Automatic Fallback** (Priority).
- [x] **Universal MCP Host:** Basic `MCPServer` wrapper created.
- [x] **Router Logic:** Implement sub-MCP routing.
- [x] **Dashboard UI:** Connect WebUI to Core via tRPC/WebSockets.

## Phase 14: Deep Code Intelligence (The Foundation)
**Goal:** Establish the robust indexing and execution layer required for high-fidelity coding.

### Robust Indexing
- [x] **Vector Integration:** Enhance `RepoMapService` to use vector embeddings for semantic search (RAG).
- [x] **Tree-sitter Deep Dive:** Upgrade symbol extraction to support full call graphs and type hierarchies.
- [ ] **Graph Service:** Finalize `RepoGraphService` to visualize import/export dependencies.

### Secure Execution
- [ ] **Sandboxing:** Finalize `SandboxService` for secure Docker/WASM code execution (Integrating `code-sandbox/` tools).
- [ ] **Auto-Test Runner:** Automatically detect and run relevant tests for modified files.

## Phase 15: The SuperAI Harness (Feature Parity)
**Goal:** Match and exceed the capabilities of Amp, Auggie, Claude Code, Codebuff, and OpenCode.

### Core Engine
- [x] **Unified CLI Runner:** Create `borg cli` wrapper to transparently invoke any integrated CLI (`superai-cli/`).
- [x] **Unified TUI/WebUI:** Ensure 100% feature parity between terminal and web interfaces.
- [ ] **Mobile Remote Control:** Responsive mobile UI for monitoring and intervening in agent sessions.
- [ ] **Shell Integration:** Deep shell history integration and context awareness (Warp-style).

### Advanced Coding Features
- [ ] **Multi-File Context:** "Add to Context" logic similar to Aider/Claude Code.
- [ ] **In-Chat Commands:** Slash commands for git operations, diff reviews, and undo steps.
- [ ] **Symbol Pinning:** UI to manually prioritize specific code symbols.
- [ ] **Auto-Dev Loops:** "Fix until Pass" modes for tests and linters.

## Phase 16: The SuperAI Browser Extension
**Goal:** Bridge local context into web-based AI models (ChatGPT, Gemini, Claude.ai).

### Functionality Injection
- [ ] **MCP Injection:** Expose local MCP tools (FS, Git, Terminal) to web chats via browser extension.
- [ ] **Context Export:** One-click export of web chats into Borg long-term memory.
- [ ] **Memory Recording:** Background recording of browsing research into the Vector Store.

### Browser Capabilities (via MCP)
- [ ] **Page Scraping:** Turn current page content into markdown context (Integrating `browser-use/`).
- [ ] **Console Reader:** Stream browser console logs to the Borg debugger.
- [ ] **History & Email:** Secure access to history and GMail via authenticated MCP servers.

## Phase 17: Universal MCP & Orchestration
- [x] **Traffic Inspector:** Real-time JSON-RPC inspection (Completed in Core).
- [x] **Dynamic Disclosure:** Hide tools until needed to save context.
- [x] **Semantic Reranking:** Optimize tool descriptions for model consumption.
- [x] **Proxy System:** Bridge remote/local servers.

## Phase 18: Multi-Agent Squads
- [ ] **Consensus Protocol:** Multi-model debate engine.
- [ ] **Git Worktree Squads:** Parallel coding agents in isolated branches.
- [ ] **Local-Remote Bridge:** Sync projects between local machine and cloud instances.

## Phase 19: Enterprise & Ecosystem (Restored)
### Advanced Governance & Security
- [x] **RBAC Foundation:** Role-based access control service and middleware (admin, developer, operator, viewer)
- [ ] **SSO integration:** OIDC/SAML foundation
- [x] **Enhanced Audit Logging:** Comprehensive audit trails for agent, council, and architect actions
- [ ] **Policy Engine:** Declarative policies for agent behavior and resource usage

### Distributed Orchestration
- [ ] **Multi-Node Council:** Distributed supervisor councils across different regions/nodes
- [ ] **Agent-to-Agent (A2A) Mesh:** Secure communication protocol for autonomous agent cooperation
- [ ] **Edge Deployment:** Lightweight Borg runtime for edge devices

### Developer Ecosystem
- [ ] **Borg Marketplace:** Registry for sharing supervisors, skills, and agent templates
- [ ] **Visual Designer:** Low-code interface for designing agent workflows and council structures
- [ ] **OpenAPI / SDK:** Formalized external API and multi-language SDKs (Python, Go, Rust)

### Performance & Scalability
- [ ] **GPU Acceleration:** Native support for local model acceleration (llama.cpp integration)
- [ ] **Tiered Memory:** Advanced memory management with cold storage and semantic caching
- [ ] **Batch Processing:** High-throughput task execution for large-scale operations
