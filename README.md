# Super AI Plugin

The Ultimate "Meta-Orchestrator" for the Model Context Protocol (MCP). It acts as a universal hub, proxy, and agentic runtime for your AI tools.

## 🌟 Features

*   **Universal Hub:** Aggregates tools from local MCP servers, remote MetaMCP instances, and internal capabilities.
*   **Progressive Disclosure:** Solves context window limits by hiding tools until they are searched for and loaded.
*   **Active Intelligence:**
    *   **Agent Executor:** Run autonomous ReAct agents defined in `agents/`.
    *   **Code Mode:** Secure sandboxed execution (TS/Python) for complex workflows.
    *   **Scheduler:** Run tools and agents on a Cron schedule.
*   **Ecosystem Integration:**
    *   **MetaMCP:** Connects to the powerful Docker-based MetaMCP backend.
    *   **Mcpenetes:** Auto-installs configuration to Claude Desktop and VSCode.
*   **Memory & Context:**
    *   **Native Memory:** `remember` and `recall` tools backed by local persistence.
    *   **Context Injection:** Automatically exposes `skills/` and `prompts/` to the LLM.
*   **Observability:**
    *   **Mcpshark:** Live traffic inspection of all JSON-RPC messages.
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

2.  **Build**
    ```bash
    pnpm run build
    ```

3.  **Run the Hub**
    ```bash
    pnpm start
    ```
    *   Dashboard: `http://localhost:5173` (or port 3000 for API)
    *   MCP Endpoint: `http://localhost:3000/api/hub/sse`

### Client Configuration

To automatically configure Claude Desktop to use this Hub:

1.  Go to the Dashboard.
2.  Click **"Install to Clients"**.
3.  Restart Claude Desktop.

## 📂 Project Structure

*   `packages/core`: The main Node.js Hub service.
*   `packages/ui`: Next.js Dashboard (easily deployable to Vercel).
*   `packages/mcpenetes`: Go-based configuration injector.
*   `agents/`: JSON definitions for autonomous agents.
*   `skills/`: Markdown files defining AI skills.
*   `commands/`: Slash command definitions.
*   `mcp-servers/`: Directory for managed local MCP servers.

## 📖 Documentation

*   [Progressive Disclosure Strategy](docs/guides/PROGRESSIVE_DISCLOSURE.md)
*   [Task Scheduling](docs/guides/SCHEDULING.md)
*   [Memory Strategy](docs/MEMORY_STRATEGY.md)
*   [Agent Standards](docs/AGENT_STANDARDS_STRATEGY.md)

## 🤝 Contributing

See `CONTRIBUTING.md` for details.
