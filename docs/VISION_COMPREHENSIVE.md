# Borg: The Comprehensive Vision Document

**Version:** 0.4.0  
**Last Updated:** 2026-01-09  
**Status:** Living Document

---

## Executive Summary

**Borg (Super AI Plugin)** is a **Meta-Orchestrator** for the Model Context Protocol (MCP). It serves as the universal operating system for AI tools, acting as a "Motherboard" that connects, coordinates, and enhances any AI agent, tool, or service. The project embodies three core philosophies:

1. **Universal Integration** - Aggregate, don't compete
2. **Active Intelligence** - Autonomous agents with persistent memory
3. **Physical-Digital Bridge** - The Bobcoin "Proof of Health" economy

---

## Part I: The "Motherboard & OS" Vision

### 1.1 Core Metaphor

Borg is to AI tools what an operating system is to hardware:

| Computer | Borg |
|----------|------|
| Motherboard | Core Service (Hub) |
| CPU | ModelGateway (LLM abstraction) |
| RAM | Memory Orchestrator (VectorStore + Providers) |
| USB Ports | MCP Server Connections |
| Device Drivers | Adapters (Claude, Gemini, OpenCode) |
| Applications | Agents & Skills |
| File System | Context & Document Managers |
| Task Scheduler | SchedulerManager + LoopManager |
| Control Panel | Web Dashboard (packages/ui) |
| Terminal | CLI (packages/cli) |

### 1.2 The Universal Hub Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Borg HUB                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  HubServer  │  │ McpProxy    │  │    ProgressiveDisclose  │  │
│  │  (JSON-RPC) │  │ Manager     │  │    (search_tools,       │  │
│  │             │  │             │  │     load_tool)          │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                │
│  ┌──────┴────────────────┴─────────────────────┴──────────────┐ │
│  │                    TOOL REGISTRY                            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │ Internal │ │  Local   │ │  MetaMCP │ │ External │       │ │
│  │  │  Tools   │ │ MCP Srvs │ │  (Docker)│ │   CLIs   │       │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              │              │              │              │
              ▼              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Claude  │  │  VSCode  │  │  Browser │  │  Custom  │
        │ Desktop  │  │ Extension│  │ Extension│  │  Client  │
        └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Part II: Technical Architecture

### 2.1 Monorepo Structure

```
borg/
├── packages/
│   ├── core/           # The Brain - Fastify + Socket.io + Managers
│   ├── ui/             # The Control Center - Next.js Dashboard
│   ├── cli/            # Terminal Interface - super-ai commands
│   ├── adapters/       # CLI Wrappers - Claude, Gemini, OpenCode
│   ├── vscode/         # VSCode Extension Client
│   └── types/          # Shared TypeScript Definitions
├── agents/             # JSON Agent Definitions (ReAct pattern)
├── skills/             # 100+ Markdown Skill Files
├── mcp-servers/        # Local MCP Server Instances
├── submodules/         # 70+ External Integrations
├── docs/               # Comprehensive Documentation
├── prompts/            # System Prompt Library
├── documents/          # RAG Ingestion Drop Zone
├── commands/           # Slash Command Definitions
└── hooks/              # Event Hook Configurations
```

### 2.2 The Manager Pattern

All subsystems are implemented as **Manager** classes extending `EventEmitter`:

| Manager | Responsibility |
|---------|----------------|
| **AgentManager** | Load/watch agent definitions from JSON |
| **SkillManager** | Load/watch markdown skill files |
| **MemoryManager** | Orchestrate memory providers (File, Mem0, Pinecone, Browser) |
| **ContextManager** | Watch and analyze context files |
| **McpProxyManager** | Route tool calls, progressive disclosure, internal tools |
| **HubServer** | Central JSON-RPC handler for MCP protocol |
| **SessionManager** | Persist agent conversation sessions |
| **SchedulerManager** | Cron-based task scheduling |
| **LoopManager** | Autonomous agent loops |
| **DocumentManager** | Chunk and store documents for RAG |
| **SecretManager** | Secure API key storage |
| **ProfileManager** | User configuration profiles |
| **HandoffManager** | Agent-to-agent context transfer |
| **BrowserManager** | Browser automation and tab reading |
| **VSCodeManager** | VSCode integration |
| **EconomyManager** | Bobcoin mock economy |
| **NodeManager** | Infrastructure (Tor, Torrent, Storage) |
| **ConductorManager** | Multi-agent orchestration |
| **VibeKanbanManager** | Task board management |
| **SystemTrayManager** | Desktop tray icon and notifications |

### 2.3 API Endpoints (Hono/Fastify)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | System health status |
| `/api/doctor` | GET | Full system diagnostics |
| `/api/state` | GET | Complete system state (agents, skills, hooks, etc.) |
| `/api/hub/sse` | GET | SSE streaming for MCP clients |
| `/api/hub/messages` | POST | JSON-RPC message handling |
| `/api/agents/run` | POST | Execute an agent with a task |
| `/api/mcp/start` | POST | Start an MCP server |
| `/api/mcp/stop` | POST | Stop an MCP server |
| `/api/secrets` | GET/POST/DELETE | Manage API keys |
| `/api/sessions` | GET | List conversation sessions |
| `/api/profiles` | GET/POST | Manage user profiles |
| `/api/memory` | GET | Memory dashboard data |
| `/api/marketplace` | POST | Install packages |
| `/api/conductor/start` | POST | Start conductor task |
| `/api/vibekanban/*` | Various | Kanban board operations |

---

## Part III: Feature Catalog

### 3.1 Progressive Disclosure

**Problem:** LLMs have limited context windows. Exposing 500+ tools wastes tokens.

**Solution:** Start with meta-tools, load on demand.

**Default Tools:**
- `search_tools` - Fuzzy search via Fuse.js
- `load_tool` - Whitelist tool for session (FIFO at 200)
- `run_code` - Execute TypeScript/Python in sandbox
- `run_agent` - Spawn sub-agent

**Benefits:**
- Token reduction: 100k → 1k
- Focus: LLM sees only relevant tools
- Scale: Connect hundreds of MCP servers

### 3.2 Memory Orchestrator

**Vision:** Unified interface across multiple memory backends.

**Providers:**
- `FileMemoryProvider` - Local JSON/SQLite
- `Mem0Provider` - mem0.ai cloud
- `PineconeProvider` - Vector database
- `BrowserStorageProvider` - Extension storage

**Features:**
- **Context Compactor:** Extract Facts, Decisions, Action Items from raw streams
- **Ingestors:** AgentMessageBroker, Jules, Tool hooks
- **Git Sync:** Export to `.borg/memory_export.json` for cloud agent access
- **Dashboard:** `/memory` page with semantic search

### 3.3 Agent System

**ReAct Pattern Implementation:**

```typescript
interface AgentDefinition {
  name: string;
  model: string; // e.g., "gpt-4-turbo", "claude-3-5-sonnet-20241022"
  description: string;
  instructions: string;
  tools?: string[]; // Tool whitelist
}
```

**Built-in Agents:**
| Agent | Model | Purpose |
|-------|-------|---------|
| `researcher` | gpt-4-turbo | Deep web research with citations |
| `skill-user-agent` | claude-3-5-sonnet | Meta-agent using skill registry |
| `math-whiz` | (various) | Mathematical computations |

**Execution Flow:**
1. AgentExecutor constructs system prompt (global + user + agent config)
2. Calls ModelGateway with tool definitions
3. ReAct loop: Think → Act → Observe → Repeat
4. SessionManager saves conversation history

### 3.4 Autonomous Loops (LoopManager)

**Purpose:** Agents that self-schedule and run indefinitely.

**Tools:**
- `create_loop(name, agentName, task, cron)` - Start autonomous loop
- `stop_loop(loopId)` - Terminate loop

**Use Cases:**
- Nightly code review
- Continuous monitoring
- Periodic research updates

### 3.5 Code Mode (Sandboxed Execution)

**Strategy:** Hybrid sandbox combining:
- `isolated-vm` - Fast TypeScript execution
- Docker containers - Heavy Python workloads

**Features:**
- Tool access within sandbox
- Timeout protection
- Resource limits

### 3.6 Skill System

**100+ Skills** organized in `skills/imported/`:

| Category | Examples |
|----------|----------|
| **Document Generation** | docx, pptx, xlsx, pdf |
| **Notion Integration** | spec-to-implementation, research-documentation, meeting-intelligence, knowledge-capture |
| **Development** | mcp-builder, webapp-testing, codex-debug |
| **Creative** | theme-factory (10+ themes), algorithmic-art, canvas-design |
| **Productivity** | file-organizer, invoice-organizer, meeting-insights-analyzer |
| **Research** | content-research-writer, domain-name-brainstormer |

### 3.7 Multi-CLI Orchestration ("Swiss Army Knife")

**Philosophy:** Aggregate, don't compete.

**Integrated CLIs (as submodules):**

| CLI | Strength | Integration Role |
|-----|----------|------------------|
| **Aider** | SOTA code editing, Repo Map | Code Editor |
| **Gemini CLI** | Google ecosystem, multimodal | General Purpose |
| **Claude Code** | v2.0.74 coding assistant | Code Assistant |
| **Copilot CLI** | GitHub integration | Code Completion |
| **Mentat** | Coordinate-based editing | Alternative Editor |
| **Fabric** | Patterns for life/work | Wisdom Engine |
| **Goose** | Block's developer agent | Developer Agent |
| **KiloCode** | Memory Bank architecture | Project Manager |
| **Amp** | Oracle + Librarian | Researcher |
| **Plandex** | AI-powered planning | Planning |

**Feature Parity Goals:**
- **Oracle:** Route complex queries to reasoning models (o1/r1)
- **Librarian:** GitHub search and external repo queries
- **Toolboxes:** Auto-register scripts from `.borg/toolbox/`
- **Repo Map:** AST-based repository mapping

### 3.8 Client Integrations

| Client | Status | Configuration |
|--------|--------|---------------|
| **Claude Desktop** | ✅ Ready | `%APPDATA%\Claude\claude_desktop_config.json` |
| **VSCode** | ✅ Ready | `%APPDATA%\Code\User\globalStorage\mcp-servers.json` |
| **Browser Extension** | 🔨 Skeleton | `packages/browser/` |
| **Other MCP Clients** | ✅ Supported | Cursor, Cline, Roo Code, Continue, Cody, Codeium |

**Auto-Configuration:** `mcpenetes` v1.0.3 handles client setup.

---

## Part IV: Infrastructure & Hardware

### 4.1 Philosophy: Extensible Platform

Borg is designed to be an extensible platform that can integrate with various hardware and infrastructure components.

### 4.2 Technical Stack

- **Infrastructure:** Support for:
  - Distributed networking (Tor integration)
  - Distributed Storage
  - Game/Application Servers

### 4.3 Borg Role

The plugin is the **software layer** connecting hardware and services:

| Component | Function |
|-----------|----------|
| `NodeManager` | Tor, Torrent, Storage toggles |
| Hardware Integration | Serial/GPIO for device connections |

### 4.4 Implementation Status

- [x] Infrastructure simulation (Node Manager)
- [x] Hardware integration (Serial/GPIO)

---

## Part V: Submodule Ecosystem

### 5.1 Top 20 Critical Submodules

| Submodule | Version | Purpose |
|-----------|---------|---------|
| `opencode-autopilot` | v0.4.0 | AI session orchestration |
| `opencode-core` | latest | Core AI coding agent |
| `metamcp` | v2.4.21 | Docker-based MCP backend |
| `mcpenetes` | v1.0.3 | Client auto-configuration |
| `mcp-shark` | v1.5.9 | Traffic monitoring/replay |
| `agent-client-protocol` | v0.10.5 | MCP protocol spec |
| `mcp-hub` | v4.2.1 | Central MCP hub |
| `mcp-router` | v0.6.1 | Routing and load balancing |
| `mcp-manager` | main | Server management UI |
| `Agent-MCP` | v4.20.0 | MCP server for agents |
| `OmniParser` | v2.0.1 | Screen parsing/UI detection |
| `DesktopCommanderMCP` | v0.2.7 | Desktop command execution |
| `Windows-MCP` | v0.5.4 | Windows tool integration |
| `claude-code` | v2.0.74 | Claude coding assistant |
| `copilot-cli` | v0.0.373 | GitHub Copilot CLI |
| `gemini-bridge` | v1.2.0 | Gemini AI integration |
| `plandex` | v2.2.1 | AI planning tool |
| `software-agent-sdk` | v1.0.0 | Autonomous agent SDK |
| `opencode-sdk-js` | v0.1.0 | JS SDK for OpenCode |
| `mcp-launcher` | main | Automated server launcher |

### 5.2 Submodule Categories

| Category | Components |
|----------|------------|
| **Core Infrastructure** | metamcp, CLIProxyAPI, mcpproxy, Switchboard, mcp-funnel |
| **Interfaces** | jules-app, quotio, emdash, mcpenetes |
| **LLM Connectors** | opencode, gemini-cli, pluggedin |
| **Agent Runtimes** | Polymcp, superpowers, smolagents, claude-squad, magg |
| **Code Execution** | code-executor-MCP, lootbox, pctx |
| **Memory** | claude-mem, ToolRAG, lazy-mcp |
| **Observability** | mcp-shark |
| **Protocols** | A2A, a2a-js, a2a-python |

---

## Part VI: Development Roadmap

### Completed Phases

| Phase | Status | Highlights |
|-------|--------|------------|
| **1: Foundation** | ✅ | Monorepo, Core Service, UI Shell, Basic Managers |
| **2: Enhancement** | ✅ | Documentation, Dashboard, Versioning |
| **3: Multi-Platform** | ✅ | CLI Wrapper, VSCode Extension, Chrome Extension |
| **4: Advanced** | ✅ | PipelineTool, Context Injection, RAG, Toon Format |
| **5: Intelligence** | ✅ | Memory Consolidation, Autonomous Loops, Auth |
| **6: Infrastructure** | ✅ | Node Manager, Hardware Integration |
| **7: Maintenance** | ✅ | CI/CD, Type Safety, Documentation |

### Current Migration

**Fastify → Bun + Hono** (80% complete)

| Task | Status |
|------|--------|
| Server.ts rewrite | ✅ Done |
| SSE endpoint adaptation | 🔨 In Progress |
| Static file serving | 🔨 In Progress |
| Socket.io integration | ✅ Done |

### Future Directions

| Initiative | Description |
|------------|-------------|
| **Real Wallet** | Actual cryptocurrency integration |
| **A2A Protocol** | Agent-to-Agent standardized communication |
| **Voice Mode** | Voice control via voicemode reference |
| **Multi-Model Consensus** | Claude, Gemini, GPT debate before output |
| **Mobile Orchestration** | Manage dev from mobile devices |

---

## Part VII: UI Architecture Options

Based on conversation context, three paths forward:

| Option | Stack | Description |
|--------|-------|-------------|
| **A: TUI** | Bun + Ink (React for CLI) | Terminal-based "Mecha Suit" |
| **B: Web** | Bun + Hono + React/htmx | Browser dashboard (current) |
| **C: Both** | Hono backend + Ink CLI | API server + CLI client (recommended) |

**Current State:** Option B implemented with Next.js custom server.

---

## Part VIII: Anti-Patterns & Conventions

### Must Avoid

| Anti-Pattern | Reason |
|--------------|--------|
| `as any`, `@ts-ignore` | Type safety violations |
| Empty catch blocks | Silent error swallowing |
| Exposed secrets | Security breach |
| Simulated actions | Tools must do real work |
| Unicode in DOCX | Corruption issues |
| Git reverts without request | User control |
| GPT-5.0 models | Deprecated |
| opencode-workflows | Use keystone instead |

### Must Follow

| Convention | Implementation |
|------------|----------------|
| TypeScript | Strict, ES2022, NodeNext |
| Package Manager | pnpm workspaces |
| Linting | ESLint flat config, eslint-config-next |
| Styling | Tailwind CSS |
| Manager Pattern | All subsystems as Manager classes |
| Event-Driven | EventEmitter for cross-manager communication |

---

## Part IX: Quick Reference

### Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm run start:all        # Build & Start everything
pnpm --filter @borg/core dev   # Start Core only
pnpm --filter @borg/ui dev     # Start UI only
pnpm test                 # Run tests

# CLI
super-ai start            # Start Borg
super-ai status           # Check status
super-ai run <agent>      # Run agent
super-ai mine             # Submit activity (Bobcoin)
```

### Environment Variables

```env
MCP_STDIO_ENABLED=true    # Enable MCP stdio interface
MCP_PROGRESSIVE_MODE=true # Enable progressive disclosure
MEM0_API_KEY=xxx          # Mem0 cloud memory
JULES_API_KEY=xxx         # Jules platform sync
```

### Key Files

| File | Purpose |
|------|---------|
| `VERSION` | Single source of truth for version |
| `CHANGELOG.md` | Development history |
| `AGENTS.md` | Project knowledge base |
| `SUBMODULES.md` | Submodule dashboard |
| `ROADMAP.md` | Development phases |

---

## Conclusion

Borg represents a unified vision for AI tool orchestration:

1. **Universal Hub** - Connect any MCP server, CLI, or agent
2. **Intelligent Core** - Memory, context, autonomous execution
3. **Physical Bridge** - Bobcoin economy linking digital and physical worlds
4. **Ecosystem** - 70+ submodules, 100+ skills, multi-platform clients

The "Motherboard & OS" metaphor captures the essence: Borg doesn't replace tools, it connects and enhances them. It's the operating system for the AI age.

---

*"We don't compete. We aggregate. We orchestrate. We amplify."*
