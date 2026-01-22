# Changelog

All notable changes to this project will be documented in this file.

## [0.5.1] - 2026-01-14

### Massive Ecosystem Integration
- **Submodule Expansion:** Integrated **229** submodules covering the entire AI coding landscape.
  - **SuperAI CLI:** Added `superai-cli/` with wrappers for Codebuff, Kimi, Claude Code, and more.
  - **Memory:** Added `memory/` ecosystem with LettA, Mem0, Zep, and local vector stores.
  - **MCP Servers:** Added 36+ general purpose MCP servers (Financial, Browser, Search).
  - **Computer Use:** Integrated `computer-use/` tools including Microsoft Fara and Magentic UI.
- **Dashboard Generator:** Added `scripts/generate_dashboard.py` to automatically track and categorize all integrated submodules in `SUBMODULES.md`.

### Added
- **Submodules:**
  - `agents/refs/agentapi`: Universal agent control API.
  - `agents/workty`: Task management agent.
  - `superai-cli/clis/codex-kaioken`: Advanced Codex wrapper.
  - `tools/security/claude-code-safety-net`: Safety layer for AI agents.
  - `tools/github/claude-code-gh-dash`: GitHub dashboard integration.
  - `skills/external/ensue-skill`: Skill library integration.

### Documentation
- **SUBMODULES.md:** Fully populated ecosystem dashboard with categorized tables and version tracking.
- **ROADMAP.md:** Updated to reflect the completion of Ecosystem Integration and new goals for Unified CLI Runner and Sandboxing.

## [0.5.0] - 2026-01-14

### Major Pivot: The SuperAI Era
Shifted focus from "Enterprise Wrapper" to "Best-in-Class AI Coding Harness" (SuperAI).

### Added
- **Traffic Inspection Service:** Real-time correlation, persistence, and filtering of MCP JSON-RPC traffic.
- **Memory Plugin Architecture:** Unified `MemoryPluginManager` supporting `chroma`, `google-drive`, `mem0`.
- **Tool Inventory Service:** Auto-discovery of installed CLI tools (Aider, Docker, Redis).
- **Process Guardian:** Background service for monitoring and restarting critical AI processes.
- **WebUI Dashboards:**
  - `TrafficInspector`: High-fidelity visualization of MCP calls with request/response correlation.
  - `ToolInventory`: Dashboard for tracking local tool status and versions.
  - `InfrastructureDashboard`: Real-time monitoring of Redis, P2P Mesh, and Consensus.
- **SuperAI CLI:** New `superai-cli/` directory structure consolidating all CLI tools, adapters, and agents.
- **TUI Dashboard:** Ink-based terminal UI (`borg tui`) for managing the system from the command line.
- **Memory Ecosystem:** Comprehensive memory system integration with dedicated `memory/` directory structure supporting multiple backends (Vector, Graph, Local).
- **Submodule Dashboard:** Created `SUBMODULES.md` to track and document the extensive list of integrated tools and libraries.
  
### Changed
- **Branding:** Renamed "JULES" to "SuperAI Engine" or "SuperAI Command".
- **Documentation:** Massive reorganization of `SUBMODULES.md` into functional categories (Memory, CLI, Agents).
- **Core:** Fully migrated from Fastify routes to Hono for better performance and type safety.
- **Structure:** Reorganized submodules into functional zones (`memory/`, `superai-cli/`) for better discoverability.

### Removed
- **Legacy Routes:** Deleted `contextRoutes.ts`, `ingestionRoutes.ts`, `memoryRoutes.ts` (Fastify versions).

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
