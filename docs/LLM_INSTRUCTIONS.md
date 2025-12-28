# Universal LLM Instructions & Project Charter

This document serves as the **Single Source of Truth** and **Universal Charter** for all AI agents (Claude, Gemini, GPT, Copilot, etc.) working on the **AIOS** project.

## 1. The Charter: Core Protocol & Mission
**Mission:** To create a universal, platform-agnostic "Hub" that connects any LLM to any tool with persistent memory, autonomous agents, and a unified dashboard.

### 🚀 Operational Protocol (The "Golden Rules")
All agents must adhere to this strict protocol for every session:

1.  **Sync & Hygiene:**
    *   Always sync the local repo with the server (git fetch, git pull).
    *   **Submodules:** Update all submodules and merge upstream changes (including forks) using git submodule update --remote --merge.
    *   **Branches:** Merge all feature branches into main. Resolve conflicts immediately.
    *   **Handoff:** Document session history, findings, and changes in a handoff file if switching contexts.

2.  **Analysis & Planning:**
    *   Reanalyze the project state and history to identify missing features.
    *   Update ROADMAP.md to reflect progress (distinguish clearly between accomplished and remaining tasks).
    *   Maintain a dashboard (docs/SUBMODULE_DASHBOARD.md) listing all submodules with versions, dates, and locations.

3.  **Execution & Autonomy:**
    *   **Be Autonomous:** Complete features, commit, push, and continue without stopping if possible.
    *   **Test:** Run tests and correct errors found along the way.
    *   **Redeploy:** After significant changes, ensure the application is buildable and deployable.

4.  **Versioning & Changelog:**
    *   **Single Source of Truth:** VERSION.md contains the current version number.
    *   **Increment:** Every build/significant change MUST increment the version number.
    *   **Changelog:** Update CHANGELOG.md with a detailed list of changes (Added, Changed, Fixed).
    *   **Commits:** Commit messages must reference the version bump (e.g., chore: release v0.2.3 - update mcpenetes).

## 2. Project Structure & Architecture
*   **Hub (packages/core):** Node.js/Fastify backend. The central nervous system.
*   **Dashboard (packages/ui):** Next.js 14 App Router frontend.
*   **Submodules (submodules/):** Integrated components (Jules, MetaMCP, MCPenetes, etc.).
*   **References (eferences/):** Research material and cloned repositories.

## 3. Universal Agent Standards
*   **Format:** All agents defined in gents/ as JSON/YAML.
*   **Schema:** Follow packages/core/src/types/Agent.ts.
*   **Capabilities:** Clearly list tools and permissions.

## 4. Model-Specific Instructions
While this file is the universal standard, specific models should check their respective files for tailored optimizations:
*   **Claude:** CLAUDE.md (Focus on claude-mem and concise TS).
*   **Gemini:** GEMINI.md (Leverage large context).
*   **GPT:** GPT.md (Focus on reasoning).
*   **Copilot:** copilot-instructions.md (VS Code integration).

## 5. Submodule Management Strategy
*   **Updates:** Regularly run git submodule update --remote --merge.
*   **Commits:** Commit submodule pointer updates to the root repo.
*   **Dashboard:** Keep docs/SUBMODULE_DASHBOARD.md updated with the latest commit hashes and versions.

## 6. Documentation Standards
*   **Roadmap:** Keep ROADMAP.md current.
*   **Changelog:** Keep CHANGELOG.md current.
*   **Version:** Keep VERSION.md current.

---
**"Outstanding work. Please continue to proceed as per your recommendation and analysis, ideally using subagents if possible to implement each feature, and commit/push to git in between each major step."**
