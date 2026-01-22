# Submodule Dashboard

This document tracks the status, location, and purpose of all submodules in the borg ecosystem.

| Submodule | Path | Description |
| :--- | :--- | :--- |
| **mcpenetes** | `submodules/mcpenetes` | Client configuration injection and management. |
| **metamcp** | `submodules/metamcp` | Meta-orchestrator for complex routing and tool aggregation. |
| **jules-app** | `submodules/jules-app` | The "Jules" assistant logic and session management (Remote). |
| **opencode-autopilot-council** | `submodules/opencode-autopilot-council` | The "Council" assistant logic and session management (Local). |
| **quotio** | `submodules/quotio` | Shell profile management and CLI installation logic. |
| **CLIProxyAPI** | `submodules/CLIProxyAPI` | Proxy API for CLI tools. |
| **claude-mem** | `submodules/claude-mem` | Memory management logic and patterns. |
| **MCP-SuperAssistant** | `references/MCP-SuperAssistant` | Browser extension bridge. |
| **magg** | `references/magg` | MCP Aggregator reference. |
| **mcphub** | `references/mcphub` | MCP Hub reference. |
| **mcpproxy-go** | `references/mcpproxy-go` | Go-based MCP proxy reference. |
| **pluggedin-mcp** | `references/pluggedin-mcp` | Plugin system reference. |
| **Super-MCP** | `references/Super-MCP` | Super-agent reference. |
| **opencode** | `references/opencode` | Open source code interpreter reference. |
| **notebooklm-mcp** | `references/notebooklm-mcp` | NotebookLM integration reference. |
| **voicemode** | `references/voicemode` | Voice interaction reference. |
| **pluggedin-app** | `references/pluggedin-app` | App reference. |
| **pctx** | `references/pctx` | Persistent Context reference. |
| **mcp-server-code-execution-mode** | `references/mcp-server-code-execution-mode` | Code execution server reference. |
| **mux** | `references/mux` | Multiplexer reference. |
| **Puzld.ai** | `references/Puzld.ai` | Puzzle solving reference. |
| **emdash** | `references/emdash` | CLI dashboard reference. |
| **claude-squad** | `references/claude-squad` | Multi-agent squad reference. |
| **mcpm.sh** | `references/mcpm.sh` | MCP Package Manager reference. |
| **superpowers** | `references/superpowers` | Skills library reference. |
| **smolagents** | `references/smolagents` | Small agent framework reference. |
| **pal-mcp-server** | `references/pal-mcp-server` | PAL reference. |
| **Polymcp** | `references/Polymcp` | Polyglot MCP reference. |
| **lazy-mcp** | `references/lazy-mcp` | Lazy loading reference. |
| **MCP-Zero** | `references/MCP-Zero` | Zero-config MCP reference. |
| **mcp-tool-chainer** | `references/mcp-tool-chainer` | Tool chaining reference. |
| **prompt-eng-tutorial** | `references/prompt-eng-tutorial` | Prompt engineering guide. |
| **awesome-llm-apps** | `references/awesome-llm-apps` | App collection. |
| **agents-md** | `references/agents-md` | Agent definition standard. |
| **claude-code-infrastructure-showcase** | `references/claude-code-infrastructure-showcase` | Infrastructure showcase. |
| **gemini-cli-tips** | `references/prompts/gemini-cli-tips` | Gemini CLI tips. |
| **thoughtbox** | `references/prompts/thoughtbox` | Thinking process prompts. |
| **claude-code-system-prompts** | `references/prompts/claude-code-system-prompts` | System prompts. |
| **claude-code-config** | `references/config/claude-code-config` | Configuration reference. |
| **spec-kit** | `references/arch/spec-kit` | Specification toolkit. |
| **CodeMachine-CLI** | `references/arch/CodeMachine-CLI` | CLI architecture reference. |
| **dev-browser** | `references/skills/dev-browser` | Browser automation skill. |
| **claude-code-router** | `references/arch/claude-code-router` | Router architecture. |
| **BMAD-METHOD** | `references/agents/BMAD-METHOD` | Agent methodology. |
| **oai-skills** | `references/skills/oai-skills` | OpenAI skills. |
| **skrills** | `references/skills/skrills` | Skills collection. |
| **toon** | `references/toon` | Token-Oriented Object Notation. |
| **vibeship-mind** | `references/memory/vibeship-mind` | Memory reference. |
| **beads** | `references/memory/beads` | Memory reference. |
| **txtai** | `references/memory/txtai` | Vector database reference. |
| **mem0** | `references/memory/mem0` | Memory platform reference. |
| **letta** | `references/memory/letta` | Memory reference. |
| **cognee** | `references/memory/cognee` | Memory reference. |
| **laddr** | `references/orchestration/laddr` | Orchestration reference. |
| **claude-squad-smtg** | `references/orchestration/claude-squad-smtg` | Squad orchestration. |
| **OpenHands** | `references/agents/OpenHands` | Open source agent framework. |
| **amplifier** | `references/agents/amplifier` | Agent amplifier. |
| **magentic-ui** | `references/agents/magentic-ui` | Agent UI reference. |
| **autogen** | `references/agents/autogen` | Microsoft AutoGen. |
| **agent-zero** | `references/agents/agent-zero` | Agent Zero. |
| **openagents** | `references/agents/openagents` | OpenAgents. |
| **CopilotKit** | `references/frameworks/CopilotKit` | Copilot framework. |
| **claude-orchestration** | `references/orchestration/claude-orchestration` | Claude orchestration. |
| **agentic-qe** | `references/testing/agentic-qe` | Quality engineering agents. |

## CLI Ecosystem (Swiss Army Knife)

These submodules represent the "blades" of the borg Swiss Army Knife. They are integrated as references to allow the OS to drive them.

| Submodule | Path | Description |
| :--- | :--- | :--- |
| **gemini-cli** | `references/clis/gemini-cli` | Official Google Gemini CLI. |
| **aider** | `references/clis/aider` | AI pair programmer with repo map. |
| **mentat** | `references/clis/mentat` | AI coding assistant. |
| **fabric** | `references/clis/fabric` | Augmented intelligence framework. |
| **goose** | `references/clis/goose` | Developer agent by Block. |
| **kilocode** | `references/clis/kilocode` | Agentic engineering platform. |

## Directory Structure

```
borg/
├── packages/           # Monorepo packages
│   ├── core/           # The "Hub" (Node.js backend)
│   ├── ui/             # The Dashboard (Next.js frontend)
│   ├── cli/            # CLI wrapper
│   └── types/          # Shared TypeScript types
├── submodules/         # Core integrated submodules (Active)
├── references/         # Reference implementations (Passive)
├── docs/               # Documentation
├── agents/             # Agent definitions
├── hooks/              # System hooks
├── mcp-servers/        # Local MCP servers
└── skills/             # Universal skills
```
