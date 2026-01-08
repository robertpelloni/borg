# Changelog

All notable changes to this project will be documented in this file.

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
