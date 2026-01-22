# Ecosystem Integration Strategy

This document outlines the strategy for integrating the extensive list of submodules added to the project. These repositories serve as references, foundations, or direct library integrations to power the "borg".

## 1. Browser Extension & Connectivity
**Repo:** `references/MCP-SuperAssistant`
- **Role:** Foundation.
- **Integration:** This codebase will serve as the reference implementation for the project's Browser Extension interface and the WebSocket/StreamingHTTP server.
- **Goal:** Enable the "borg" to interact directly with web pages and browser events.

## 2. Data Sources & Voice
**Repos:** `references/notebooklm-mcp`, `references/voicemode`
- **Role:** Capabilities.
- **Integration:**
    - `notebooklm-mcp`: Integrate as a direct data source tool to tap into NotebookLM's knowledge.
    - `voicemode`: Implement voice coding capabilities, potentially using its patterns or code directly.

## 3. Aggregation & Routing (The "Hub" Core)
**Repos:** `references/pluggedin-mcp`, `references/pluggedin-app`, `references/mcpproxy-go`, `references/Super-MCP`, `references/mcphub`, `references/magg`
- **Role:** Reference & Feature Mining.
- **Integration:** These projects implement various forms of MCP aggregation, routing, and progressive disclosure.
- **Action:** Examine these implementations to identify superior features (e.g., specific routing algorithms, security sandboxing, UI patterns) and integrate them into `metamcp`.

## 4. Code Mode & Execution
**Repos:** `references/pctx`, `references/mcp-server-code-execution-mode`
- **Role:** Core Library / Integration.
- **Integration:** These implement "Code Mode" (sandboxed execution). They will be integrated to power the project's `run_code` tool, enabling the LLM to execute scripts for complex tasks.

## 5. Autonomous Agents & UI
**Repos:** `references/mux`, `references/smolagents`
- **Role:** UI & Logic.
- **Integration:**
    - `mux`: Its "autonomous agentic loop" logic will be integrated into the borg UI, providing a "Jules-like" interface for long-running tasks.
    - `smolagents`: Will be implemented to allow for a powerful autonomous cloud/local agentic development loop, utilizing skills and subagents.

## 6. Multi-CLI Orchestration (The "Swiss Army Knife")
**Repos:** `references/Puzld.ai`, `references/emdash`, `references/claude-squad`
**Target CLIs:** `gemini-cli`, `claude-code`, `opencode`, `aider`, `mentat`, `fabric`, `gh`, `az`, `aws`.
- **Role:** Orchestration & Capability Library.
- **Integration:**
    - **Super-Wrapper:** Wrap these CLIs to provide them with a Web UI and history.
    - **Feature Mining:** Audit these CLIs to ensure borg has feature parity (e.g., `aider`'s git handling, `opencode`'s state management).
    - **Delegation:** Use them as heavy-duty tools for specific tasks (e.g., "Ask `aider` to refactor this file").
    - **Submodule Strategy:** Maintain them as submodules in `references/clis/` to keep the "drivers" available for the OS.

### Feature Parity Goals (from Amp & Aider)
*   **Oracle:** Implement an `oracle` tool (via `metamcp`) that routes complex queries to a reasoning model (o1/r1).
*   **Librarian:** Implement a `librarian` tool that uses `pluggedin-app` or GitHub search to query external repos.
*   **Toolboxes:** Allow users to drop scripts into `.borg/toolbox/` to auto-register them as MCP tools (inspired by Amp).
*   **Repo Map:** Implement AST-based repository mapping (inspired by Aider).

## 7. The "Swiss Army Knife" Strategy (Multi-CLI Orchestration)

To ensure the borg is the "Universal" operating system, we adopt a "Swiss Army Knife" strategy. Instead of competing with individual CLI tools (like Aider, Gemini CLI, or Claude Code), we **aggregate** them. The borg acts as the "Motherboard" that can mount and drive any of these tools as plugins.

### 7.1. Integrated CLI Drivers
We maintain a collection of industry-leading CLIs as submodules in `references/clis/`. The borg Core Server can invoke these CLIs to perform specialized tasks that they excel at.

| CLI Tool | Repository | Primary Strength | Integration Role |
| :--- | :--- | :--- | :--- |
| **Gemini CLI** | `google-gemini/gemini-cli` | Native Google ecosystem integration, multimodal inputs. | **General Purpose.** Default driver for Gemini models. |
| **Aider** | `paul-gauthier/aider` | SOTA code editing, "Repo Map" context awareness. | **Code Editor.** Invoked for complex multi-file refactoring tasks. |
| **Mentat** | `AbanteAI/mentat` | Coordinate-based editing, strong context management. | **Code Editor.** Alternative to Aider for specific workflows. |
| **Fabric** | `danielmiessler/fabric` | "Patterns" (prompts) for life/work, wisdom extraction. | **Wisdom Engine.** Used for summarization, extraction, and analysis tasks. |
| **Goose** | `block/goose` | Developer-centric agent with strong tool use. | **Developer Agent.** Autonomous developer tasks. |
| **KiloCode** | `Kilo-Org/kilocode` | "Memory Bank" architecture, persistent project context. | **Project Manager.** Used for maintaining long-term project state. |
| **Amp** | `sourcegraph/amp` | "Oracle" (reasoning) and "Librarian" (search). | **Researcher.** Used for deep reasoning and cross-repo search. |

### 7.2. Integration Architecture
1.  **Submodule Management:** All CLIs are checked out in `references/clis/` to ensure we have the exact source code and can patch/wrap them if necessary.
2.  **Unified Interface:** The `metamcp` server exposes a unified tool interface (e.g., `run_code_edit`, `ask_oracle`) that routes to the appropriate CLI.
3.  **Context Sharing:** The borg Hub generates a "Universal Context" (e.g., `borg.md` or `context.md`) that these CLIs are instructed to read, ensuring they share the same memory state.

## 8. Registry & Package Management
**Repo:** `references/mcpm.sh`
- **Role:** Infrastructure.
- **Integration:** Implement a dynamic MCP registry/storefront functionality, allowing users to discover and install tools on the fly.

## 8. Skills & Consensus
**Repos:** `references/superpowers`, `references/pal-mcp-server`, `references/Polymcp`
- **Role:** Capabilities.
- **Integration:**
    - `superpowers`: Convert these Claude skills into platform-agnostic tools.
    - `pal-mcp-server`: Implement multi-model consensus/debate patterns.
    - `Polymcp`: Adopt its multi-agent development patterns.

## 9. Advanced Tooling & Lazy Loading
**Repos:** `references/lazy-mcp`, `references/MCP-Zero`, `references/mcp-tool-chainer`
- **Role:** Optimization.
- **Integration:**
    - `lazy-mcp`, `MCP-Zero`: Ensure our "Progressive Disclosure" implementation is robust and feature-complete by comparing with these.
    - `mcp-tool-chainer`: Support direct multi-MCP tool chaining outside of Code Mode.

## 10. Infrastructure Skills
**Repo:** `references/claude-code-infrastructure-showcase`
- **Role:** Reference.
- **Integration:** Use this collection of skills and agents as a gold standard for infrastructure automation tasks (AWS, Docker, K8s) within the Hub.

## 11. Subagent Orchestration & Task Management
This section focuses on managing complex workflows involving multiple agents and models.

### Multi-Model Consensus
**Repo:** `references/orchestration/ultra-mcp`
- **Goal:** Implement "Debate & Consensus" patterns where Claude, Gemini, and GPT critique each other's work before final output.
- **Integration:** Adapt `ultra-mcp` logic into the Hub's `AgentManager`.

### Project Management
**Repos:** `references/orchestration/agentic-project-management`, `references/orchestration/claude-task-master`, `references/orchestration/TaskSync`
- **Goal:** Maintain project continuity across sessions.
- **Integration:**
    - `agentic-project-management`: Adopt its structured workflows for long-running projects.
    - `claude-task-master`: Use as a reference for task tracking MCP servers.

### Remote & Mobile Orchestration
**Repo:** `references/orchestration/systemprompt-code-orchestrator`
- **Goal:** Allow users to manage development from mobile devices.
- **Integration:** Explore its remote management features for the Hub's dashboard.

### Subagent Collections
**Repos:** `references/agents/claude-code-subagents-collection`, `references/agents/codex-subagents-mcp`, `references/agents/Agent-MCP`
- **Role:** Content Library.
- **Action:** Import these subagent definitions into the Hub's `agents/` registry.

## 12. Agent Protocols (A2A & ACP)
**Repos:** `references/protocols/A2A`, `references/protocols/a2a-js`, `references/protocols/a2a-python`
- **Role:** Standard.
- **Integration:** Implement the Agent-to-Agent (A2A) protocol to allow the Hub to communicate with external agents in a standardized way.

## 13. Copilot Frameworks
**Repo:** `references/frameworks/CopilotKit`
- **Role:** Reference/Library.
- **Integration:** Use `CopilotKit` to embed AI "Copilots" into the Hub's dashboard UI.

## 14. Testing & Quality Engineering
**Repo:** `references/testing/agentic-qe`
- **Role:** Capability.
- **Integration:** Integrate "Agentic QE" patterns to allow the Hub to self-test its generated code and agents.
