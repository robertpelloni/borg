# Submodule Dashboard & Directory Structure

**Version:** 0.5.1
**Updated:** 2026-01-14

## Project Structure Overview

The project is organized into a monorepo structure with dedicated zones for different capabilities:

```
/
├── packages/           # Core application packages (monorepo)
│   ├── core/           # Main AIOS logic, server, managers
│   ├── ui/             # Web Dashboard (Next.js)
│   ├── cli/            # Command Line Interface & TUI
│   ├── adapters/       # Adapters for external AI tools
│   └── vscode/         # VS Code Extension
│
├── superai-cli/        # CLI Tools & Submodules
│   ├── clis/           # External CLI tools (gh submodule)
│   ├── clis-refs/      # Reference implementations
│   ├── tools/          # Standalone tools
│   └── agents/         # Agent-specific CLIs
│
├── memory/             # Memory Systems & integrations
│   ├── systems/        # Full memory systems (Zep, Mem0, etc.)
│   ├── mcp-servers/    # Memory-related MCP servers
│   ├── vector-stores/  # Vector database adapters
│   └── plugins/        # Memory plugins
│
├── mcp-servers/        # General MCP Servers
│   ├── search/         # Search & Retrieval
│   ├── financial/      # Financial & Crypto
│   ├── browser/        # Browser Automation
│   └── ai/             # AI Model Adapters
│
├── agents/             # Agent definitions
├── skills/             # Skill definitions
└── docs/               # Documentation
```

## Submodule Inventory

### Core Integrations
| Submodule | Path | Description |
|-----------|------|-------------|
| **MetaMCP** | `submodules/metamcp` | Core MCP Aggregator/Proxy |
| **Mcpenetes** | `submodules/mcpenetes` | Kubernetes-like MCP orchestration |
| **MCP Hub** | `references/mcphub` | Central hub for MCP tools |

### SuperAI CLI Collection (`superai-cli/`)
| Tool | Path | Version/Ref |
|------|------|-------------|
| **Fabric** | `superai-cli/clis-refs/fabric` | AI CLI workflow patterns |
| **Gemini CLI** | `superai-cli/clis-refs/gemini-cli` | Google Gemini CLI wrapper |
| **Goose** | `superai-cli/clis-refs/goose` | Block's AI developer agent |
| **Grok CLI** | `superai-cli/clis-refs/grok-cli` | xAI Grok interface |
| **KiloCode** | `superai-cli/clis-refs/kilocode` | Kilo AI coding assistant |
| **CodeBuff** | `superai-cli/clis/codebuff` | AI Coding Assistant |
| **Kimi CLI** | `superai-cli/clis/kimi-cli` | Moonshot AI CLI |

### Memory Systems (`memory/`)
| System | Path | Integration Type |
|--------|------|------------------|
| **Zep** | `memory/systems/zep` | Long-term memory store |
| **Mem0** | `memory/systems/mem0` | Personalized memory layer |
| **Letta** | `memory/systems/letta` | LLM memory management |
| **Supermemory** | `memory/systems/supermemory` | Knowledge graph memory |
| **Qdrant MCP** | `memory/mcp-servers/qdrant-mcp` | Vector DB MCP Server |
| **Chroma** | `memory/vector-stores/chroma` | Vector Database |
| **Cognee** | `memory/systems/cognee` | Graph RAG Memory |
| **TxtAI** | `memory/systems/txtai` | Semantic Search |

### Financial & Crypto (`mcp-servers/financial/`)
- Octagon MCP
- Alpha Vantage
- Financial Datasets
- Binance MCP
- Coingecko
- Upsonic

### Search (`mcp-servers/search/`)
- MindsDB
- DesktopCommander
- Web Search MCP

## Versioning Strategy
- **Core:** Follows `package.json` version.
- **Submodules:** Tracked via git commit hash.
- **Updates:** Run `git submodule update --remote` to fetch latest upstream changes.

## Maintenance
To update all submodules:
```bash
git submodule update --init --recursive --remote
```
