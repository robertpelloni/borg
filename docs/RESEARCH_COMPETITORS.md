# Competitor Research: CLI Architectures

This document collates deep-dive research into the architectures of major AI Coding CLIs. The goal is to reverse-engineer their best features (System Prompts, Tooling, Context Management) for the borg.

## 1. OpenCode (SST)
*   **Source:** `github.com/sst/opencode`
*   **System Prompt:**
    *   **Identity:** "You are OpenCode, an interactive CLI tool..."
    *   **Key Sections:** Memory (`OpenCode.md`), Tone (concise, < 4 lines), Proactiveness (only when asked), Code Style (no comments unless asked), Tool Usage Policy (prefer `agent` tool for search).
*   **Tools:**
    *   `ls(path, recursive)`: List files.
    *   `grep(pattern, path, include, literal_text)`: Search text.
    *   `read(file_path)`: Read full file.
    *   `view(file_path, offset, limit)`: Read partial file (for large files).
    *   `edit(file_path, ...)`: Edit file.
    *   `patch(file_path, diff)`: Apply diff.
    *   `diagnostics(file_path)`: Check for errors.
    *   `bash(command, timeout)`: Run shell commands.
    *   `fetch(url, format)`: Fetch web content.
    *   `agent(prompt)`: Spawn a sub-agent.
*   **Context Management:**
    *   **Memory:** Checks for `OpenCode.md` in the working directory for project-specific context, commands, and style preferences.
    *   **Auto-Compact:** Automatically summarizes conversation when it reaches 95% of the model's context window to prevent overflow.
*   **Permissions:**
    *   Interactive TUI dialog: `Allow`, `Allow for session`, `Deny`.
    *   Non-interactive mode (`--yes`) auto-approves all permissions.

## 2. Gemini CLI (Google)
*   **Source:** `github.com/google-gemini/gemini-cli`
*   **System Prompt:**
    *   Not publicly documented, but behavior is heavily influenced by the user-provided `context.md`.
*   **Tools:**
    *   `SearchText`: Grounding with Google Search.
    *   File system operations (read/write).
    *   Shell commands.
    *   Web fetch.
*   **Context Management:**
    *   **Context File:** Uses `context.md` for persistent project context (similar to OpenCode's `OpenCode.md`).
    *   **Token Caching:** Optimizes context usage.
    *   **Checkpointing:** Saves and resumes complex sessions.
*   **Permissions:**
    *   **Trusted Folders:** Controls execution policies based on directory trust.

## 3. Aider (Claude Code Proxy)
*   **Source:** `github.com/paul-gauthier/aider`
*   **System Prompt:**
    *   Not publicly documented.
*   **Tools:**
    *   Git integration (auto-commits with sensible messages).
    *   Linting & Testing (run tests, fix errors).
    *   File editing (diff/patch based).
*   **Context Management:**
    *   **Repo Map:** Creates a compact AST-based map of the entire codebase to understand structure without reading every file. This is a key differentiator.
*   **Permissions:**
    *   **High Autonomy:** Designed to auto-commit changes.
    *   User typically approves the "plan" or the final state, but the agent is more autonomous in the edit-test-commit loop.

## 4. GitHub Copilot CLI
*   **Source:** `gh copilot` (GitHub CLI extension)
*   **System Prompt:**
    *   Proprietary and closed source.
*   **Tools:**
    *   `suggest`: Propose a command for a task.
    *   `explain`: Explain a command.
*   **Context Management:**
    *   Short-term context based on the current shell session or specific query.
*   **Permissions:**
    *   **User Execution:** The CLI suggests commands, but the user must explicitly run them (copy-paste or `Execute command?` prompt).

## 5. Amp (AmpCode / Sourcegraph)
*   **Source:** `ampcode.com` (Closed Source / NPM `@sourcegraph/amp`)
*   **System Prompt:**
    *   **Modes:** `smart` (Opus 4.5), `rush` (faster), `free`.
    *   **Context:** Heavily relies on `AGENTS.md` (recursive, supports `@mentions` and globs).
*   **Tools:**
    *   **Toolboxes:** Simple scripts (bash/node) that expose tools via stdout description.
    *   **Oracle:** A "second opinion" tool using a stronger model (GPT-5) for reasoning.
    *   **Librarian:** Cross-repo search tool.
    *   **MCP:** Full support for local/remote MCP servers with OAuth.
*   **Context Management:**
    *   **Handoff:** Explicit `handoff` command to start a new thread with relevant context (no compaction).
    *   **Thread Sharing:** Web-based thread viewer (`ampcode.com/threads`).
*   **Permissions:**
    *   **Granular:** `allow`, `ask`, `reject`, `delegate` (to external script).
    *   **Scope:** Can scope permissions to specific tools or arguments (e.g., allow `git status`, ask `git push`).

## 6. Other Key Competitors (CLI Ecosystem)
As part of the "Swiss Army Knife" strategy, we track and integrate the following CLIs:

*   **Gemini CLI:** `google-gemini/gemini-cli` - Official Google integration.
*   **Aider:** `paul-gauthier/aider` - The gold standard for AI pair programming (Repo Map).
*   **Mentat:** `AbanteAI/mentat` - Strong context management and coordinate-based editing.
*   **Fabric:** `danielmiessler/fabric` - "Wisdom" extraction and life patterns.
*   **Goose:** `block/goose` - Autonomous developer agent.
*   **KiloCode:** `Kilo-Org/kilocode` - "Memory Bank" architecture for persistent state.

## 7. Synthesis & Recommendations for borg
1.  **Universal Context File:** Implement support for `borg.md`, but also auto-detect and respect `OpenCode.md`, `context.md`, and `AGENTS.md`.
2.  **Repo Map:** Implement Aider's "Repo Map" strategy (AST-based summarization) as a core feature of the Hub's `search_tools` or a dedicated `repo_map` tool.
3.  **Tool Parity:** Ensure we have equivalents for `view` (partial read), `patch` (diff application), and `agent` (sub-agent spawning).
4.  **Permission Model:** Adopt Amp's granular permission model (Regex matching on args) + OpenCode's session-based approval.
5.  **"Oracle" Pattern:** Implement an `oracle` tool that delegates to a "Thinking" model (o1/r1) for complex queries.
6.  **"Toolbox" Pattern:** Allow users to drop simple scripts into a `.toolbox` folder to auto-register them as tools.
