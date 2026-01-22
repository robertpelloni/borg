# Memory Strategy: MCP, Handoff, and Persistence

This document details the multi-layered memory architecture for the borg. The goal is to move beyond simple "context packing" (stuffing everything into the prompt) to a smart "Handoff & Resume" system.

## 1. Core Architecture: MCP-First
The primary interface for memory is the **Model Context Protocol (MCP)**.
- **Why:** Allows any tool (Claude, Gemini, IDE) to access memory via a standard `read_resource` or `call_tool` interface.
- **Implementation:** `submodules/claude-mem` serves as the core MCP server.

## 2. Session Handoff & Resume
Instead of losing context when a CLI session ends, we implement a "Handoff" system.
- **Reference:** [`vibeship-mind`](https://github.com/vibeforge1111/vibeship-mind) (File-based), [`beads`](https://github.com/steveyegge/beads) (Graph-based).
- **Mechanism:**
    1.  **Snapshot:** At session end, the Hub serializes the relevant context (variables, active files, recent thoughts) into a structured file (`.context/session_latest.json`).
    2.  **Storage:** These files are stored locally, mimicking a "Save Game" feature.
    3.  **Resume:** When starting a new session, the Hub checks for a previous snapshot and "injects" it back into the context, allowing the user to pick up exactly where they left off.

## 3. Semantic Search & Knowledge Graph
- **Reference:** [`txtai`](https://github.com/neuml/txtai)
- **Goal:** Efficiently retrieve long-term knowledge that doesn't fit in the active context window.
- **Integration:** Use `txtai` (or `pgvector` via `claude-mem`) to index:
    - Documentation
    - Past Code Reviews
    - Resolved Issues
- **Workflow:** Before answering, the Agent queries this semantic layer: "Have I solved a similar bug before?"

## 4. Context Composition & Mining
Inspired by ChatGPT's context layering and "Context Mining".

### Context Layers
The Hub injects context in a specific order:
1.  **System Instructions:** Core behavior + Safety.
2.  **Developer Instructions:** Platform-specific constraints (`CLAUDE.md`).
3.  **Session Metadata:** Ephemeral stats (tools used, current directory, git status).
4.  **User Memory:** Persistent facts (Preferences, Goals).
5.  **Conversation Summaries:** Condensed history of past sessions.
6.  **Current Session:** Active sliding window.

### Context Mining (The "Audit")
Before closing a session, the Hub automatically triggers an "Analyst Mode":
> "Analyze the meta-data of this conversation. Find the abandoned threads. Find the unstated connections between inputs."
> The result is saved to the Knowledge Graph (`txtai`) for future retrieval.

## 5. Memory System Evaluation & Recommendation
We evaluated 20+ memory systems (e.g., `cognee`, `langmem`, `mem0`).

### Top Contenders
*   **[Mem0](https://github.com/mem0ai/mem0):** Best for "User Memory" (Profile/Preferences).
*   **[Letta](https://github.com/letta-ai/letta):** Strong "Stateful" memory for agents (LLM OS concept).
*   **[Cognee](https://github.com/topoteretes/cognee):** Graph-based memory for deeper relationships.

### Recommendation
**The "Game Engine" Approach (Abstraction over Selection):**
Instead of picking one winner, we define a `MemoryProvider` interface.
*   **Default:** `claude-mem` (Simple, vector-based, integrated).
*   **Plugins:**
    *   `mem0` adapter for User Profiles.
    *   `letta` adapter for Stateful Agents.
    *   `cognee` adapter for Knowledge Graphs.
*   **User Choice:** The user can configure which memory backend to use for which purpose in `borg.config.json`.

## 6. Implementation Plan
1.  **File System Layer:** Implement a `ContextManager` in `packages/core` that watches the `.context/` directory (inspired by `beads`).
2.  **Vector Layer:** Ensure `claude-mem` is running and indexing tool outputs.
3.  **Handoff Hook:** Add a `SessionEnd` hook that triggers the snapshot routine.
