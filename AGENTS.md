# Borg AGENT KNOWLEDGE BASE

**Context:** The Ultimate AI Coding Harness & Tool Dashboard
**Version:** 0.4.0 (Pivot)

## OVERVIEW
The Borg is an operating system designed specifically for local AI tool management and high-fidelity autonomous coding. It bridges Model Context Protocol (MCP) servers with specialized reasoning and editing agents.

## CORE AGENT SQUADS

### 1. Architect Squad (`ArchitectMode.ts`)
- **Reasoning Model:** Responsible for high-level planning, dependency analysis, and impact assessment.
- **Implementation Model:** Responsible for precise SEARCH/REPLACE diff editing.
- **Verification Loop:** Autonomous self-correction using LSP diagnostics and test runners.

### 2. MCP Orchestrator Squad (`AgentExecutor.ts`)
- **Meta-Tools:** `search_tools`, `load_tool`, `mcp_chain`.
- **Progressive Disclosure:** Keeps context windows clean by exposing only relevant tools.
- **Traffic Guard:** Full inspection and logging of MCP communications.

### 3. Autopilot Squad (`LoopManager.ts`)
- **Recursive Reasoning:** Agents that can self-schedule and recurse indefinitely for complex feature development.
- **Git Mastery:** Autonomous branch creation, worktree management, and merge resolution.

### 4. Research Squad (`Librarian`)
- **Submodule Analyst:** specialized in scraping, summarizing, and indexing external repositories added as submodules.
- **Feature Mapper:** Maps features from external tools to Borg feature parity requirements.
- **Documentation Indexer:** Maintains `resources.json` with up-to-date capabilities of all integrated tools.

## WHERE TO LOOK
| Component | Location | Responsibility |
|------|----------|-------|
| **Coding Harness** | `packages/core/src/agents/ArchitectMode.ts` | Reasoning + Diff Editing logic |
| **MCP Hub** | `packages/core/src/managers/McpProxyManager.ts` | Tool routing, disclosure, and proxying |
| **Tool Inventory** | `packages/core/src/services/ToolInventoryService.ts` | Local tool status and installation |
| **Repo Graph** | `packages/core/src/services/RepoGraphService.ts` | Codebase visualization and mapping |
| **Dashboards** | `packages/ui/src/app/harness/` | TUI/WebUI for architect mode |

## CORE CONVENTIONS
- **Harness Priority:** Always prefer features that improve the developer experience (DX) and code quality.
- **Model Orchestration:** Use O3-mini/DeepSeek-R1 for reasoning and GPT-4o/Claude-3.5-Sonnet for implementation.
- **Diff Editing:** Strictly follow the `SEARCH/REPLACE` protocol for code modifications.
- **LSP Feedback:** Never commit code without verifying it through the `LspManager` diagnostics.

## ANTI-PATTERNS
- **Infra Bloat:** Avoid generic cloud-scale features unless they directly benefit the local coding harness.
- **Context Pollution:** Never expose 100+ tools to an agent at once; use progressive disclosure.
- **Blind Commits:** Don't let agents commit code without autonomous or human verification.
