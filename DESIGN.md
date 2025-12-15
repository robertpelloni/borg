# Super AI Plugin Design Document

## Vision
The **Super AI Plugin** is not just a standard plugin; it is a **Meta-Orchestrator** and an **Open Source AI OS layer**. It wraps the developer's environment (VSCode, Chrome, CLI) and provides the "glue" that proprietary tools usually keep hidden.

It acts as a central nervous system that orchestrates:
- **Multi-CLI Tools:** Claude Code, Gemini CLI, OpenCode, etc.
- **MCP Servers:** Managing connections, configuration, and traffic.
- **Context:** Saving, handoff, automatic memory, and injection.
- **Agents & Skills:** Defining and routing tasks to sub-agents.

## Architecture

### Tech Stack
- **Monorepo:** Managed via `pnpm workspaces`.
- **Runtime:** Node.js (TypeScript).
- **Core Service:** Fastify (HTTP) + Socket.io (WebSocket).
- **UI:** React + Vite + Tailwind CSS.
- **Communication:** Clients (VSCode ext, Chrome ext, CLI wrappers) talk to the Core Service via WebSocket/HTTP.

### Component Breakdown

#### 1. Core Service (`packages/core`)
The "brain" of the operation. It runs locally (likely as a daemon) and:
- Serves the **MetaMCP UI**.
- Manages state for Agents, Skills, Hooks, Prompts, and Context.
- Exposes WebSocket events for real-time updates.
- Generates dynamic configuration for MCP tools.
- Executes Hooks (commands, validation).

#### 2. UI (`packages/ui`)
A web-based control panel (based on MetaMCP) that allows the user to:
- View and manage connected MCP servers.
- Inspect the Activity Log (Hook events, Tool usage).
- Browse and edit the Prompt Library, Agent definitions, and Skills.
- Manage global Context and Memory.

#### 3. Data Structures & Formats
- **Toon:** A compacted JSON format for tool definitions. It aims for the tightest possible syntax for LLM consumption while maintaining a verbose internal description for semantic discovery.
- **Hooks:** Defined in `hooks/hooks.json`. Events include `PreToolUse`, `PostToolUse`, `SessionStart`, etc.
- **MCP Config:** Dynamically generated (JSON, TOML, XML) from the `mcp-servers/` directory.

### Directory Structure
- **`agents/`**: JSON definitions of sub-agents.
- **`skills/`**: Markdown files (`.skill.md`) defining capabilities.
- **`hooks/`**: Event handlers and configuration.
- **`commands/`**: Markdown/Script files for custom commands.
- **`mcp-servers/`**: Directories containing MCP server implementations or configurations.
- **`prompts/`**: Prompt templates and libraries.
- **`context/`**: Global context files and memory dumps.
- **`marketplaces/`**: Placeholders for dynamic discovery of Agents, Skills, and MCPs.

## Features & Capabilities

### Hook System
The system intercepts events from various integrations:
- **Events:** `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`.
- **Types:**
    - `command`: Execute shell commands.
    - `validation`: Validate file contents or project state.
    - `notification`: Send alerts.

### MCP Management
- **Dynamic Loading:** Scans directories to find available servers.
- **Orchestration:** Starts/Stops servers on demand.
- **Traffic Sniffing:** Logs MCP traffic for debugging (via MetaMCP integration).
- **Multi-Protocol Support:** Generates configs for tools requiring JSON, TOML, or XML setups.

### Context & Memory
- **Autosave:** Context memory is automatically saved.
- **Handoff:** Supports context handoff between sessions or tools.
- **Injection:** Inject context into browser or IDE sessions.

## Future Roadmap
- **Profile/Model Proxy:** Switcher for CLI tool backends.
- **Prompt Improver:** Automated refinement of prompts.
- **Skill Library:** Semantic search for progressive tool revealing.
- **Cross-Platform:** Deep integration into VSCode, Chrome, and Terminal environments.
