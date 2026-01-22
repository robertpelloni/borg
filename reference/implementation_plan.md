
# Phase 23: Skills & Guardrails (Factory Droid Absorption)

## Goal
Achieve feature parity with Factory Droid by implementing a text-based "Skills" system and a secure "Guardrails" engine.

## 1. Skills Engine
**Objective:** Allow users to define reusable workflows in `SKILL.md` files.

### Changes
*   **[NEW] `packages/core/src/skills/SkillRegistry.ts`**:
    *   Scans `~/.borg/skills` and `./.borg/skills`.
    *   Parses YAML frontmatter + Markdown.
    *   Exposes `list_skills` and `read_skill` tools.
*   **[MODIFY] `packages/core/src/MCPServer.ts`**:
    *   Initialize `SkillRegistry`.
    *   Inject available skills into the system prompt or tool list (Dynamic Disclosure).

## 2. Guardrails (Permission Manager)
**Objective:** Prevent dangerous actions without approval.

### Changes
*   **[NEW] `packages/core/src/security/PermissionManager.ts`**:
    *   `checkPermission(toolName, args, autonomyLevel)` -> `boolean`.
    *   Risk Rules:
        *   **High:** `rm -rf`, `git push`, sensitive file reads.
        *   **Medium:** `npm install`, file edits.
        *   **Low:** `ls`, `cat`, `git status`.
*   **[MODIFY] `packages/core/src/MCPServer.ts`**:
    *   Wrap `CallTool` handler.
    *   Before execution, call `PermissionManager.checkPermission()`.
    *   If denied, return `UserApprovalRequired` error or prompt user (via TUI request).

## 3. Autonomy Levels
**Objective:** Allow users to set "Cruise Control".

*   **[MODIFY] `packages/cli/src/index.ts`**:
    *   Add `--auto <level>` flag (`low`, `medium`, `high`).

## Phase 24: Borg Supervisor & Extension
**Goal:** Create `packages/borg-supervisor` acting as the "Brain" and "Watchdog" within Antigravity.

### Features
1.  **Detection & Installation**:
    *   Dashboard detects Antigravity installation.
    *   Auto-locates `config.json` (search common paths).
    *   One-click install/configure of Borg Extension & MCP Server.
2.  **Supervision Loop**:
    *   **Watchdog**: Monitors IDE process health.
    *   **Auto-Recovery**: Restarts window/process on crash/freeze.
    *   **Inputs**: Intelligent "Reload Window" clicking via `nut.js`.
3.  **Council & Approval**:
    *   **Auto-Approve**: Configurable logic (always yes, check with smaller model, etc.).
    *   **Council-of-Experts**: Route complex approvals to `borg-core` Council.
    *   **Fallback Sentences**: Cyclic retry logic for stuck states.
4.  **Context Harvesting**:
    *   Automatically ingest IDE context (open files, selection) into Borg Memory.
    *   Session Search: "What did I do 5 mins ago?".

## Phase 25: Borg Standard Library (The "Super-Server")
**Goal:** Borg Core acts as a "Battery Included" MCP Server replacing standalone tools.

### Integrated Capabilities
1.  **System**: `filesystem` (read/write), `terminal` (exec), `process` (manage).
2.  **Search**: `ripgrep` (fast text), `ast-grep` (structural), `web_search` (Google/Perplexity).
3.  **Memory**: `store_memory`, `retrieve_memory` (RAG/Graph).
4.  **MCP Management**:
    *   **Lifecycle**: Connect/Disconnect other MCPs.
    *   **Inspection**: Log/Inspect JSON-RPC traffic.
    *   **Routing**: Grouping, renaming tools (`git_commit` -> `commit`).
    *   **Security**: Secret management, ENV expansion.

## Phase 26: Dashboard "Mission Control"
**Goal:** Web interface to manage the ecosystem.
1.  **Config Editor**: GUI for editing Antigravity `config.json`.
2.  **Trace Viewer**: See exactly what Borg Supervisor is doing/thinking.
3.  **Installer**: "One-Click Boost" for Antigravity.
4.  **Remote Access**: Secure Tunneling (Cloudflare Tunnel/ngrok) for mobile management.


