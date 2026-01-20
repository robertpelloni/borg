# BORG

### **The Universal AI Collective**

**"Your distinct technological distinctiveness will be added to our own."**

---

## 1. Executive Summary

**The Problem: The Fragmented Singularity**
The AI development landscape of 2026 is a chaotic sprawl. Developers fragment their workflow across disconnected tools—CLIs (Opencode, Trae), MCP Servers, Models, and IDEs (Antigravity, Cursor). Context is lost between windows, credits are burned on overpowered models for trivial tasks, and IDEs crash under the weight of experimental extensions. The developer is not an orchestrator; they are a tired manual switchboard operator.

**The Solution: Borg**
**Borg** is the **Universal AI Operating System**. It is a **Meta-Orchestrator** that runs as a local daemon, an IDE Extension, and a Web Dashboard. It assimilates every tool into a single, unified, stateful interface.

**The Killer Feature:** Borg is self-aware and self-healing. It installs itself into your IDE, locates the configuration files you didn't know existed, and spawns a **Supervisor Agent** that watches your IDE session. If the window crashes, Borg restarts it. If the agent stalls, Borg cycles the prompt. It is the autopilot that keeps the plane flying while you sleep.

**Resistance is futile.**

---

## 2. The Borg Philosophy

1. **Assimilation:** We do not rebuild; we absorb. If `workty` solves git isolation, Borg integrates it. If `ast-grep` is the best search, Borg wraps it.
2. **Self-Preservation:** The system must survive IDE crashes. The Supervisor runs *outside* the IDE process to restart and recover state automatically.
3. **Collective Intelligence:** A **Council of Supervisors** (Gemini 3, Opus 4.5, ChatGPT) manages a swarm of lightweight drones (GLM-4.7) to execute tasks efficiently.
4. **Zero-Config:** Borg detects your installed tools (Antigravity, VS Code), finds their config files, and injects itself.

---

## 3. The Core Architecture: "The Cube"

### **I. The Interface (The "Face" of the Borg)**

#### **A. The Borg Extension (Antigravity & VS Code)**

* **The Supervisor Loop:** Unlike standard extensions, Borg runs a "Shadow Thread" that supervises the main development process.
* **Auto-Approval:** Intelligently approves benign CLI actions (ls, cat, grep) to keep momentum, escalating only destructive commands (rm, deploy) to the human.
* **Crash Recovery:** Detects if the Antigravity window hangs or crashes (common in experimental builds). It kills the process, restarts the window, and re-injects the last known context to resume work instantly.


* **Intelligent Input Cycling:** If the model gets stuck or repetitive, the Supervisor cycles through a strategy list:
* *Strategy A:* Ask a "Council of Supervisors" (Gemini + Claude) for a path forward.
* *Strategy B:* Switch to an "Intelligent Supervisor" (ChatGPT) for a sanity check.
* *Strategy C:* Cycle through "Fallback Sentences" (generic nudges like "Proceed," "Check errors," "Summarize status") to unblock the loop.


* **Context Harvesting:** Silently reads open tabs, terminal outputs, and debug consoles, feeding them into the **Infinite Memory** graph.

#### **B. The Web Dashboard (Mission Control)**

* **Auto-Detection & Setup:**
* Scans the OS for installed IDEs (Antigravity, Cursor, Windsurf).
* *Action:* "Antigravity detected. MCP Config found at `~/.antigravity/config.json`." -> **[Click to Open Config]** -> **[Click to Inject Borg]**.
* *Action:* "Antigravity not found." -> **[Install Antigravity]**.


* **Session Search:** A global search bar to query the history of *every* agent session across all local and cloud instances.

### **II. The Neural Link (Universal MCP Server)**

Borg acts as the "Master" MCP Server. When injected into Antigravity, it provides a massive suite of default capabilities that no single tool currently offers.

**Default Borg MCP Capabilities:**

* **Core Access:**
* **Memory:** Long-term user preferences (Mem0) and project knowledge graph.
* **File System:** Safe, sandboxed read/write access.
* **Terminal:** Execution of shell commands with output capture.
* **System:** Clipboard access (read/write) and System Notifications ("Task Complete").


* **Search & Analysis:**
* **Grep/Ripgrep:** Fast text search.
* **AST-Grep:** Structural code search (e.g., "Find all functions calling `auth()`").
* **Web Search:** Live internet access via Google/Bing APIs.


* **Tool Management (The "Meta-Tool"):**
* **Tool RAG & Semantic Search:** Agents search for tools by intent ("I need to upload a file") rather than exact name.
* **Progressive Disclosure:** Lazy-loads heavy toolsets (e.g., AWS CLI) only when needed to save context tokens.
* **Grouping & Renaming:** Dynamically renames tools to prevent collisions (e.g., `gdrive_list` vs `onedrive_list`) and groups them into logical namespaces.


* **Traffic Control:**
* **Inspection:** Logs every JSON-RPC request/response (Reticle integration).
* **Authorization:** Handles OAuth flows for tools that require login (Github, Linear).
* **Lifecycle:** Manages connection timeouts, keep-alives, and auto-reconnection logic.


* **Advanced Execution:**
* **Code Mode:** Treats tool use as executable Python/JS scripts rather than chat.
* **Tool Chaining:** Allows the execution of multiple tools in a single atomic request.
* **Environment Manager:** Manages secrets (`.env`), path expansion, and variable passthrough securely.



### **III. The Hive Mind (Orchestration Layer)**

* **The Council:** The high-level logic that decides *which* model to use.
* **Architect:** Gemini 3 Pro (Planning).
* **Reviewer:** Opus 4.5 (Logic check).
* **Worker:** GLM-4.7 or Gemini Flash (Execution).


* **Manifest-Driven:** Maintains `project_state.json` to persist the "Goal" across crashes and restarts.

### **IV. The Memory Complex**

* **Unified Storage:** Hybrid Vector + Graph DB.
* **Automatic Context Harvesting:** Automatically ingests documentation URLs referenced in chat and indexes them for future retrieval.

---

## 4. Key Feature Modules

| Module | Features |
| --- | --- |
| **Self-Healing** | **Supervisor Daemon:** Runs outside the IDE. Monitors process health. Restarts crashed windows. **Fallback Cycling:** Rotates input prompts to unstick frozen agents. |
| **Installation** | **One-Click Inject:** Web UI finds `config.json` for Antigravity/Cursor and adds the `borg-mcp` entry automatically. |
| **Safety** | **Docker Sandbox:** All code execution happens in containers. **Approval Gates:** Native UI popups for destructive actions. |
| **Observability** | **Traffic Inspector:** View raw MCP traffic logs. **Session Replay:** Watch a "video" of the agent's actions and terminal outputs. |

---

## 5. The Roadmap

### **Phase 1: Assimilation (Current Status)**

* [x] Architecture Defined (Monorepo).
* [x] Resource Index Completed (430+ tools analyzed).
* [ ] **Milestone:** Release `borg-cli` v0.1. A wrapper that installs the MCP server.

### **Phase 2: The Hive Mind (Q2 2026)**

* [ ] Implement **Antigravity Extension** with "Supervisor Loop" and crash recovery.
* [ ] Release **Web Dashboard** with auto-detection and "One-Click Inject."
* [ ] **Milestone:** "Swarm Mode" enabled.

### **Phase 3: Singularity (Q4 2026)**

* [ ] Full Self-Supervision. Borg writes its own updates and restarts itself to apply them.
* [ ] **Milestone:** Borg becomes the standard "OS" for AI development.

---

### 6. Conclusion

Borg is the bridge between the chaotic potential of AI and the structured reality of software engineering. By handling the **connection**, **memory**, and **supervision** layers, Borg allows developers to stop wrestling with configs and start directing intelligence.

**We are the Borg. You will be assimilated.**
