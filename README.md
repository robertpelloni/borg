# Super AI Plugin

The Ultimate "Meta-Orchestrator" for the Model Context Protocol (MCP). It acts as a universal hub, proxy, and agentic runtime for your AI tools.

## 🌟 Features

*   **Universal Hub:** Aggregates tools from local MCP servers, remote MetaMCP instances, and internal capabilities.
*   **Progressive Disclosure:** Solves context window limits by hiding tools until they are searched for and loaded.
*   **Web Dashboard:** Manage everything via a unified web interface (`http://localhost:3000`).
*   **Active Intelligence:**
    *   **Agent Executor:** Run autonomous ReAct agents defined in `agents/`.
    *   **Code Mode:** Secure sandboxed execution (TS/Python) for complex workflows.
    *   **Scheduler:** Run tools and agents on a Cron schedule.
    *   **Prompt Improver:** Optimize prompts using the configured LLM.
*   **Ecosystem Integration:**
    *   **MetaMCP:** Connects to the powerful Docker-based MetaMCP backend.
    *   **Mcpenetes:** Auto-installs configuration to Claude Desktop and VSCode.
*   **Memory & Context:**
    *   **Native Memory:** `remember` and `recall` tools backed by local persistence.
    *   **Document Ingestion:** Auto-ingest PDFs and text from `documents/` into memory.
    *   **Context Injection:** Automatically exposes `skills/` and `prompts/` to the LLM.
*   **Profiles:** Switch between different server configurations (e.g., "Coding", "Writing").
*   **Observability:**
    *   **Mcpshark:** Live traffic inspection with Replay capability.
    *   **Dashboard:** Real-time UI for managing the entire stack.

## 🚀 Getting Started

### Prerequisites
*   Node.js v18+
*   pnpm
*   (Optional) Docker for MetaMCP backend
*   (Optional) Go for building mcpenetes

### Installation

1.  **Clone & Install**
    ```bash
    git clone https://github.com/your-repo/super-ai-plugin.git
    cd super-ai-plugin
    pnpm install
    ```

2.  **Start Everything**
    ```bash
    pnpm run start:all
    ```
    *   **Access Dashboard:** `http://localhost:3000`
    *   **MCP Endpoint:** `http://localhost:3000/api/hub/sse`

### Client Configuration

To automatically configure Claude Desktop to use this Hub:

1.  Go to the Dashboard (`http://localhost:3000`).
2.  Click **"Install to Clients"**.
3.  Restart Claude Desktop.

## 📂 Project Directory Structure

The project is organized as a monorepo using `pnpm workspaces`.

*   **`packages/core`**: The "Brain" of the operation. Contains the Node.js Fastify server, Hub logic, Managers (Agents, Memory, Context), and MCP connection handling.
*   **`packages/ui`**: The "Control Center". A React + Vite SPA that provides the Dashboard, Settings, and Inspector interfaces.
*   **`packages/cli`**: A command-line interface (`super-ai`) for controlling the Hub from a terminal.
*   **`packages/vscode`**: Skeleton code for the VSCode Extension client.
*   **`packages/browser`**: Skeleton code for the Chrome Extension client.
*   **`packages/adapters`**: Wrappers for external CLIs like Gemini and Claude.
*   **`agents/`**: JSON definitions for autonomous agents.
*   **`skills/`**: Markdown files defining AI skills.
*   **`documents/`**: Drop zone for PDFs and text files for ingestion.
*   **`commands/`**: Slash command definitions.
*   **`mcp-servers/`**: Directory for managed local MCP servers (e.g., `git`, `postgres`).
*   **`submodules/`**: Critical external integrations (`metamcp`, `mcpenetes`).
*   **`references/`**: A library of 50+ ecosystem repositories used for capability expansion.

## 📖 Documentation

*   [Progressive Disclosure Strategy](docs/guides/PROGRESSIVE_DISCLOSURE.md)
*   [Task Scheduling](docs/guides/SCHEDULING.md)
*   [Memory Strategy](docs/MEMORY_STRATEGY.md)
*   [Agent Standards](docs/AGENT_STANDARDS_STRATEGY.md)

## 🤝 Contributing

See `CONTRIBUTING.md` for details.
