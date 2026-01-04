# aios Design Document

## Vision
The **aios** is a **Universal AI Operating System**. It is a persistent, omni-present layer that orchestrates your entire development lifecycle.

The core philosophy is **"Completeness via Aggregation"**.
In a fragmented AI ecosystem, developers often fear "missing out" on the latest feature from a specific tool (e.g., `aider`'s git handling, `mem0`'s user profiles, `claude-code`'s TUI).
**aios solves this by aggregating them all.**
- We don't just build features; we wrap and orchestrate existing best-in-class tools.
- If a new standard emerges, we add an adapter.
- You use aios, and you automatically have access to the entire ecosystem's capabilities.

The core philosophy is **"Everything is a Plugin"**.
There is a main **Core Server** process that runs persistently (as an EXE, Docker container, or background service). This Core manages state, context, and agents. Everything else attaches to it:
- **Interfaces:** The Web Dashboard and CLI are just plugins that interact with the Core.
- **LLM Communication:** The Core can manage LLM connections directly, or delegate them to a host environment (like Gemini CLI or OpenCode) via hooks.
- **Agent Runtimes:** We support various Agent SDKs through compatibility layers.
- **Integrations:** The Core connects to IDEs, Browsers, and Cloud Dev Environments as a universal extension.

## The "Game Engine" Philosophy
The biggest challenge in the AI ecosystem is the proliferation of competing standards (the "XKCD Standards" problem).
- **Problem:** There are 10 different memory systems (`mem0`, `letta`, `cognee`), 5 agent frameworks, and 3 MCP implementations.
- **Solution:** We do not pick a winner. We act like a **Game Engine** (like Unity or Unreal).
    - **Abstraction Layers:** We define abstract interfaces for "Memory", "Agent", and "Tool".
    - **Adapters:** We write thin wrappers around submodules. If you want to use `mem0` for user profiles and `cognee` for graph memory, you can.
    - **Switchability:** You can hot-swap these components.
    - **Submodule Strategy:** We keep external projects as submodules. We hook into them "the right way" (using their public APIs or CLI hooks) so that updating them is a `git pull` away, minimizing maintenance.

## Core Architecture: The Universal Server
We are adopting a **Hub/Proxy/Router** architecture, expanded to support a universal deployment model.

### 1. The Core Server (The "Hub")
The Hub is the central nervous system. It can be deployed as:
- **Standalone Process:** A background service (EXE/Daemon) in autoruns.
- **Docker Container:** A self-contained environment.
- **Extension Host:** Embedded within VSCode or a Browser Extension.

### 2. The Plugin System ("Everything is a Plugin")
The architecture is modular to the extreme:
- **Interface Plugins:**
    - **Web Server:** Provides the React-based Dashboard.
    - **CLI:** A command-line interface for interacting with the Core.
    - **IDE Widgets:** UI components injected into VSCode/Cursor.
- **LLM Provider Plugins:**
    - **Direct:** The Core calls OpenAI/Anthropic/Gemini APIs directly.
    - **Delegated:** The Core acts as a plugin for `gemini-cli` or `opencode`, using their hooks for LLM communication.
    - **Super-Wrapper:** The Core wraps existing CLIs (like `claude-code` or `opencode`), intercepting their I/O to provide a rich Web UI, history, and "Superpowers" they lack natively.
- **Agent SDK Plugins:**
    - **Universal Host:** Adapters for **Google GenAI**, **OpenAI Assistants**, **Microsoft Semantic Kernel**, **AutoGen**, and **LangChain**.
    - **A2A Interoperability:** A standardized "Agent Bus" allowing a Google agent to talk to a Microsoft agent, sharing context and tools.

### 3. Connectivity & Orchestration (Remote vs. Local)
This is the core differentiator of the v0.4.3 architecture.

*   **Remote Realm (Jules):**
    *   **Submodule:** `submodules/jules-app`
    *   **Focus:** Persistent, cloud-based sessions.
    *   **Use Case:** Long-running research, team collaboration, "fire and forget" tasks.
    *   **State:** Stored in a remote DB (Postgres/Supabase).

*   **Local Realm (Council):**
    *   **Submodule:** `submodules/opencode-autopilot-council`
    *   **Focus:** Transient, local sessions tied to the current working directory.
    *   **Use Case:** Rapid iteration, local debugging, direct file manipulation on the user's machine.
    *   **State:** Transient (lives as long as the CLI/IDE session), but maintains a history of "Recent Sessions" locally.

*   **The Bridge (aios Hub):**
    *   The Hub routes traffic between these two realms.
    *   It allows a **Remote** agent (Jules) to ask a **Local** agent (Council) to "run this test on the user's machine."
    *   It allows a **Local** agent to "ask Jules to research this library online."

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
- **Hook Bridging:** The Hub`s `HookManager` intercepts events from all connected clients (OpenCode, Gemini, VSCode) and forwards them to the memory engine:
    - `SessionStart` -> Inject "Memory Index" into the conversation context.
    - `PostToolUse` -> Trigger "Observation Capture" to store tool outputs in the vector DB.
    - `SessionEnd` -> Generate and store session summaries.
- **Tool Exposure:** The `mem-search` tool is exposed via the Hub`s MCP interface, allowing any client (even those without native memory support) to recall past information.
- **Benefit:** A unified, persistent memory graph shared across all developer tools.

### 4. Progressive Disclosure & Lazy Loading
Inspired by `claude-lazy-loading` and `Switchboard`.
- **Default State:** The LLM sees only `search_tools`, `load_tool`, and `run_code`.
- **On Demand:** When the LLM identifies a need (e.g., "I need to check GitHub"), it searches/loads the specific tool set.
- **Context Savings:** Reduces initial context from ~100k tokens (for 50+ servers) to <2k tokens.

### 5. Tool Sets & Profiles
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
3.  **Integrate:** Wire the logic into the Hub`s Manager system.

### Current Implementation Status
- **Hub Server:** Implemented in `packages/core/src/hub/HubServer.ts` using `@modelcontextprotocol/sdk`. Exposes SSE endpoints.
- **Proxy Manager:** `McpProxyManager.ts` aggregates tools from all running MCP servers managed by `McpManager`, namespacing them (e.g., `server__tool`) to prevent collisions.
- **Protocol Bridge:** The Hub bridges SSE clients (Hub consumers) to Stdio servers (Downstream tools).

## Ecosystem Integration
The project leverages a vast ecosystem of submodules for specific capabilities. Please refer to [`docs/ECOSYSTEM_INTEGRATION.md`](./docs/ECOSYSTEM_INTEGRATION.md) for the detailed strategy on how `MCP-SuperAssistant`, `mux`, `smolagents`, and others are integrated into the architecture.

## Universal Client Integration
To fulfill the vision of a "aios", the Hub must seamlessly integrate with the user`s existing ecosystem. We will implement a **Client Manager** (inspired by `mcpenetes`) that:
1.  **Auto-Detects Clients:** Scans standard paths (documented in `docs/CLIENT_CONFIGS.md`) to find installed tools (VSCode, Cursor, Claude Desktop, etc.).
2.  **Config Injection:** Automatically edits the `mcp-servers.json` or equivalent config file of detected clients to add the **aios** as an upstream MCP server.
    - *Note:* This allows the user to install the aios once, and instantly have all their tools (VSCode, Chrome, CLI) connected to the Hub.
3.  **Conflict Resolution:** Merges existing configurations with the Hub`s proxy configuration.

## Roadmap
1.  **Skeleton:** (Completed) Core service (Fastify v5), UI (React), basic hooks, Submodules added.
2.  **Hub Refactor:** (Next) Integrate `metamcp` logic, set up `pgvector`, implement `search_tools` and `run_code`.
3.  **Code Mode:** Implement secure sandbox (currently using `vm` fallback).
4.  **Inspection:** Build "Mcpshark" UI features.
5.  **Client Integration:** Implement the `ClientManager` to auto-configure the 50+ supported tools.
