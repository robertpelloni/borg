# Project Structure

This project is a TypeScript monorepo managed by `pnpm` workspaces. It implements a "Meta-Orchestrator" for the Model Context Protocol (MCP).

## Root Directories

-   **`packages/`**: Source code for the application's core components (monorepo workspaces).
-   **`agents/`**: JSON definitions for autonomous AI agents (ReAct pattern).
-   **`skills/`**: Markdown-based definitions of capabilities/tools available to agents.
-   **`mcp-servers/`**: Managed local MCP servers (e.g., SQLite, Git, Filesystem).
-   **`submodules/`**: Critical external integrations and reference repositories.
    -   `metamcp`: Docker-based backend for MCP.
    -   `mcpenetes`: K8s-style configuration injection for Claude/VSCode.
    -   `references/`: Collection of ~50+ ecosystem repositories for capability expansion.
-   **`docs/`**: Comprehensive project documentation.
-   **`prompts/`**: Library of optimized system prompts and templates.
-   **`documents/`**: Ingestion drop-zone for PDFs/text files (RAG source).
-   **`commands/`**: Slash command definitions for the CLI/Chat interface.
-   **`hooks/`**: Event hook configurations.

## Packages (`packages/`)

### `packages/core` (The Brain)
The backend runtime and orchestration layer.
-   **Tech**: Node.js, Fastify, Socket.io, LangChain.
-   **Responsibilities**:
    -   **Agent Runtime**: Executes autonomous agents defined in `agents/`.
    -   **MCP Hub**: Manages connections to local and remote MCP servers.
    -   **Managers**: Watches files and state (`AgentManager`, `DocumentManager`, `HandoffManager`).
    -   **Gateway**: Abstracted LLM access (`ModelGateway`).
    -   **Services**: `VectorStore` (RAG), `TrafficObserver` (Telemetry).

### `packages/ui` (The Control Center)
The web-based dashboard for management and observability.
-   **Tech**: Next.js (App Router), React, Tailwind CSS, Lucide Icons.
-   **Responsibilities**:
    -   Visualizes system state (agents, connections, memory).
    -   Provides control interfaces for MCP servers.
    -   **Note**: Uses a custom `server.js` for tight integration with Core.

### `packages/cli`
The command-line interface tool (`super-ai`).
-   **Commands**: `start`, `status`, `run`, `install`.
-   **Role**: Entry point for developers and system administration.

### `packages/adapters`
Wrappers for external AI CLI tools.
-   `@super-ai/claude-adapter`: Shim for the `claude` binary.
-   `@super-ai/gemini-adapter`: Shim for the `gemini` binary.

### `packages/vscode`
Source code for the VSCode Extension client.
-   Allows VSCode to connect to the Super AI Hub as an MCP client.

### `packages/types`
Shared TypeScript definitions.
-   Ensures type safety across the monorepo boundary.

## Configuration Files

-   **`pnpm-workspace.yaml`**: Defines the workspace topology.
-   **`package.json`**: Root dependencies, build scripts (`start:all`), and metadata.
-   **`tsconfig.json`**: Base TypeScript configuration.
-   **`turbo.json`**: (Optional) Turborepo build pipeline configuration.
