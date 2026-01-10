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

## Phase 6: Economy & Autonomy (Completed)
- [x] **Bobcoin Integration:** Submodule added and Economy Manager implemented (Mock).
- [x] **Universal Instructions:** Centralized agent instructions and development protocol.
- [x] **Infrastructure Simulation:** Node Manager (Tor, Torrent, Storage) implemented.
- [x] **Miner CLI:** `super-ai mine` command for simulating physical activity.
- [x] **Ralph Loop Maintenance:** Periodic synchronization of all submodules (v1.2.1).
- [x] **Physical Mining:** Integrate real hardware signals (Serial/GPIO) for "Proof of Dance".
- [x] **Wallet Connect:** Real wallet integration via WalletManager with viem.

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
- [x] **Wallet Connect:** WalletManager with viem (multi-chain: mainnet, sepolia, polygon, arbitrum, optimism, base)
- [x] **Physical Mining:** HardwareManager with serialport integration for Proof-of-Dance
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
