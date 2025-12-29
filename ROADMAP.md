# Roadmap

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
- [ ] **Auth & Security:** Secure Socket.io and API endpoints.

## Phase 6: Economy & Autonomy (In Progress)
- [x] **Bobcoin Integration:** Submodule added and Economy Manager implemented (Mock).
- [x] **Universal Instructions:** Centralized agent instructions and development protocol.
- [x] **Infrastructure Simulation:** Node Manager (Tor, Torrent, Storage) implemented.
- [x] **Miner CLI:** `super-ai mine` command for simulating physical activity.
- [ ] **Physical Mining:** Integrate real hardware signals (Serial/GPIO) for "Proof of Dance".
- [ ] **Wallet Connect:** Real wallet integration.
