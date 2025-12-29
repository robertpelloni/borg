# Project Structure

This project is a TypeScript monorepo managed by `pnpm`.

## Root Directories

-   `packages/`: Contains the source code for the application components.
-   `agents/`: JSON definitions for AI agents.
-   `skills/`: Markdown files defining skills/tools.
-   `hooks/`: Configuration for event hooks (`hooks.json`).
-   `mcp-servers/`: Directory for local MCP servers.
-   `prompts/`: Library of prompt templates.
-   `context/`: Context files/data.
-   `submodules/`: External dependencies (e.g., `metamcp`).
-   `docs/`: Project documentation.

## Packages

### `packages/core`
The central nervous system of the Super AI Plugin.
-   **Runtime:** Node.js
-   **Framework:** Fastify
-   **Communication:** Socket.io
-   **Role:** Manages state, handles MCP connections, executes hooks, and serves the API.
-   **Key Components:**
    -   `managers/`: Watchers for files (`AgentManager`, `DocumentManager`) and clients (`BrowserManager`, `VSCodeManager`, `SchedulerManager`, `MemoryManager`, `HandoffManager`).
    -   `services/`: `VectorStore`, `TrafficObserver`, `HealthService`, `SystemDoctor`.
    -   `gateway/`: `ModelGateway` (LLM abstraction).
    -   `agents/`: `AgentExecutor` (ReAct loop), `LoopManager` (Autonomous Loops).
    -   `managers/`: ... `EconomyManager` (Bobcoin), `NodeManager` (Infrastructure).
    -   `tools/`: `PipelineTool`, `PromptImprover`.

### `packages/ui`
The dashboard interface.
-   **Runtime:** Browser
-   **Framework:** React + Vite
-   **Role:** Visualizes state, allows control of MCP servers, displays logs.

### `packages/cli`
The `super-ai` command-line interface. Wraps `start`, `status`, and `run` commands.

### `packages/adapters`
Contains CLI wrappers for external tools:
-   `@super-ai/claude-adapter`: Wraps `claude` binary.
-   `@super-ai/gemini-adapter`: Wraps `gemini` binary.

### `packages/vscode`
The VSCode Extension source.

### `packages/browser`
The Chrome Extension source (Manifest V3).

### `packages/types`
Shared TypeScript type definitions used across packages to ensure type safety.

### `packages/cli`
The `super-ai` command-line interface. Wraps `start`, `status`, and `run` commands.

### `packages/adapters`
Contains CLI wrappers for external tools:
-   `@super-ai/claude-adapter`: Wraps `claude` binary.
-   `@super-ai/gemini-adapter`: Wraps `gemini` binary.

### `packages/vscode`
The VSCode Extension source.

### `packages/browser`
The Chrome Extension source (Manifest V3).

## Configuration

-   `pnpm-workspace.yaml`: Defines the workspace structure.
-   `package.json`: Root dependencies and scripts.
-   `.gitignore`: Global git ignore rules.
