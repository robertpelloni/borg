# Universal LLM Instructions & Project Standards

This document serves as the single source of truth for all AI agents (Claude, Gemini, GPT, Copilot, etc.) working on the **AIOS (Super AI Plugin)** project.

## 1. Project Identity & Mission
**Project Name:** AIOS (Super AI Plugin)
**Mission:** To create a universal, platform-agnostic "Hub" that connects any LLM (Claude, Gemini, OpenAI) to any tool (MCP, Local, Remote) with persistent memory, autonomous agents, and a unified dashboard.

## 2. Core Architecture
- **Hub (`packages/core`):** Node.js/Fastify backend. Handles MCP connections, agent orchestration, and memory.
- **Dashboard (`packages/ui`):** Next.js 14 App Router frontend. Provides the user interface.
- **Submodules:**
    - `jules-app`: The "Jules" assistant logic and session management.
    - `metamcp`: Meta-orchestrator for complex routing.
    - `mcpenetes`: Configuration injection for clients.
    - `claude-mem`: Memory management logic.

## 3. Versioning & Changelog Protocol
**CRITICAL:** Every significant update must be accompanied by a version bump and changelog entry.

### Versioning Strategy
- **File:** `package.json` (Root) is the master version.
- **Format:** Semantic Versioning (`MAJOR.MINOR.PATCH`).
- **Synchronization:** When `package.json` is updated, ensure `packages/core/package.json` and `packages/ui/package.json` are also updated if they were modified.

### Changelog Protocol (`CHANGELOG.md`)
- **Format:** Keep a reverse-chronological list of changes.
- **Header:** `## [Version] - YYYY-MM-DD`
- **Sections:** `### Added`, `### Changed`, `### Fixed`, `### Removed`.
- **Commit Messages:** When committing a version bump, use: `chore: release vX.Y.Z - [Brief Summary]`.

## 4. Coding Standards
- **Language:** TypeScript (Strict mode).
- **Package Manager:** pnpm.
- **Style:** Functional components (React), Modular services (Node.js).
- **Comments:** Use JSDoc for all public functions and interfaces.
- **Error Handling:** Use typed error handling. Avoid `any`.

## 5. Submodule Management
- **Updates:** When updating submodules, always run `git submodule update --remote --merge`.
- **Commits:** Always commit submodule pointer updates in the root repo with a clear message (e.g., `chore: update jules-app submodule`).
- **Dashboard:** The `/project` page in the UI must reflect the current state of submodules.

## 6. Documentation
- **Roadmap:** Keep `ROADMAP.md` current. Mark completed features with `[x]`.
- **Agents:** `AGENTS.md` (if present in subfolders) defines specific agent behaviors.
- **Universal Instructions:** This file (`docs/LLM_INSTRUCTIONS.md`) is the master reference.

## 7. Operational Protocol
1.  **Analyze:** Before writing code, read `ROADMAP.md` and `docs/`.
2.  **Plan:** Break down tasks.
3.  **Implement:** Write code, ensuring types are correct.
4.  **Verify:** Run builds (`npm run build` in `packages/ui` or `packages/core`).
5.  **Document:** Update `CHANGELOG.md` and `ROADMAP.md`.
6.  **Version:** Bump version in `package.json`.
7.  **Commit:** `git commit -m "feat/fix: description"`.
8.  **Push:** `git push`.

## 8. Model-Specific Overrides
- **Claude:** Focus on concise, idiomatic TypeScript. Use `claude-mem` patterns.
- **Gemini:** Leverage large context windows for analysis.
- **Copilot:** Focus on inline code completion and VS Code integration.
