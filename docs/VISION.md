# Borg Vision: The Ultimate AI Coding Harness & Dashboard

Borg is a unified operating system for PC-based local AI tools. It aims to be the **definitive AI coding companion**, replacing the need for disparate CLI tools by offering a superset of their features in a cohesive, high-fidelity TUI and WebUI.

## Core Philosophy

**"Don't Wrap—Replace."**
Originally conceived as a plugin to orchestrate other tools, Borg has evolved. We no longer just wrap tools like OpenCode or Aider; we aim to **be** the best-in-class CLI/TUI/WebUI harness that controls itself, offering feature parity with the entire ecosystem while providing superior orchestration and observability.

## Strategic Pillars

### 1. The SuperAI Coding Harness (CLI/TUI/WebUI)
We aim for complete feature parity with leading AI coding tools, including:
*   **Commercial:** Claude Code, Cursor, Copilot CLI, Gemini CLI, Grok Build, Trae CLI, Warp CLI.
*   **Open Source:** Amp, Auggie, Codebuff, Codemachine, Codex, Crush, Factory Droid, Kilo Code, Kimi CLI, Mistral Vibe, OpenCode, Qwen Code.

**Key Capabilities:**
*   **Unified Interface:** A feature-complete WebUI that mirrors the TUI/CLI capabilities 1:1.
*   **Remote Control:** Full access and control via mobile devices.
*   **Architect Mode:** Advanced reasoning/editing loops (The "SuperAI Engine").
*   **Self-Correction:** Autonomous linting, testing, and error fixing.

### 2. Deep Code Intelligence
The foundation for robust autonomy. We don't just "read" files; we understand the codebase structure deeply.
*   **Robust Indexing:** Multi-strategy code parsing using ASTs (Tree-sitter), Vector Embeddings (RAG), and Symbol Graphs (SCIP/LSIF).
*   **Repo Graph:** A live, interactive dependency graph visualizing how changes propagate.
*   **Context Pinning:** Manual and automatic context curation to keep the agent focused.

### 3. The Universal Browser Extension
A powerful bridge between your local Borg context and web-based AI models.
*   **MCP Provider:** Inject local MCP server functionality directly into web interfaces like ChatGPT, Claude.ai, Gemini, Grok, and DeepSeek.
*   **Memory Bridge:** Record web browsing context, chat histories, and research directly into Borg memory.
*   **Browser Control:** Scrape pages, read debug consoles, access history, and manage email via MCP.
*   **Dashboard Link:** Instant access to your local Borg dashboard and billing stats from the browser toolbar.

### 4. Universal MCP Control Plane
*   **Hub & Proxy:** Serve local tools to remote clients and vice versa.
*   **Traffic Inspection:** Deep observability into every tool call.
*   **Dynamic Orchestration:** Smart routing and progressive disclosure of tools.

### 5. Secure Execution & Verification
*   **Code Sandboxing:** Run untrusted code in ephemeral Docker containers or WASM isolates.
*   **Auto-Verification:** Every AI edit is checked against LSP diagnostics and local tests before being committed.
*   **Consensus Protocol:** Multi-model debate loops for verifying high-stakes architectural decisions.

### 6. Local Resource Governance
*   **Process Guardian:** Long-running service to manage tool lifecycles and restart crashed processes.
*   **Hardware Monitor:** Real-time tracking of CPU, GPU, and network usage.
*   **Inventory:** One-click installation and management of the entire AI toolchain.
