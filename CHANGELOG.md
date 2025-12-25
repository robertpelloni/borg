# Changelog

All notable changes to this project will be documented in this file.

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
- Initial release of Super AI Plugin.
