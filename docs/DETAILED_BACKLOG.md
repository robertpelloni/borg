# Detailed Backlog & Unimplemented Features

This document compiles a comprehensive list of planned features, design decisions, and submodule integrations derived from the project's conversation history. It serves as a detailed extension of the `ROADMAP.md`.

## 1. Browser & Client Connectivity
*   **Browser Extension Interface:** Integrate `MCP-SuperAssistant` as the foundation for the browser extension interface.
    *   *Goal:* WebSocket/StreamingHTTP server to connect the Hub to Chrome/Firefox.
    *   *Reference:* `references/MCP-SuperAssistant`
*   **Universal Client Integration:**
    *   *Goal:* Auto-configure clients (VSCode, Cursor, etc.) by injecting the Hub as an upstream MCP server.
    *   *Reference:* `submodules/mcpenetes` (Port logic to `packages/core`).

## 2. Multi-CLI Orchestration
*   **Orchestrator:** Implement logic to coordinate multiple CLI tools (Claude Code, Gemini CLI, OpenCode).
    *   *References:* `references/emdash`, `references/claude-squad`, `references/Puzld.ai`.
*   **CLI Wrappers:** Create adapters for:
    *   Gemini CLI (`references/gemini-cli-extensions`)
    *   Claude Code (`references/claude-code-config`)
    *   OpenCode

## 3. Ecosystem Extensions & Skills
*   **Voice Coding:** Integrate `references/voicemode`.
*   **Data Sources:** Integrate `references/notebooklm-mcp` (NotebookLM as data source).
*   **Registry:** Integrate `references/mcpm.sh` (MCP package manager).
*   **Skill Conversion:**
    *   Convert `references/superpowers` to platform-agnostic skills.
    *   Integrate `references/skillkit`, `references/openskills`, `references/opencode-skills` for conversion utilities.
*   **Marketplace Integration:**
    *   Research API access for `skillsmp.com`, `prpm.dev`, `claude-plugins.dev`.
    *   Integrate official Anthropic plugins (`anthropics/claude-code/plugins`) and skills (`anthropics/skills`).
*   **Infrastructure Showcase:** Integrate patterns from `references/claude-code-infrastructure-showcase`, `references/skilled-intelligence-marketplace`, `references/SWORDSwarm`.

## 4. Autonomous Agents
*   **Agent Frameworks:** Integrate concepts from:
    *   `references/smolagents` (HuggingFace)
    *   `OpenHands`, `amplifier`, `autogen`, `magentic` (Research needed).
*   **Consensus & Debate:** Implement multi-model debate loops.
    *   *References:* `references/pal-mcp-server`, `ultra-mcp`.
*   **Code Mode Subagents:** Integrate `references/Polymcp`.

## 5. Advanced MCP Features
*   **Lazy Loading:** Implement progressive disclosure.
    *   *References:* `references/lazy-mcp`, `references/MCP-Zero`.
*   **Tool Chaining:** Implement direct multi-MCP tool chaining.
    *   *Reference:* `references/mcp-tool-chainer`.

## 6. Gemini Ecosystem & ADK
*   **Gemini Extensions:** Implement `references/gemini-cli-extensions` (Jules, Code Review).
*   **Skill Porter:** Implement `references/skill-porter` (Claude -> Gemini).
*   **Computer Use:** Integrate `references/GeminiCLI_ComputerUse_Extension`.
*   **ADK Support:** Implement Google's Agent Development Kit interfaces (`adk-python`, `adk-java`, `agent-starter-pack`).
*   **A2A Protocol:** Implement `a2a-protocol` support.

## 7. Prompt Engineering
*   **Prompt Library:**
    *   Scrape/Import official Anthropic prompts (`references/prompt-eng-interactive-tutorial`).
    *   Import Gemini prompts (`references/gemini-cli-prompt-library`, `references/gemini-cli-tips`).
    *   Import OpenAI prompt packs (`openai/prompt-packs`).
*   **UI Tools:**
    *   Integrate `references/thoughtbox` (Experimental MCP).
    *   Implement "Prompt Improver" and "Eval Tool" in the UI.
*   **Context Rules:** Implement `.claude/rules/` support (Distributed Context) and `references/claude-code-system-prompts`.

## 8. Tracking & Visualization
*   **Cost & Usage:** Track token usage and estimated cost per session.
*   **Context Attribution:** Visualize "what came from where" (percentages of context from code, memory, conversation).
*   **Traffic Inspection:** "Mcpshark" style logging (already partially implemented in `packages/ui`).

## 9. Dify Integration
*   **Platform Support:** Implement support for `references/dify`.
