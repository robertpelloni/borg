# Project Structure

## **Core Philosophy: "borg as the Central Router"**

borg (Artificial Intelligence Operating System) acts as the central nervous system for your development workflow. It is not just a collection of tools, but a **Hub** that routes intelligence, commands, and context between two primary domains:

1.  **Remote (Cloud/Jules App):** Managed via the `Jules App` submodule. This handles persistent, cloud-based sessions, long-running tasks, and collaborative features.
2.  **Local (Autopilot Council):** Managed via the `opencode-autopilot-council` submodule. This handles local repository interactions, transient sessions, and direct file system manipulations on your machine.

**The "Hub" connects these worlds.** It provides a unified SDK, a shared plugin system, and a central Dashboard to monitor and control both local and remote agents.

---

## Directory Breakdown

### `agents/`
Defines the AI agents available to the system.
*   **Standards:** All agents must adhere to the schema defined in `packages/core/src/types/Agent.ts`.
*   **Format:** JSON or YAML files defining capabilities, instructions, and tools.

### `docs/`
The single source of truth for all documentation.
*   **`LLM_INSTRUCTIONS.md`:** The master instruction file for all LLMs contributing to this project. All other `*.md` instruction files (e.g., `CLAUDE.md`, `GPT.md`) simply reference this file.
*   **`SUBMODULES.md`:** Tracks all registered submodules and external repositories.

### `external/`
Contains external repositories and plugins that are **not** core submodules but are integrated into the ecosystem.
*   **Plugins:** `opencode-skills`, `opencode-gemini-auth`, etc.
*   **Tools:** External MCP servers and utilities.

### `packages/`
The monorepo's internal packages.
*   **`ui/`:** The Next.js-based Dashboard. This is the "Face" of borg.
    *   **Tabs:**
        *   **Sessions:** View and manage active Jules (Remote) sessions.
        *   **Analytics:** System performance and usage stats.
        *   **Council (NEW):** View and manage local Autopilot sessions.
*   **`core/`:** Shared types, utilities, and the base SDK logic.
*   **`cli/`:** The command-line interface for interacting with borg directly.

### `submodules/`
Core components that are developed as separate repositories but are essential to borg.
*   **`jules-app/`:** The Remote Session Manager.
*   **`opencode-autopilot-council/`:** The Local Session Manager. Handles "Transient" sessions that exist only while you are working on a specific local repository.
*   **`mcp-shark/`:** MCP Server management.

---

## **Key Architecture Concepts**

### **1. The Council (Local)**
*   **Role:** Manages "Local Sessions."
*   **Behavior:**
    *   Treats OpenCode instances as **Transient**. A session exists while the CLI or IDE is active.
    *   Maintains a list of "Potential Sessions" (recently visited repositories).
    *   Executes commands directly on the host machine.

### **2. Jules (Remote)**
*   **Role:** Manages "Remote Sessions."
*   **Behavior:**
    *   Sessions are **Persistent**. History is stored in the cloud/database.
    *   Ideal for long-running research, collaborative coding, or tasks requiring off-site compute.

### **3. Interconnectivity**
*   **SDK:** Both Local and Remote environments share the `opencode-sdk`.
*   **Plugins:** Skills and MCPs can be "mounted" to either Local or Remote sessions depending on the configuration.
