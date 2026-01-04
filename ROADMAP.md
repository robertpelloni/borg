# aios Roadmap & Implementation Plan

This document compiles the design decisions, planned features, and submodule integration strategies discussed throughout the project's inception. It serves as the master plan for developing the "aios".

For a granular list of every planned feature and submodule integration from the project inception, see:
👉 **[docs/DETAILED_BACKLOG.md](docs/DETAILED_BACKLOG.md)**

## 1. Core Infrastructure (The "Hub")
**Status:** In Progress (Skeleton Built)
**Reference:** `submodules/metamcp`

*   **Objective:** Build a robust Node.js/TypeScript service (`packages/core`) that acts as the central nervous system.
*   **Planned Features:**
    *   [x] **Server Skeleton:** Fastify + Socket.io (Done).
    *   [x] **Manager Pattern:** `HookManager`, `AgentManager`, `McpManager`, `HookExecutor` (Done).
    *   [x] **Router/Aggregator Logic:**
        *   [x] Implement intelligent routing of tool calls to downstream MCP servers (Reference: `metamcp`, `magg`).
        *   [x] Implement "Progressive Disclosure" (Lazy Loading) to keep context light (Reference: `lazy-mcp`, `Switchboard`).
    *   [x] **Traffic Inspection ("Mcpshark"):**
        *   [x] Build a UI to inspect MCP traffic in real-time (Reference: `mcpshark`, `metamcp` inspector).
        *   [x] Implement persistent logging to `pgvector` database. (Using `better-sqlite3`).
        *   [x] **Cost & Usage Tracking:** Calculate and display token usage and estimated cost per session/agent.
    *   [x] **Context Visualization:**
        *   **Attribution:** Track "what came from where" (source file, tool output, user input).
        *   [x] **Breakdown:** Visualize context composition (e.g., "30% Code, 20% Memory, 50% Conversation").
        *   [x] **Inspector:** Allow users to view the exact context window being sent to the model.
    *   [x] **Context Mining:**
        *   [x] **Auto-Audit:** Trigger an "Analyst Mode" at session end to find abandoned threads and connections.
        *   [x] **Layering:** Inject metadata (System, Dev, User, Session) in strict order.

## 2. Universal Client Integration
**Status:** ✅ Implemented (v0.0.9)
**Reference:** `submodules/mcpenetes`

*   **Objective:** Automatically configure the user's environment to use the Hub.
*   **Planned Features:**
    *   [x] **Client Detection:** Auto-detect installed tools (VSCode, Cursor, Claude Desktop).
    *   [x] **Config Injection:** Inject Hub as upstream MCP server via `configure_client` tool.
    *   [x] **Executable:** `bin/aios` wrapper for Stdio mode.

## 5. Integrated Memory System (Universal Orchestrator)
**Status:** 🚧 In Progress (Refactoring)
**Reference:** `docs/UNIVERSAL_MEMORY_STRATEGY.md`

*   **Objective:** Orchestrate multiple memory backends (local, cloud, browser) and synchronize data.
*   **Planned Features:**
    *   [x] **Memory Orchestrator:** Refactor `MemoryManager` to support pluggable providers (File, Mem0).
    *   [x] **Ingestion Engine:** Backend service to ingest, summarize, and tag raw content.
    *   [x] **Ingest UI:** User interface for manual text/document ingestion.
    *   [ ] **Dashboard:** UI for viewing, searching, and syncing memories across providers.
    *   [ ] **Auto-Detection:** Detect running vector DBs and config files.
    *   [ ] **Sync/Transfer:** Tools to move memories between systems.

## 4. Code Mode & Sandboxing
**Status:** ✅ Implemented
**Reference:** `references/pctx`, `references/mcp-server-code-execution-mode`

*   **Objective:** Allow the LLM to execute scripts to chain tools efficiently (98% token reduction).
*   **Planned Features:**
    *   [x] **`run_code` Tool:** Implement a tool that accepts TS/Python code.
    *   [x] **Sandbox Engine:** Integrate `isolated-vm` (Node.js) or Docker (Python) to run the code safely.
    *   [x] **Tool Bridge:** Inject a client into the sandbox so the script can call other MCP tools.
    *   [ ] **TOON Support:** Implement Token-Oriented Object Notation for compressed outputs.

## 5. Autonomous Agents & UI
**Status:** In Progress
**Reference:** `references/mux`, `references/smolagents`

*   **Objective:** Provide an interface for long-running, autonomous tasks.
*   **Planned Features:**
    *   [x] **Agent Loop:** Implement an autonomous loop (Plan -> Act -> Observe) using `smolagents` or `mux` logic.
    *   [x] **UI Integration:** Embed the Agent control interface into the `packages/ui` dashboard.
    *   [x] **Subagent Delegation:** Allow the main agent to spin up sub-agents for specific tasks.

## 6. Browser Connectivity (Immediate Priority)
**Status:** ✅ Implemented (v0.0.9)
**Reference:** `docs/RESEARCH_BROWSER_CONNECTIVITY.md`

*   **Objective:** Connect the Hub to the Web Browser (Chrome/Firefox) to allow agents to see and interact with the web.
*   **Planned Features:**
    *   [x] **Extension Bridge:** WebSocket server to connect with `MCP-SuperAssistant` extension.
    *   [x] **Browser Tools:** `browser_get_content`, `browser_click`, `browser_navigate`.
    *   [ ] **Context Injection:** Two-way sync between Browser and Hub.

## 7. Multi-CLI Orchestration
**Status:** Research Needed
**Reference:** `references/emdash`, `references/claude-squad`

*   **Objective:** Coordinate multiple CLI tools.
*   **Planned Features:**
    *   [ ] **CLI Wrappers:** Create adapters to drive Claude Code, Gemini CLI, etc.
    *   [ ] **Orchestrator:** Manage sessions across multiple CLIs simultaneously.

## 8. Ecosystem Extensions
**Status:** Planned
*   **Voice Coding:** Integrate `voicemode`.
*   **Data Sources:** Integrate `notebooklm-mcp`.
*   **Registry:** Integrate `mcpm.sh` for dynamic tool installation.
*   **Skills:** Convert `superpowers` repository into platform-agnostic skills.

## 9. Prompt Engineering Suite
**Status:** Planned
**Reference:** `references/prompt-eng-tutorial`
*   **Objective:** Integrate Anthropic's official tools for crafting and evaluating prompts.
*   **Planned Features:**
    *   [ ] **Prompt Improver:** "Magic Wand" to rewrite prompts using XML tags and best practices.
    *   [ ] **Eval Tool:** UI to run test cases against prompt templates.
    *   [ ] **Tutorial Mode:** Interactive guide ported from the official repo.

## 10. Gemini Ecosystem & ADK
**Status:** Planned
**Reference:** `docs/GEMINI_INTEGRATION_STRATEGY.md`
*   **Objective:** Deep integration with Google's Gemini CLI and Agent Development Kit.
*   **Planned Features:**
    *   [ ] **Gemini Extension:** Build the Hub as a first-class Gemini CLI extension.
    *   [ ] **Skill Porter:** Auto-convert skills between Claude and Gemini formats.
    *   [ ] **Computer Use:** Integrate Gemini-specific computer use extensions.
    *   [ ] **ADK Support:** Implement Google's Agent Development Kit interfaces.
    *   [x] **A2A Protocol:** Support Agent-to-Agent communication standards.

## 11. Universal Skill Marketplace
**Status:** Planned
**Reference:** `docs/SKILL_INTEGRATION_STRATEGY.md`
*   **Objective:** Aggregate and standardize skills from the entire ecosystem.
*   **Planned Features:**
    *   [ ] **Import Pipeline:** `scripts/import_skills.sh` to ingest from Git repos.
    *   [ ] **Marketplace Integration:** Connect to `skillsmp.com` and `prpm.dev`.
    *   [ ] **Standardization:** Convert all imported skills to OpenSkill/TOON format.

## 12. Specification & Architecture
**Status:** Planned
**Reference:** `docs/SPEC_AND_ARCH_STRATEGY.md`
*   **Objective:** Integrate specification management and architectural best practices.
*   **Planned Features:**
    *   [ ] **Spec Editor:** UI to define/validate specs using `spec-kit`.
    *   [ ] **Multi-Model Routing:** Intelligent routing logic adapted from `claude-code-router`.
    *   [ ] **Agent Methodology:** Adopt `BMAD-METHOD` patterns for agent structure.

## 13. Advanced Orchestration
**Status:** In Progress
**Reference:** `docs/ECOSYSTEM_INTEGRATION.md`
*   **Objective:** Coordinate complex multi-agent and multi-model workflows.
*   **Planned Features:**
    *   [x] **Agent Registry:** Centralized discovery for agents and capabilities.
    *   [x] **Message Broker:** A2A communication bus with mailbox support.
    *   [ ] **Debate & Consensus:** Implement multi-model critique loops (Reference: `ultra-mcp`).
    *   [ ] **Project Management:** Track long-running tasks and milestones (Reference: `agentic-project-management`).
    *   [ ] **Mobile Orchestration:** Support remote management (Reference: `systemprompt-code-orchestrator`).

## 14. Agent Standards & Context Management
**Status:** Planned
**Reference:** `docs/AGENT_STANDARDS_STRATEGY.md`
*   **Objective:** Standardize agent behavior and context files across platforms.
*   **Planned Features:**
    *   [ ] **AGENTS.md Manager:** Universal source of truth for agent instructions.
    *   [ ] **Context Sync:** Auto-generate `CLAUDE.md`, `.cursorrules`, `GEMINI.md` from the master spec.
    *   [ ] **Multi-Platform SDK:** Port Claude's Agent SDK concepts (Plugins, Subagents, Skills) to a platform-agnostic layer.

---

## Version History
- **v0.0.1:** Initial Skeleton.
- **v0.0.5:** UI Dashboard & Basic Managers.
- **v0.0.8:** Advanced Orchestration (Registry, Broker, Delegation).
- **v0.0.9:** Browser Connectivity & Client Integration.
- **v0.2.2:** Comprehensive Submodule Update & Dashboard.
- **v0.4.1:** Universal Submodule Sync & Ecosystem Dashboard Refresh.
- **v0.4.2:** Stability Fixes & Comprehensive 400+ Submodule Update.
