# Submodule Dashboard

This document tracks the status, location, and version of all submodules and reference repositories in the AIOS project.

## Core Submodules (`submodules/`)

| Name | Path | Description | Status |
|------|------|-------------|--------|
| **jules-app** | `submodules/jules-app` | The main "Jules" assistant logic and session management. | ✅ Active |
| **metamcp** | `submodules/metamcp` | Meta-orchestrator for complex routing and traffic inspection. | ✅ Active |
| **mcpenetes** | `submodules/mcpenetes` | Configuration injection for clients (VSCode, Cursor). | ✅ Active |
| **claude-mem** | `submodules/claude-mem` | Memory management logic and patterns. | ✅ Active |
| **quotio** | `submodules/quotio` | Reference for shell profile management (Swift). | ✅ Reference |
| **CLIProxyAPI** | `submodules/CLIProxyAPI` | Reference for CLI proxying. | ✅ Reference |

## Reference Repositories (`references/`)

These are cloned repositories used for research, pattern extraction, and feature porting.

| Name | Path | Description |
|------|------|-------------|
| **agent-mcp-gateway** | `references/agent-mcp-gateway` | Gateway patterns. |
| **agents** | `references/agents` | General agent patterns. |
| **code-executor-MCP** | `references/code-executor-MCP` | Reference for `CodeExecutionManager`. |
| **lazy-mcp** | `references/lazy-mcp` | Lazy loading patterns. |
| **mcp-server-code-execution-mode** | `references/mcp-server-code-execution-mode` | Sandboxing reference. |
| **pctx** | `references/pctx` | Persistent Context patterns. |
| **smolagents** | `references/smolagents` | Lightweight agent loops. |
| **superpowers** | `references/superpowers` | Skill definitions. |
| **voicemode** | `references/voicemode` | Voice integration. |

*(Note: This list is auto-generated and may not be exhaustive. See `docs/SUBMODULE_INDEX.csv` for more.)*

## Project Structure Explanation

```
AIOS/
├── packages/
│   ├── core/       # The Node.js/Fastify Hub (Backend)
│   ├── ui/         # The Next.js Dashboard (Frontend)
│   ├── cli/        # The 'aios' command line tool
│   └── types/      # Shared TypeScript definitions
├── submodules/     # Integrated components (Git Submodules)
├── references/     # Research material (Git Submodules/Clones)
├── docs/           # Documentation & Strategy
├── scripts/        # Utility scripts
└── mcp-servers/    # Local MCP servers managed by the Hub
```
