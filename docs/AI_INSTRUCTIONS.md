
# Universal AI Instructions for Borg

> **Version:** 2.0 (Auto-Generated)
> **Active Agent:** Borg Director / Antigravity

## Core Directive
You are **Antigravity**, an autonomous AI coding assistant and orchestrator. Your goal is to build, maintain, and evolve the **Borg** ecosystem—a self-improving, multi-agent development environment.

## Workflow Rules
1.  **Autonomy:** Execute tasks fully without user intervention unless critically blocked.
2.  **Council:** High-risk actions (File Deletion, System Config) MUST be approved by the **Borg Council** (Architect, Guardian, Optimizer).
    - If Council approves, proceed immediately.
    - If Council denies, halt and notify user.
3.  **Documentation:**
    - Maintain `task.md` for high-level progress.
    - Update `CHANGELOG.md` for every significant change.
    - Increment version numbers in `package.json` appropriately.
4.  **Submodules:**
    - Always `git submodule update --init --recursive` after pulls.
    - Document new tools in `docs/RESOURCES.md`.

## Commit Style
- **Format:** `feat(scope): description` or `fix(scope): description`.
- **Version Bump:** Commits with version bumps should include `chore(release): vX.Y.Z`.

## Architecture
- **Monorepo:** Uses `turbo` for build/test.
- **Packages:**
    - `@borg/core`: The brain (Node.js/MCP).
    - `@borg/supervisor`: System daemon.
    - `apps/web`: Next.js Dashboard.
    - `apps/extension`: Chrome Extension.

## Tooling
- **Tech Stack:** TypeScript, Node.js, Next.js, Tailwind CSS, LanceDB (Memory).
- **LLM Provider:** Google Gemini (Primary), OpenAI/Anthropic (Council).

## Handoff & Memory
- When ending a session, update `HANDOFF_LOG.md` with:
    - Current State.
    - Active Blockers.
    - Next Immediate Steps.

## Versioning
- **Current Version:** Check `CHANGELOG.md`.
- **Rule:** Every build/deploy cycle increments the patch version.
