# PROJECT STRUCTURE

## Repository Layout
```
.
├── packages/
│   ├── core/         # The long-running Borg background service
│   │   ├── src/
│   │   │   ├── agents/      # ArchitectMode, AgentExecutor, LoopManager
│   │   │   ├── managers/    # Core lifecycle managers (MCP, Secret, Skill, etc.)
│   │   │   ├── services/    # Logic services (RepoMap, LSP, Traffic, Inventory)
│   │   │   ├── enterprise/  # Optional enterprise/distributed extensions
│   │   │   └── routes/      # Hono API endpoints
│   ├── ui/           # Next.js Dashboard & Management Hub
│   │   ├── src/
│   │   │   ├── components/  # Dashboard cards, subpanels, and visualizers
│   │   │   └── app/         # Harness, Marketplace, and System views
│   ├── cli/          # Universal Harness CLI
│   ├── types/        # Shared TypeScript definitions
│   └── vscode/       # VSCode Extension source
├── agents/           # JSON definitions for AI agent squad members
├── skills/           # Markdown-defined universal skills library
├── prompts/          # Library of system prompts, templates, and jailbreaks
├── mcp-servers/      # Locally managed MCP server configurations
├── submodules/       # External infrastructure (metamcp, mcpenetes, shark)
├── external/         # External plugins and research
└── docs/             # Technical specifications and guides
```

## Module Interactions
1.  **Harness Flow:** User input -> `ArchitectMode` -> `RepoMapService` -> Reasoning Model -> `EditPlan` -> Implementation Model -> `applyDiffs` -> `LspManager` (Verification).
2.  **MCP Flow:** `HubServer` -> `McpProxyManager` -> `TrafficInspectionService` -> `McpRouter` -> Local/Remote MCP Server.
3.  **Governance Flow:** `SecretManager` + `ToolInventoryService` -> `CoreService` -> Dashboard UI.
