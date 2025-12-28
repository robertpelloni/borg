# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3] - 2025-12-28

### Maintenance
- **Submodules**: Sync and update all submodules to latest versions. Removed broken references (`vibeship-mind`, `agentic-qe`).
- **Dashboard**: Updated `docs/SUBMODULE_DASHBOARD.md` with accurate commit hashes and versions.
- **Versioning**: Synchronized all package versions (`core`, `ui`, `cli`) to `0.2.3`.

## [0.2.2] - 2025-12-27

### Maintenance
- **Submodules**: Comprehensive update of all submodules and reference repositories to their latest upstream versions.
- **Dashboard**: Updated `docs/SUBMODULE_DASHBOARD.md` with the latest submodule versions, commit hashes, and project structure explanation.
- **Documentation**: Updated `ROADMAP.md` and `VERSION.md` to reflect the latest release.

## [0.2.1] - 2025-12-27

### Maintenance
- **Versioning**: Synchronized all package versions to `0.2.1` to match `VERSION.md`.
- **Documentation**: Created `docs/SUBMODULES.md` to track all submodule versions and locations.
- **Standards**: Verified all LLM instruction files reference the universal `docs/LLM_INSTRUCTIONS.md`.

## [0.2.0] - 2025-12-27

### Added
- **Context Visualization**: Implemented `ContextAnalyzer` to breakdown LLM context usage (System, User, Memory, Code, Tool).
- **Traffic Inspector UI**: New "Mcpshark" interface in the UI to visualize traffic logs and context composition bars.
- **Shell Management**: Ported `ShellManager` from Quotio (Swift) to TypeScript for safe CLI installation and profile management.
- **Submodules**: Added `quotio` and `CLIProxyAPI` as core references.
- **Backend Robustness**: Improved `McpProxyManager` to handle MetaMCP connection failures gracefully.

## [0.0.8] - 2025-12-25

### Added
- **Semantic Search**: Implemented vector-based memory search using OpenAI Embeddings (`text-embedding-3-small`).
- **Traffic Inspection**: Added `LogManager` to persist and query traffic logs (`logs/traffic.jsonl`).
- **Cost Tracking**: Added token usage and cost estimation to the Inspector UI.
- **Profile Management**: Implemented `ProfileManager` to switch between agent/tool configurations.
- **Context Generation**: Added tools to auto-generate `CLAUDE.md` and `.cursorrules` from active profiles.
- **Inspector UI**: Enhanced Inspector with historical log viewing and cost metrics.

## [0.0.7] - 2025-12-25

### Added
- **Memory Snapshots**: Implemented `create_snapshot`, `restore_snapshot`, and `list_snapshots` tools in `MemoryManager` to enable session handoff and persistence.

## [0.0.6] - 2025-12-25

### Added
- **Session Keeper**: Full integration of `SessionKeeperManager` with "Debate Mode" (Council) and automated nudging for stuck agents.
- **Project Dashboard**: New `/project` page displaying real-time submodule status and project directory structure.
- **Documentation**: Created `docs/LLM_INSTRUCTIONS.md` as the universal source of truth for AI agents.
- **Instructions**: Added model-specific instruction files (`CLAUDE.md`, `GEMINI.md`, etc.) referencing the universal standard.

### Changed
- **Submodules**: Merged `jules-session-keeper-integration` into `jules-app` and synced to `packages/ui`.
- **Roadmap**: Updated `ROADMAP.md` to reflect completed features.
- **Versioning**: Bumped version to 0.0.6 across all packages.

## [0.0.5] - 2025-12-25

### Maintenance
- **Submodules**: Comprehensive update of all submodules (`jules-app`, `OpenHands`, `beads`, `vibeship-mind`, `agentic-qe`, `claude-code-router`).
- **Documentation**: Updated `ROADMAP.md` to reflect completed System Dashboard integration.
- **Versioning**: Bumped core and UI package versions.

## [0.0.4] - 2024-05-23

### Updated
- **Submodules**: Updated all submodules including `jules-app`, `OpenHands`, `beads`, `vibeship-mind`, and `agentic-qe`.
- **Jules App**: Synced latest `SessionList` and `BroadcastDialog` components.

## [0.0.3] - 2024-05-23

### Updated
- **Jules App**: Updated `jules-app` submodule to latest version.
- **UI Components**: Synced `BroadcastDialog` and `SessionList` with upstream changes.
- **Settings**: Fixed issue where clicking the gear icon did nothing.
- **System Dashboard**: Added a new dashboard page to view submodule status and project structure.

## [0.0.2] - 2024-05-23

### Added
- **Jules Control Tower**: Integrated Jules dashboard into the main UI.
- **Broadcast Dialog**: Added ability to broadcast messages to all sessions.
- **Session Management**: Improved session list with better status indicators and navigation.
- **Server Supervisor**: Added TypeScript support for server supervisor API.

### Fixed
- **Navigation**: Fixed issue where clicking a session redirected to the home page.
- **Build**: Fixed lockfile patching issues on Windows.
- **Submodules**: Updated `jules-app`, `OpenHands`, and `beads` submodules.

## [0.0.1] - Initial Release
- Initial release of AIOS.
