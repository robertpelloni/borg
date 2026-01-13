# aios Roadmap
# include "CORE_INSTRUCTIONS.md"

## Phase 1: Foundation (Completed)
- [x] Monorepo Structure (pnpm workspaces)
- [x] Core Service (Fastify + Socket.io)
- [x] UI Shell (React + Vite)
- [x] Basic Managers (Agents, Skills, Hooks, Prompts)
- [x] MCP Server Management (Local stdio)

## Phase 2: Enhancement (Completed)
- [x] **Documentation & Standards**
    - [x] Universal LLM Instructions (`docs/agents/UNIVERSAL_INSTRUCTIONS.md`)
    - [x] Project Structure Documentation (`docs/project/STRUCTURE.md`)
    - [x] Versioning System (`VERSION`, `CHANGELOG.md`, sync scripts)
- [x] **Dashboard Improvements**
    - [x] Submodule Status & Versioning
    - [x] System Health Check
- [x] **Extended Capabilities**
    - [x] recursive prompt loading (Done)
    - [x] Persistent Mock Server (Done)

## Phase 3: Multi-Platform & Clients (Completed)
- [x] **CLI Wrapper:** Orchestrate other CLI tools (Claude, Gemini).
- [x] **VSCode Extension:** Connect to Core Service.
- [x] **Chrome Extension:** Connect to Core Service.

## Phase 4: Advanced Features (Completed)
- [x] **Multi-CLI Orchestration:** Pipe output from one CLI to another (PipelineTool).
- [x] **Context Injection:** Inject context into browser/IDE.
- [x] **RAG:** Document library and vector search (VectorStore + MemoryManager).
- [x] **"Toon" Format:** JSON -> Toon translation.
- [x] **Agent Execution:** ReAct loop via AgentExecutor and ModelGateway.

## Phase 5: Intelligence & Autonomy (Completed)
- [x] **Memory Consolidation:** Summarize logs into long-term memory.
- [x] **Autonomous Loops:** Agents that can self-schedule and recurse indefinitely (LoopManager).
- [x] **Deep Research:** Dedicated agent for multi-step web research.
- [x] **Auth & Security:** Secure Socket.io and API endpoints.

## Phase 6: Autonomy & Infrastructure (Completed)
- [x] **Universal Instructions:** Centralized agent instructions and development protocol.
- [x] **Infrastructure Simulation:** Node Manager (Tor, Torrent, Storage) implemented.
- [x] **Ralph Loop Maintenance:** Periodic synchronization of all submodules (v1.2.1).
- [x] **Hardware Integration:** Serial/GPIO support for physical device signals.

## Phase 7: Maintenance & Stability (Completed)
- [x] **Deep Initialization:** Submodule synchronization and cleanup.
- [x] **Documentation Consolidaton:** `AGENTS.md` and `SUBMODULES.md`.
- [x] **Versioning Standard:** Unified `VERSION` file and changelog tracking.
- [x] **CI/CD Pipelines:** Automated testing and build verification.
- [x] **Type Safety:** Strict TypeScript configuration across all packages.

## Phase 8: Ecosystem Expansion (Completed)
### Infrastructure
- [x] **Directory Reorganization:** Created specialized directories (RAG, memory, code-indexing, computer-use, code-sandbox, search, financial, skills, superai-cli)
- [x] **RAG Systems:** Added 9 RAG submodules (langchain, haystack, chroma, qdrant, weaviate, milvus, orama, instructor, docling)
- [x] **Code Indexing:** Added 4 code-indexing tools (aider, bloop, ast-grep, tree-sitter)
- [x] **Computer Use:** Added 4 browser automation tools (playwright, stagehand, algonius-browser, chrome-devtools-mcp)
- [x] **Agent Frameworks:** Added 4 agent frameworks (autogen, crewai, smolagents, openhands)
- [x] **Sandboxing:** Added 4 code execution tools (open-interpreter, e2b, cohere-terrarium, dagger)
- [x] **Documentation:** Created RESOURCES.md for all new directories

### Core Features
- [x] **Hardware Integration:** HardwareManager with serialport support for physical devices
- [x] **Multi-CLI Swiss Army Knife:** ClientManager with full orchestration (claude/gemini/opencode/aider/cursor/codex/cline)

### Advanced MCP Features
- [x] **Lazy loading of MCP tools:** Via `load_tool` meta-tool in McpRouter
- [x] **Tool chaining across MCPs:** Via `mcp_chain` meta-tool in McpRouter
- [x] **Dynamic registry updates:** Auto-refresh with `refreshRoutingTable()`

### Agent Improvements
- [x] **Agent auto-reflection:** Implemented in AutonomousAgent.ts
- [x] **A2A (Agent-to-Agent) protocol:** Full A2AManager with Google A2A spec support
- [x] **Repo map AST summarization:** RepoMapService with multi-language support (TS/JS/Python/Go/Rust)

### Memory System
- [x] **Memory deduplication:** Jaccard similarity (0.85 threshold) in MemoryManager
- [x] **Memory backfill from session logs:** `backfillFromSessionLogs()` with insight extraction

### UI Enhancements
- [x] **EcosystemList sync status badge:** Color-coded badges (synced/behind/ahead/diverged)
- [x] **Real-time submodule health indicators:** useSubmoduleHealth hook with polling

### Implementation Gaps (Resolved)
- [x] CouncilManager health check: Replaced setTimeout with `waitForAgentReady()` health polling
- [x] PythonExecutor Docker execution: Full Docker + local fallback implementation
- [x] ClientManager CLI integration: Complete with 7 CLI adapters
- [x] McpRouter naming conflicts: Namespaced tool resolution with conflict handling

## Phase 9: Production Readiness (Completed)
### Performance Optimization
- [x] **CacheService:** LRU cache with TTL, eviction, cleanup, and `cached()` helper
- [x] **ConnectionPoolService:** Generic connection pooling with acquire/release, maintenance, stats

### Security Hardening
- [x] **Rate Limiting:** RateLimitMiddleware integrated into McpRouter
- [x] **API Key Rotation:** SecretManager.rotateSecret(), scheduleRotation(), getExpiredSecrets()
- [x] **Audit Logging:** AuditService with JSONL logs, retention policy, query API

### Monitoring
- [x] **MetricsService:** Counters, gauges, histograms with Prometheus export
- [x] **TelemetryService:** Distributed tracing with spans, W3C trace context support
- [x] **Health Endpoints:** /health and /api/system/status

### Documentation
- [x] **API Reference:** docs/API_REFERENCE.md - REST, WebSocket, services documentation
- [x] **Deployment Guide:** docs/DEPLOYMENT.md - Docker, Kubernetes, scaling, security

## Phase 10: MetaMCP Migration (Completed)
### Core Engine Integration
- [x] **SQLite Schema:** Full database schema with types, interfaces, and DDL (packages/core/src/db/schema.ts)
- [x] **DatabaseManager:** Singleton CRUD manager for all entities - MCP servers, tools, namespaces, endpoints, policies, API keys, tool call logs, saved scripts, tool sets
- [x] **Enhanced McpManager:** Multi-transport support (STDIO, SSE, StreamableHTTP), namespace/endpoint management, policy integration, tool call logging
- [x] **ToolSearchService:** Fuzzy search (Fuse.js), semantic search (embeddings + cosine similarity), hybrid search with configurable weights
- [x] **PolicyService:** Priority-ordered policy evaluation, glob pattern matching, rate limiting, time-based conditions, policy templates

### Code Execution
- [x] **CodeExecutorService:** Secure sandboxed execution via isolated-vm (V8 isolates), MCP context injection (mcp.call), configurable memory/timeout limits, console capture
- [x] **SavedScriptService:** Script CRUD, favorites/tagging, execution tracking, import/export, syntax validation

### Services Module
- [x] **Unified Exports:** packages/core/src/services/index.ts - centralized service exports

## Phase 11: Multi-Model AI Council (Completed)
### Core Council Engine (from opencode-autopilot)
- [x] **Supervisor Framework:** BaseSupervisor with retry logic, exponential backoff
- [x] **Provider Adapters:** OpenAI, Anthropic, DeepSeek, Gemini, Grok/xAI, Qwen, Kimi/Moonshot
- [x] **SupervisorCouncilManager:** Core debate engine with multi-round deliberation
- [x] **8 Consensus Modes:** simple-majority, supermajority, unanimous, weighted, ceo-override, ceo-veto, hybrid-ceo-majority, ranked-choice
- [x] **Weighted Voting:** Formula: Σ(approved × weight × confidence) / Σ(weight)
- [x] **Dissent Tracking:** Strong rejection (confidence > 0.7) blocks auto-approval

### Council API
- [x] **REST Endpoints:** /api/council/* - 13 endpoints for supervisor and debate management
- [x] **Supervisor Management:** Add/remove/list supervisors, set weights
- [x] **Debate Operations:** Run debates, chat with fallback, configure consensus
- [x] **Settings API:** Update debateRounds, threshold, lead supervisor, fallback chain

### Documentation
- [x] **Council README:** docs/council/README.md - overview, quick start, architecture
- [x] **API Reference:** docs/council/API.md - full endpoint documentation
- [x] **Usage Guide:** docs/council/USAGE.md - scenarios, CI/CD integration, best practices
- [x] **Configuration:** docs/council/CONFIGURATION.md - providers, settings, security

### Council Dashboard UI (Completed)
- [x] **Human-in-the-Loop Veto:** VetoManager with approve/reject/extend timeout, countdown timers
- [x] **Debate History:** DebateHistoryManager with persistent records, analytics, search, JSON/CSV export
- [x] **Smart Pilot:** SmartPilotManager with auto-approval limits, pause/resume, configurable timeouts

### Future Council Enhancements (Completed)
- [x] **Dynamic Supervisor Selection:** Auto-select optimal team based on task type
- [x] **Supervisor Analytics:** Performance tracking per supervisor
- [x] **Debate Templates:** Pre-configured debate scenarios
- [x] **Plugin Ecosystem:** External supervisor plugins

## Phase 12: TUI Orchestrator (Completed)
- [x] **VS Code Extension:** IDE integration via Extension API (Council, Architect Mode, Analytics)
- [x] **JetBrains Plugin:** IntelliJ Platform integration (Kotlin, Tool Window, Actions)
- [x] **Zed Extension:** WASM-based extension for Zed editor (Rust, slash commands)
- [x] **Neovim Plugin:** Lua plugin with Telescope integration (full implementation)
- [x] **RAG System:** HNSW vector search + BM25 reranking (AIChat pattern)
- [x] **Architect Mode:** Two-model reasoning+editing (Aider pattern)
- [x] **Git Worktree Isolation:** Parallel agents in isolated checkouts (Claude-Squad pattern)

## Phase 13: Enterprise & Ecosystem (In Progress)
### Advanced Governance & Security
- [x] **RBAC Foundation:** Role-based access control service and middleware (admin, developer, operator, viewer)
- [ ] **SSO integration:** OIDC/SAML foundation
- [x] **Enhanced Audit Logging:** Comprehensive audit trails for agent, council, and architect actions
- [ ] **Policy Engine:** Declarative policies for agent behavior and resource usage

### Distributed Orchestration
- [ ] **Multi-Node Council:** Distributed supervisor councils across different regions/nodes
- [ ] **Agent-to-Agent (A2A) Mesh:** Secure communication protocol for autonomous agent cooperation
- [ ] **Edge Deployment:** Lightweight AIOS runtime for edge devices

### Developer Ecosystem
- [ ] **AIOS Marketplace:** Registry for sharing supervisors, skills, and agent templates
- [ ] **Visual Designer:** Low-code interface for designing agent workflows and council structures
- [ ] **OpenAPI / SDK:** Formalized external API and multi-language SDKs (Python, Go, Rust)

### Performance & Scalability
- [ ] **GPU Acceleration:** Native support for local model acceleration (llama.cpp integration)
- [ ] **Tiered Memory:** Advanced memory management with cold storage and semantic caching
- [ ] **Batch Processing:** High-throughput task execution for large-scale operations
