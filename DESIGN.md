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
3.  **Traffic Inspection:** Acts as a "Wireshark for MCP" (Mcpshark), logging all requests/responses to a persistent database (Postgres + pgvector) for auditing and debugging.
4.  **Code Mode:** Provides a secure sandbox (Docker/V8) for the LLM to execute code (TypeScript/Python) that chains multiple tool calls efficiently.

## Detailed Feature Design

### 1. Code Mode (The "One Tool" Philosophy)
Inspired by `Lootbox`, `code-executor-mcp`, and `pctx`, we will implement a `run_code` tool.
- **Mechanism:** The LLM writes a script (TS/Python) to achieve a goal.
- **Execution:** The script runs in a sandboxed environment (using `isolated-vm` or Docker).
- **Tool Access:** The sandbox has a bridge to call any available MCP tool.
- **Benefit:** Reduces context usage by 98%. Instead of 4 round trips to "read file", "analyze", "write file", "commit", the LLM writes one script to do it all.
- **TOON Support:** Results can be returned in "TOON" format (Token-Oriented Object Notation) - a compressed JSON/CSV hybrid - to further save tokens.

### 2. Semantic Tool Search & RAG
Inspired by `ToolRAG` and `Lazy MCP`.
- **Indexing:** Tool descriptions are embedded (using OpenAI embeddings) and stored in `pgvector`.
- **Retrieval:** When the LLM calls `search_tools("database")`, the Hub queries the vector DB and returns the most relevant tools.
- **Description Optimization:**
    - **In Memory/DB:** We store extremely detailed descriptions for accurate semantic matching.
    - **In Context:** When describing the tool to the LLM (after loading), we use a concise, optimized description to save tokens.

### 3. Progressive Disclosure & Lazy Loading
Inspired by `claude-lazy-loading` and `Switchboard`.
- **Default State:** The LLM sees only `search_tools`, `load_tool`, and `run_code`.
- **On Demand:** When the LLM identifies a need (e.g., "I need to check GitHub"), it searches/loads the specific tool set.
- **Context Savings:** Reduces initial context from ~100k tokens (for 50+ servers) to <2k tokens.

### 4. Tool Sets & Profiles
- **Grouping:** Users can define "Profiles" (e.g., "Web Dev", "Data Science") that pre-load specific sets of tools.
- **Auto-Discovery:** The Hub can scan `~/.claude.json`, `.mcp.json`, and directories to auto-configure servers.

## Tech Stack
- **Monorepo:** `pnpm workspaces`.
- **Core Service (Backend):** Node.js + Fastify + Socket.io + TRPC.
- **Database:** Postgres + pgvector.
- **Frontend:** React + Next.js (MetaMCP UI).
- **Sandboxing:** `isolated-vm` (for fast JS execution) or Docker (for Python/heavy tasks).
- **Submodules:** Extensive use of reference implementations (`references/`) to guide development.

## Directory Structure
- **`agents/`**: JSON definitions of sub-agents.
- **`skills/`**: Markdown files (`.skill.md`) defining capabilities.
- **`hooks/`**: Event handlers and configuration.
- **`mcp-servers/`**: Managed MCP servers.
- **`submodules/`**: Integration with `metamcp`.
- **`references/`**: Collection of 20+ reference repos (Lootbox, Code Mode, etc.).
- **`packages/core`**: The main Hub logic.
- **`packages/ui`**: The Dashboard.

## Universal Client Integration
To fulfill the vision of a "Super AI Plugin", the Hub must seamlessly integrate with the user's existing ecosystem. We will implement a **Client Manager** (inspired by `mcpenetes`) that:
1.  **Auto-Detects Clients:** Scans standard paths (documented in `docs/CLIENT_CONFIGS.md`) to find installed tools (VSCode, Cursor, Claude Desktop, etc.).
2.  **Config Injection:** Automatically edits the `mcp-servers.json` or equivalent config file of detected clients to add the **Super AI Plugin** as an upstream MCP server.
    - *Note:* This allows the user to install the Super Plugin once, and instantly have all their tools (VSCode, Chrome, CLI) connected to the Hub.
3.  **Conflict Resolution:** Merges existing configurations with the Hub's proxy configuration.

## Roadmap
1.  **Skeleton:** (Completed) Core service, UI, basic hooks.
2.  **Hub Refactor:** (Next) Integrate `metamcp` logic, set up `pgvector`, implement `search_tools` and `run_code`.
3.  **Code Mode:** Implement secure sandbox.
4.  **Inspection:** Build "Mcpshark" UI features.
5.  **Client Integration:** Implement the `ClientManager` to auto-configure the 50+ supported tools.
