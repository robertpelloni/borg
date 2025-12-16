# Super AI Plugin Roadmap & Implementation Plan

This document compiles the design decisions, planned features, and submodule integration strategies discussed throughout the project's inception. It serves as the master plan for developing the "Super AI Plugin".

## 1. Core Infrastructure (The "Hub")
**Status:** In Progress (Skeleton Built)
**Reference:** `submodules/metamcp`

*   **Objective:** Build a robust Node.js/TypeScript service (`packages/core`) that acts as the central nervous system.
*   **Planned Features:**
    *   [x] **Server Skeleton:** Fastify + Socket.io (Done).
    *   [x] **Manager Pattern:** `HookManager`, `AgentManager`, `McpManager`, `HookExecutor` (Done).
    *   [ ] **Router/Aggregator Logic:**
        *   Implement intelligent routing of tool calls to downstream MCP servers (Reference: `metamcp`, `magg`).
        *   Implement "Progressive Disclosure" (Lazy Loading) to keep context light (Reference: `lazy-mcp`, `Switchboard`).
    *   [ ] **Traffic Inspection ("Mcpshark"):**
        *   Build a UI to inspect MCP traffic in real-time (Reference: `mcpshark`, `metamcp` inspector).
        *   Implement persistent logging to `pgvector` database.
        *   **Cost & Usage Tracking:** Calculate and display token usage and estimated cost per session/agent.
    *   [ ] **Context Visualization:**
        *   **Attribution:** Track "what came from where" (source file, tool output, user input).
        *   **Breakdown:** Visualize context composition (e.g., "30% Code, 20% Memory, 50% Conversation").
        *   **Inspector:** Allow users to view the exact context window being sent to the model.
    *   [ ] **Context Mining:**
        *   **Auto-Audit:** Trigger an "Analyst Mode" at session end to find abandoned threads and connections.
        *   **Layering:** Inject metadata (System, Dev, User, Session) in strict order.

## 2. Universal Client Integration
**Status:** Planned
**Reference:** `submodules/mcpenetes`

*   **Objective:** Automatically configure the user's environment to use the Hub.
*   **Planned Features:**
    *   [ ] **Client Detection:** Port logic from `mcpenetes` to auto-detect installed tools (VSCode, Cursor, Claude Desktop, etc.).
    *   [ ] **Config Injection:** Automatically edit `mcp-servers.json` files to insert the Super AI Plugin as the upstream server.
    *   [ ] **Conflict Resolution:** Handle existing configurations gracefully.

## 3. Integrated Memory System
**Status:** Planned
**Reference:** `docs/MEMORY_STRATEGY.md`

*   **Objective:** Provide a shared, persistent memory across all clients with seamless handoff.
*   **Planned Features:**
    *   [ ] **Library Integration:** Adapt `claude-mem` core logic into `packages/core/src/lib/memory`.
    *   [ ] **Session Handoff:** Implement "Save/Resume" logic (file-based snapshots) inspired by `vibeship-mind`.
    *   [ ] **Semantic Search:** Integrate `txtai` concepts for knowledge retrieval.
    *   [ ] **Hook Bridging:**
        *   `SessionStart`: Inject "Memory Index" and "Last Snapshot".
        *   `PostToolUse`: Capture observations to vector DB.
        *   `SessionEnd`: Generate summaries and save session snapshot.
    *   [ ] **Tool Exposure:** Expose `mem-search` as a standard MCP tool via the Hub.

## 4. Code Mode & Sandboxing
**Status:** Planned
**Reference:** `references/pctx`, `references/mcp-server-code-execution-mode`

*   **Objective:** Allow the LLM to execute scripts to chain tools efficiently (98% token reduction).
*   **Planned Features:**
    *   [ ] **`run_code` Tool:** Implement a tool that accepts TS/Python code.
    *   [ ] **Sandbox Engine:** Integrate `isolated-vm` (Node.js) or Docker (Python) to run the code safely.
    *   [ ] **Tool Bridge:** Inject a client into the sandbox so the script can call other MCP tools.
    *   [ ] **TOON Support:** Implement Token-Oriented Object Notation for compressed outputs.

## 5. Autonomous Agents & UI
**Status:** Research Needed
**Reference:** `references/mux`, `references/smolagents`

*   **Objective:** Provide an interface for long-running, autonomous tasks.
*   **Planned Features:**
    *   [ ] **Agent Loop:** Implement an autonomous loop (Plan -> Act -> Observe) using `smolagents` or `mux` logic.
    *   [ ] **UI Integration:** Embed the Agent control interface into the `packages/ui` dashboard.
    *   [ ] **Subagent Delegation:** Allow the main agent to spin up sub-agents for specific tasks.

## 6. Browser Connectivity
**Status:** Research Needed
**Reference:** `references/MCP-SuperAssistant`

*   **Objective:** Connect the Hub to the Web Browser.
*   **Planned Features:**
    *   [ ] **Browser Extension:** Build/Adapt the extension to communicate with the Hub via WebSocket.
    *   [ ] **Context Injection:** Allow the Hub to read/write browser content.

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
    *   [ ] **A2A Protocol:** Support Agent-to-Agent communication standards.

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
**Status:** Planned
**Reference:** `docs/ECOSYSTEM_INTEGRATION.md`
*   **Objective:** Coordinate complex multi-agent and multi-model workflows.
*   **Planned Features:**
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
