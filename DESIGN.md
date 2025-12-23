# Super AI Plugin Design Document

## Vision
The **Super AI Plugin** is a **Meta-Orchestrator** and an **Open Source AI OS layer**. It wraps the developer's environment (VSCode, Chrome, CLI) and provides the "glue" that proprietary tools usually keep hidden.

It acts as a central nervous system that orchestrates:
- **Multi-CLI Tools:** Claude Code, Gemini CLI, OpenCode, etc.
- **MCP Servers:** Managing connections, configuration, and traffic.
- **Context:** Saving, handoff, automatic memory, and injection.
- **Agents & Skills:** Defining and routing tasks to sub-agents.

## Core Architecture: The "Hub" Model
We are adopting a **Hub/Proxy/Router** architecture, inspired by `metamcp`, `mcp-proxy`, and `Switchboard`. The Hub serves as the single entry point for all MCP clients (Claude Desktop, Cursor, etc.).

### Key Responsibilities of the Hub:
1.  **Aggregation:** Connects to 50+ downstream MCP servers but presents a unified interface to the client.
2.  **Progressive Disclosure:** Instead of exposing 1000 tools to the LLM context (costing 100k+ tokens), the Hub exposes only a few meta-tools (`search_tools`, `load_tool`, `run_code`).
3.  **Traffic Inspection & Usage Tracking:**
    - Acts as a "Wireshark for MCP" (Mcpshark), logging all requests/responses to a persistent database (Postgres + pgvector).
    - **Cost Tracking:** Estimates token usage and cost per session based on model pricing and request size.
4.  **Code Mode:** Provides a secure sandbox (Docker/V8) for the LLM to execute code (TypeScript/Python) that chains multiple tool calls efficiently.

## Detailed Feature Design

### 1. Code Mode (The "One Tool" Philosophy)
Inspired by `Lootbox`, `code-executor-mcp`, and `pctx`, we will implement a `run_code` tool.
- **Mechanism:** The LLM writes a script (TS/Python) to achieve a goal.
- **Execution:** The script runs in a sandboxed environment. We use `isolated-vm` for secure V8 isolation, with a fallback to Node.js `vm` module for environments where native module builds are restricted.
- **Tool Access:** The sandbox has a bridge to call any available MCP tool via `call_tool`.
- **Benefit:** Reduces context usage by 98%. Instead of 4 round trips to "read file", "analyze", "write file", "commit", the LLM writes one script to do it all.
- **TOON Support:** Results can be returned in "TOON" format (Token-Oriented Object Notation) - a compressed JSON/CSV hybrid - to further save tokens.

### 2. Semantic Tool Search & RAG
Inspired by `ToolRAG` and `Lazy MCP`.
- **Indexing:** Tool descriptions are embedded (using OpenAI embeddings) and stored in `pgvector`.
- **Retrieval:** When the LLM calls `search_tools("database")`, the Hub queries the vector DB and returns the most relevant tools.
- **Description Optimization:**
    - **In Memory/DB:** We store extremely detailed descriptions for accurate semantic matching.
    - **In Context:** When describing the tool to the LLM (after loading), we use a concise, optimized description to save tokens.

### 3. Integrated Memory System (`claude-mem`)
We are integrating `claude-mem` directly into the Hub as a core plugin/library (located in `submodules/claude-mem`), rather than creating separate ports for every client.
- **Hook Bridging:** The Hub's `HookManager` intercepts events from all connected clients (OpenCode, Gemini, VSCode) and forwards them to the memory engine:
    - `SessionStart` -> Inject "Memory Index" into the conversation context.
    - `PostToolUse` -> Trigger "Observation Capture" to store tool outputs in the vector DB.
    - `SessionEnd` -> Generate and store session summaries.
- **Tool Exposure:** The `mem-search` tool is exposed via the Hub's MCP interface, allowing any client (even those without native memory support) to recall past information.
- **Benefit:** A unified, persistent memory graph shared across all developer tools.

### 4. Progressive Disclosure & Lazy Loading
Inspired by `claude-lazy-loading` and `Switchboard`.
- **Default State:** The LLM sees only `search_tools`, `load_tool`, and `run_code`.
- **On Demand:** When the LLM identifies a need (e.g., "I need to check GitHub"), it searches/loads the specific tool set.
- **Context Savings:** Reduces initial context from ~100k tokens (for 50+ servers) to <2k tokens.

### 4. Tool Sets & Profiles
- **Grouping:** Users can define "Profiles" (e.g., "Web Dev", "Data Science") that pre-load specific sets of tools.
- **Auto-Discovery:** The Hub can scan `~/.claude.json`, `.mcp.json`, and directories to auto-configure servers.

## Tech Stack
- **Monorepo:** `pnpm workspaces`.
- **Core Service (Backend):** Node.js + Fastify (v5) + Socket.io + TRPC.
- **Database:** Postgres + pgvector.
- **Frontend:** React + Next.js (MetaMCP UI).
- **Sandboxing:** `isolated-vm` (preferred) or Node.js `vm` (fallback).
- **Submodules:** Extensive use of reference implementations (`references/`) to guide development.

## Directory Structure
- **`agents/`**: JSON definitions of sub-agents.
- **`skills/`**: Markdown files (`.skill.md`) defining capabilities.
- **`hooks/`**: Event handlers and configuration.
- **`mcp-servers/`**: Managed MCP servers.
- **`submodules/`**: Core integrations (`metamcp`, `mcpenetes`, `claude-mem`).
- **`references/`**: Collection of 50+ reference repos serving as libraries or inspiration. See `docs/ECOSYSTEM_INTEGRATION.md` for details.
- **`packages/core`**: The main Hub logic.
- **`packages/ui`**: The Dashboard.

## Implementation Strategy
The development is guided by a strict roadmap found in [`ROADMAP.md`](./ROADMAP.md). We adopt a "Reference & Adapt" strategy:
1.  **Analyze Reference:** Examine the submodule (e.g., `mcpenetes`).
2.  **Extract Logic:** Port the core logic (e.g., client detection algorithms) into the Core Service (`packages/core`).
3.  **Integrate:** Wire the logic into the Hub's Manager system.

### Current Implementation Status
- **Hub Server:** Implemented in `packages/core/src/hub/HubServer.ts` using `@modelcontextprotocol/sdk`. Exposes SSE endpoints.
- **Proxy Manager:** `McpProxyManager.ts` aggregates tools from all running MCP servers managed by `McpManager`, namespacing them (e.g., `server__tool`) to prevent collisions.
- **Protocol Bridge:** The Hub bridges SSE clients (Hub consumers) to Stdio servers (Downstream tools).

## Ecosystem Integration
The project leverages a vast ecosystem of submodules for specific capabilities. Please refer to [`docs/ECOSYSTEM_INTEGRATION.md`](./docs/ECOSYSTEM_INTEGRATION.md) for the detailed strategy on how `MCP-SuperAssistant`, `mux`, `smolagents`, and others are integrated into the architecture.

## Universal Client Integration
To fulfill the vision of a "Super AI Plugin", the Hub must seamlessly integrate with the user's existing ecosystem. We will implement a **Client Manager** (inspired by `mcpenetes`) that:
1.  **Auto-Detects Clients:** Scans standard paths (documented in `docs/CLIENT_CONFIGS.md`) to find installed tools (VSCode, Cursor, Claude Desktop, etc.).
2.  **Config Injection:** Automatically edits the `mcp-servers.json` or equivalent config file of detected clients to add the **Super AI Plugin** as an upstream MCP server.
    - *Note:* This allows the user to install the Super Plugin once, and instantly have all their tools (VSCode, Chrome, CLI) connected to the Hub.
3.  **Conflict Resolution:** Merges existing configurations with the Hub's proxy configuration.

## Roadmap
1.  **Skeleton:** (Completed) Core service (Fastify v5), UI (React), basic hooks, Submodules added.
2.  **Hub Refactor:** (Next) Integrate `metamcp` logic, set up `pgvector`, implement `search_tools` and `run_code`.
3.  **Code Mode:** Implement secure sandbox (currently using `vm` fallback).
4.  **Inspection:** Build "Mcpshark" UI features.
5.  **Client Integration:** Implement the `ClientManager` to auto-configure the 50+ supported tools.
