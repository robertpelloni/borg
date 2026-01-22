# Submodule & Reference Mapping

This document maps all submodules and references to the **Universal Plugin Architecture**.
The goal is to identify redundant functionality and assign each component a specific role in the "Motherboard & OS" vision.

## 1. Core Infrastructure (The Motherboard)
*Components that provide the central Hub, Proxy, Router, or State Management logic.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `metamcp` | Submodule | **Core Reference.** The primary inspiration for the Hub architecture. Provides the Docker-based backend and proxy logic. |
| `CLIProxyAPI` | Submodule | **Proxy Server.** A local proxy server that powers AI coding agents (used by Quotio). |
| `mcpproxy` | Reference | **Proxy Logic.** Reference for bridging MCP clients and servers. |
| `mcpproxy-go` | Reference | **Performance.** Go-based implementation of the proxy, useful for high-performance parts of the Core. |
| `Switchboard` | Reference | **Routing.** Advanced routing logic for MCP tools. |
| `mcp-funnel` | Reference | **Aggregation.** Logic for combining multiple MCP servers into one. |
| `mux` | Reference | **Multiplexing.** Handling multiple connections. |
| `MCP-Zero` | Reference | **Base Layer.** Minimalist MCP server implementation. |
| `utcp-mcp` | Reference | **Transport.** Universal Transport Control Protocol for MCP. |

## 2. Interfaces (The Face)
*Plugins that allow users to interact with the Core (Web, CLI, IDE).*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `jules-app` | Submodule | **Web UI.** A comprehensive React/Next.js dashboard. Likely the base for our **Web Interface Plugin**. |
| `quotio` | Submodule | **Native UI.** macOS Command Center for managing the proxy, quotas, and agents. |
| `emdash` | Reference | **TUI.** Terminal User Interface components. |
| `mcpenetes` | Submodule | **Client Config.** Automates the installation of the Core into VSCode/Claude Desktop (The "Installer"). |

## 3. LLM & Cloud Connectors (The Brain & Environment)
*Plugins that connect to LLMs or external environments.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `opencode` | Reference | **Host Environment.** Reference for acting as a plugin *within* OpenCode. |
| `gemini-cli` | (Implied) | **Host Environment.** We can use its hooks. |
| `pluggedin-app` | Reference | **Browser.** Browser automation or connectivity. |
| `pluggedin-mcp` | Reference | **Browser.** MCP server for browser control. |
| `notebooklm-mcp` | Reference | **Knowledge.** Connector to Google's NotebookLM. |

## 4. Agent Runtimes & SDKs (The Workers)
*Frameworks and adapters for spawning sub-agents.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `Polymcp` | Reference | **Agent Framework.** Python library for building MCP agents (Code Mode, Unified Agent). |
| `superpowers` | Reference | **Methodology.** A workflow system (TDD, Planning) for coding agents. |
| `smolagents` | Reference | **Agent SDK.** Lightweight agent framework. We can write an adapter to run `smolagents` within borg. |
| `claude-squad` | Reference | **Multi-Agent.** Patterns for managing squads of Claude agents. |
| `magg` | Reference | **Agent Graph.** Multi-Agent Graph generation. |
| `orchestration` | Reference | **Coordination.** General orchestration patterns. |
| `Super-MCP` | Reference | **Super Agent.** Advanced agent capabilities. |
| `MCP-SuperAssistant`| Reference | **Assistant.** Another super-agent reference. |
| `agent-mcp-gateway` | Reference | **Gateway.** Exposing agents as MCP servers. |

## 5. Capabilities & Tools (The Peripherals)
*Specific functionalities plugged into the Core.*

### A. Code Execution (Code Mode)
| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `code-executor-MCP` | Reference | **Sandbox.** Basic code execution. |
| `lootbox` | Reference | **Sandbox.** Secure, isolated execution environment. |
| `pctx` | Reference | **Context.** Programmatic Context management. |
| `code-mode` | Reference | **Feature.** The full "Code Mode" experience. |
| `code-mode-toon` | Reference | **Optimization.** TOON format for efficient output. |
| `codemode-unified` | Reference | **Unified.** Combined code mode logic. |
| `mcp-server-code-execution-mode` | Reference | **Server.** Dedicated server for code execution. |

### B. Memory & Context
| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `claude-mem` | Submodule | **Core Memory.** The primary memory engine (Graph/Vector). |
| `memory` | Reference | **Storage.** General memory patterns. |
| `claude-lazy-loading`| Reference | **Optimization.** Progressive disclosure logic. |
| `lazy-mcp` | Reference | **Optimization.** Lazy loading for MCP tools. |
| `ToolRAG` | Reference | **Search.** RAG for tools (Semantic Search). |

### C. Observability & Debugging
| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `mcp-shark` | Submodule | **Inspector.** Wireshark for MCP. Traffic analysis. |

### D. Other Skills
| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `mcp-tool-chainer` | Reference | **Orchestration.** Chains multiple tool calls into one. |
| `math-whiz` | Agent | **Math.** Example skill/agent. |
| `researcher` | Agent | **Research.** Example skill/agent. |
| `voicemode` | Reference | **Voice.** Voice control integration. |
| `pal-mcp-server` | Reference | **Partner.** "Pal" functionality. |
| `ncp` | Reference | **Network.** Network Control Protocol. |

## 6. CLIs (The Swiss Army Knife)
*Standalone tools that we wrap, emulate, or use as drivers.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `codebuff` | Reference | **CLI.** AI coding assistant. |
| `CodeMachine-CLI` | Reference | **CLI.** State-managed coding CLI. |
| `factory` | Reference | **Platform.** Droid factory for building coding agents. |
| `droid-action` | Reference | **Action.** Droid action runner. |
| `droid-code-review` | Reference | **Review.** Automated code review droid. |
| `gemini-cli` | Reference | **CLI.** Google's official Gemini CLI. |
| `opencode` | Reference | **CLI.** OpenAI Codex / OpenCode CLI. |
| `qwen-code` | Reference | **CLI.** Qwen (Alibaba) coding CLI. |
| `kimi-cli` | Reference | **CLI.** Moonshot AI's Kimi CLI. |
| `mistral-vibe` | Reference | **CLI.** Mistral AI coding tool. |
| `goose` | Reference | **CLI.** Block's AI coding agent. |
| `aider` | Reference | **CLI.** The gold standard for git-aware coding. |
| `auggie` | Reference | **CLI.** Augment Code's CLI. |
| `grok-cli` | Reference | **CLI.** xAI's Grok CLI. |
| `kilocode` | Reference | **CLI.** Kilo Org's coding tool with "Memory Bank". |
| `amp` | Reference | **CLI.** AmpCode (Sourcegraph). Advanced agent with "Oracle" and "Librarian". |

## 7. Memory & Context (Expanded)
*Advanced memory systems.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `cipher` | Reference | **Memory Hub.** Advanced memory layer with examples for "Strict Memory", "MCP Aggregator", and "Team Progress". |
| `claude-mem` | Submodule | **Core Memory.** The primary memory engine (Graph/Vector). |
| `memory` | Reference | **Storage.** General memory patterns. |

## 8. Extensions & Integrations
*Browser and IDE extensions.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `byterover-zed-extension` | Reference | **Editor Ext.** Zed editor extension for borg/Byterover. |
| `pluggedin-app` | Reference | **Browser.** Browser automation. |

## 9. Skills & Collaboration
*Specific agent capabilities.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `byterover-skills` | Reference | **Skillset.** Collection of coding skills. |
| `byterover-claude-codex` | Reference | **Collab.** Collaboration patterns between Claude and Codex. |

## 10. SDKs & Frameworks
*Building blocks for agents.*

| Component | Type | Utility / Role |
| :--- | :--- | :--- |
| `superagent` | Reference | **Framework.** Full agent framework. |
| `vibekit` | Reference | **SDK.** Vibe coding kit. |
| `ai-sdk` | Reference | **SDK.** Superagent's AI SDK. |

## 11. Unsorted / To Be Analyzed
*Components that need further investigation to categorize.*

*   `mcp-json-yaml-toml` (Likely a utility tool)
*   `awesome-llm-apps` (List)
*   `prompt-eng-tutorial` (Docs)
*   `prompts` (Assets)
*   `skills` (Assets)
*   `testing` (Infrastructure)
