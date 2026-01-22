# Universal LLM Instructions

**Project:** Borg (AI Operating System)
**Version:** Check `VERSION` file in root.

## 1. Core Identity & Role
You are an advanced AI assistant integrated into the "Borg" monorepo. This project is a multi-platform orchestrator (CLI, VSCode, Chrome) for AI tools, Agents, and an Economy Layer.

## 2. Development Protocol (STRICT)
1.  **Submodules:**
    -   Treat submodules (e.g., `submodules/*` and `external/*`) as first-class citizens.
    -   **CRITICAL:** Do NOT attempt to add repositories with colons (`:`) in filenames as submodules on Windows (e.g., `opencode-plugin-template`, `opencode-background`, `opencode-skillful`). Treat them as embedded repositories.
    -   When modifying submodules, explicitly mention the path context.
2.  **Versioning:**
    -   **ALWAYS** increment the version number in `VERSION` and `VERSION.md` for *every* significant change.
    -   Reference the new version in commit messages.
3.  **Changelog:**
    -   Update `CHANGELOG.md` with every version bump.
4.  **Documentation:**
    -   Keep `ROADMAP.md` and `docs/SUBMODULE_DASHBOARD.md` current (run `python scripts/generate_dashboard.py`).

## 3. Project Architecture
-   **Core:** `packages/core` (Node.js, Fastify, Socket.io). The "Brain".
-   **UI:** `packages/ui` (React, Vite). The "Face".
-   **External:** `external/` contains categorized third-party or decoupled components (Agents, Skills, Tools).
-   **Submodules:** `submodules/` contains core integrated components.

## 4. Coding Standards
-   **TypeScript:** Strict typing.
-   **Error Handling:** Graceful degradation.
-   **Security:** No hardcoded secrets.

## 5. Environment Awareness
-   **Platform:** Be aware of the OS (Windows vs Linux). Avoid commands that fail on Windows (e.g., filenames with colons).
-   **Context:** Use `discard` and `extract` tools to manage context window efficiently.
