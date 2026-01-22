# BORG (previously AIOS): The Universal AI Operating System

A unified operating system for PC-based local AI tools. Manage everything from tool installation to autonomous multi-agent orchestration in a single, high-fidelity dashboard.

![AIOS Dashboard](https://via.placeholder.com/1200x600?text=AIOS+Dashboard+Preview)

## 🚀 Key Features

### 🛠️ Ultimate Tool Dashboard
- **Inventory Management:** Track installation status of local AI tools (Aider, Docker, Redis, Bun).
- **One-Click Setup:** Automatically detect missing tools and generate install commands.
- **Process Guardian:** Long-running service that monitors and restarts crashed background processes.
- **Hardware Stats:** Real-time CPU, VRAM, RAM, and Disk usage monitoring.

### 🧠 The "SuperAI" Coding Harness
- **Architect Mode:** Two-model orchestration (Reasoning vs. Editing) for complex refactors.
- **Visual Repo Map:** Interactive graph of your codebase's dependencies and symbols.
- **Auto-Verification:** Zero-trust loop where every AI edit is verified by LSP diagnostics and tests.
- **Diff Streaming:** Real-time visualization of code modifications.

### 🔌 Universal MCP Control Plane
- **Traffic Inspector:** Real-time monitoring of all Model Context Protocol (MCP) traffic.
- **Universal Directory:** Discover and auto-install servers from the global ecosystem.
- **Dynamic Routing:** Smart routing of prompts to the right tool based on semantic relevance.
- **Proxy System:** Bridge remote MCP servers to local clients seamlessly.

### 🤖 Multi-Agent Orchestration
- **Agent Squads:** specialized subagents for file picking, code review, and security auditing.
- **Consensus Protocol:** Multi-model debate engine for verifying high-stakes decisions.
- **Local-Remote Bridge:** Sync projects between local PCs and remote cloud environments.

### 💾 Memory & Context Ecosystem
- **Unified Memory:** `memory/` subdirectory containing integrations for Zep, Mem0, Letta, and local vector stores.
- **Storage Backends:** Interchangeable support for Chroma, Qdrant, SQLite, and Filesystem.
- **Knowledge Graph:** Auto-building knowledge graph of your development sessions.

### 🖥️ CLI & TUI Power Tools
- **SuperAI CLI:** `superai-cli/` consolidated directory for all external CLI tools.
- **TUI Dashboard:** Interactive terminal UI (`borg tui`) for headless management.
- **Submodule Management:** Automated tracking of 80+ AI tools and libraries.

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/OhMyOpenCode/borg.git
cd borg

# Initialize Submodules (Important!)
git submodule update --init --recursive

# Install dependencies (pnpm is required)
pnpm install

# Start the full stack (Core Service + UI Dashboard)
pnpm run start:all
```

## 🏗️ Project Structure

AIOS is a monorepo organized into functional zones:

- **`packages/core`**: The Node.js/Hono backend service (The Brain).
- **`packages/ui`**: The Next.js web dashboard (The Control Center).
- **`packages/cli`**: The command-line interface & TUI.
- **`superai-cli/`**: Collection of external CLI tools and wrappers.
- **`memory/`**: Memory systems, MCP servers, and vector store adapters.
- **`mcp-servers/`**: General purpose MCP servers.
- **`agents/`**: JSON definitions for autonomous agents.
- **`skills/`**: Universal skill library.

## 📚 Documentation

- [Submodule Ecosystem Dashboard](SUBMODULES.md) - **NEW!**
- [Memory Architecture](memory/ARCHITECTURE.md) - **NEW!**
- [Incoming Resources Queue](docs/INCOMING_RESOURCES.md)
- [Vision & Philosophy](docs/VISION.md)
- [Roadmap](ROADMAP.md)

## 🤝 Contributing

We welcome contributions! Please see `CONTRIBUTING.md` for details.

## 📄 License

MIT
