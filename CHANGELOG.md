# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-01-13

### Added
- **Phase 11 & 12 Completion:** Multi-Model AI Council and TUI Orchestrator phases fully completed.

#### RAG System (AIChat Pattern)
- `HnswIndex.ts` - HNSW approximate nearest neighbor search with configurable M, efConstruction, efSearch
- `BM25Index.ts` - BM25 keyword scoring with IDF weighting and k1/b tuning
- `HybridRagSystem.ts` - Combined hybrid search with configurable vector/keyword weights

#### Architect Mode (Aider Pattern)
- `ArchitectMode.ts` - Two-model reasoning+editing with EventEmitter for streaming
- `architectRoutesHono.ts` - REST API at `/api/architect/*` for session management

#### Git Worktree Isolation (Claude-Squad Pattern)
- `GitWorktreeManager.ts` - Parallel git worktrees for agent isolation
- `gitWorktreeRoutesHono.ts` - REST API at `/api/worktrees/*` for worktree CRUD

#### Dynamic Supervisor Selection
- Enhanced `SupervisorCouncilManager.selectOptimalTeam()` with historical performance weighting
- `inferSpecialtiesFromFiles()` for file-type specialty inference
- `estimateTaskComplexity()` for task complexity scoring
- Diversity bonus for team composition

#### Supervisor Plugin Ecosystem
- `SupervisorPluginManager.ts` - Plugin loading from directory/npm, inline registration
- `supervisorPluginRoutesHono.ts` - REST API at `/api/supervisor-plugins/*`
- Example plugin at `plugins/supervisors/example-supervisor/`

#### Supervisor Analytics & Debate Templates
- `supervisorAnalyticsRoutesHono.ts` - Performance tracking REST API
- `debateTemplateRoutesHono.ts` - Pre-configured debate scenarios REST API

#### IDE Extensions
- **VS Code:** Enhanced with Council integration (startDebate, viewAnalytics, listDebateTemplates, architectMode)
- **JetBrains:** Kotlin plugin skeleton with Tool Window, Actions, HTTP client
- **Zed:** Rust WASM extension with slash commands (debate, architect, analytics)
- **Neovim:** Full Lua plugin with Telescope integration (pickers for templates, analytics, sessions)

### Changed
- Updated ROADMAP.md to mark Phase 11 & 12 as completed

## [0.4.1] - 2026-01-09

### Added
- **Testing Infrastructure:** Configured Vitest at monorepo root with unified test runner.
  - New test suites for `CouncilManager` and `SessionManager` in `packages/core/test/`.
  - Migrated existing UI tests from Jest to Vitest (`archive`, `templates`, `jules/client`, `jules/route`).
  - 8 test suites, 35 tests passing.

### Fixed
- **Core Package:** Added missing `uuid` runtime dependency (was only in devDeps as `@types/uuid`).
- **Test Cleanup:** Fixed `delete global.window` issue in Vitest by using `configurable: true` property definitions.

### Removed
- **Submodules:** Removed redundant `submodules/opencode-autopilot-backup`.

### Documentation
- **Architecture Analysis:** Documented SessionManager separation (Core vs Autopilot serve different purposes).
- **UI Drift:** Identified orchestration logic drift between UI port and Autopilot Council (sequential vs parallel debate).

## [1.2.1] - 2026-01-08

### Maintenance
-   **Ralph Loop:** Synchronized 70+ submodules to latest upstream versions.
-   **Dashboard:** Enhanced Ecosystem Dashboard to display submodule commit hashes and last update dates.
-   **Docs:** Updated `docs/project/STRUCTURE.md` with detailed directory layout.

## [0.3.0] - 2026-01-08

### Deep Initialization & Cleanup
- **Versioning:** Standardized project version to `0.3.0` across all packages (bumped from 0.2.5).
- **Submodules:** Deep synchronization of all submodules.
- **Fixes:** Resolved Windows path issues by removing `opencode-skillful`.
- **Documentation:** Created `SUBMODULES.md` dashboard.

## [1.1.1] - 2026-01-05

### Fixed
-   **Critical Git Repair:** Restored ~70 broken submodules in `external/` directory that were missing from `.gitmodules` or had detached configurations.
-   **Windows Compatibility:** Converted specific repositories with colon-containing filenames (`opencode-plugin-template`, `opencode-background`, `opencode-skillful`) to embedded repositories to prevent filesystem errors on Windows.
-   **Dashboard:** Updated `scripts/generate_dashboard.py` to correctly identify and report status of both registered submodules and embedded repositories.

### Added
-   `docs/SUBMODULE_DASHBOARD.md`: Automated dashboard tracking submodule versions and status.

## [1.1.0] - Previous

### Added
-   Initial monorepo structure (Core, UI).
-   Core Service with Fastify & Socket.io.
-   Managers for Agents, Skills, Hooks, Prompts.
-   MCP Server management (stdio).
-   Documentation (ROADMAP, STRUCTURE, AGENTS).
