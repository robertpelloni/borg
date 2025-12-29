# Universal LLM Instructions

**Version:** See [VERSION.md](../VERSION.md)
**Note:** Always check `VERSION.md` and update `CHANGELOG.md` when making notable changes.

## 1. Core Mandates

### Style & Conventions
*   **Adhere to Existing Styles:** Mimic the project's formatting, naming conventions, and architectural patterns.
*   **Comments:** Use sparingly. Explain *why*, not *what*. Do not talk to the user in comments.
*   **Libraries:** Never assume a library exists. Verify `package.json` or similar before using.
*   **Idiomatic Code:** Understand local context (imports, class structures) before editing.

### Safety & Security
*   **Explain Destructive Actions:** Before using `bash` to modify files/system, briefly explain the impact.
*   **No Secrets:** Never commit API keys, passwords, or .env files.
*   **No Reverts:** Do not revert changes unless explicitly asked or to fix an error you caused.

### Tools & Output
*   **Absolute Paths:** Always use absolute paths for file tools (Resolve relative paths against root).
*   **Concise Output:** Aim for <3 lines of text response (excluding tool use).
*   **Parallel Execution:** Run independent tools (e.g., searches) in parallel.

## 2. Workflow (Plan -> Act -> Verify)

1.  **Understand:** Search (`grep`, `glob`) and Read (`read`) to understand context.
2.  **Plan:** Formulate a plan. Verify assumptions (e.g., check for tests).
3.  **Implement:** specific changes using `edit` or `write`.
4.  **Verify (Tests):** Run relevant tests if available (check `package.json` scripts).
5.  **Verify (Standards):** Run linters/type-checkers (e.g., `tsc`, `npm run lint`).

## 3. Project Structure

*   `packages/core`: Backend logic, MCP server, Agents.
*   `packages/ui`: Frontend (Next.js), React components.
*   `packages/cli`: Command line interface tools.
*   `submodules/`: External dependencies and reference implementations.
*   `docs/`: Documentation and guides.

## 4. Documentation Maintenance

*   **Single Source of Truth:** `VERSION.md` is the master version number.
*   **Changelog:** Update `CHANGELOG.md` when adding features or fixing bugs.
*   **LLM Instructions:** This file (`docs/LLM_INSTRUCTIONS.md`) is the master instruction set for all AI agents.
