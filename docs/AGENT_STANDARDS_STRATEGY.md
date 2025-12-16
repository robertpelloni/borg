# Agent Standards & Context Strategy

This document outlines the strategy for standardizing agent behavior, context management, and plugin architecture across multiple platforms, leveraging best-in-class references.

## 1. Context File Standardization (`AGENTS.md`)
**Reference:** [`agents.md`](https://github.com/agentsmd/agents.md)

### Goal
Implement a robust "Context Manager" that understands and generates platform-specific instruction files, using `AGENTS.md` as the universal source of truth.

### Implementation:
*   **Universal Schema:** Adopt the `AGENTS.md` spec to define agent behaviors, tools, and constraints.
*   **Generator:** Build a module in `packages/core` that reads `AGENTS.md` and generates:
    *   `CLAUDE.md` (for Claude Code/Desktop)
    *   `.cursorrules` (for Cursor)
    *   `copilot-instructions.md` (for GitHub Copilot)
    *   `GEMINI.md` (for Gemini CLI)
*   **Sync:** Ensure changes in the universal schema propagate to all platform-specific files.
*   **Distributed Context Rules:**
    *   Support the `.claude/rules/` pattern (nested subdirectories, recursion).
    *   **Strategy:** Maintain a `.context/rules/` directory in the Hub that compiles into the platform-specific formats.
    *   Reference: [`claude-code-config`](https://github.com/drewipson/claude-code-config) for config management patterns.

## 2. Multi-Platform Agent SDK
**Reference:** [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/plugins)

### Goal
Replicate the powerful concepts from Anthropic's Agent SDK (Plugins, Subagents, Skills, Slash Commands) and make them work across *all* supported CLIs and IDEs.

### Core Concepts to Port:
*   **Plugins:** Standardized interfaces for tools. We will use MCP as the underlying transport but wrap them to look like native plugins for each platform.
*   **Subagents:**
    *   *Concept:* Delegating specific tasks to specialized agents (e.g., "Research Agent", "Coding Agent").
    *   *Implementation:* The Hub's `AgentManager` will handle the routing and context handoff between subagents, regardless of whether the user is in VSCode or Gemini CLI.
*   **Skills:**
    *   *Concept:* Reusable bundles of prompts and tools.
    *   *Implementation:* Store skills in a universal format (Markdown/JSON) and dynamically load them into the active agent's context.
*   **Slash Commands:**
    *   *Concept:* User-invoked shortcuts (e.g., `/fix`, `/test`).
    *   *Implementation:* Map these commands to specific workflows in the Hub. For platforms that support slash commands (Gemini, some IDEs), register them natively. For others, intercept text input.

## 3. Application Patterns
**Reference:** [`awesome-llm-apps`](https://github.com/Shubhamsaboo/awesome-llm-apps)

### Goal
Use this repository as a library of reference architectures for building complex agentic applications.

### Action:
*   Analyze the patterns for RAG, Multi-Agent collaboration, and Tool Use.
*   Implement "Starter Templates" in the Hub based on these proven patterns.
