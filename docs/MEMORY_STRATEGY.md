# Memory Strategy: MCP, Handoff, and Persistence

This document details the multi-layered memory architecture for the Super AI Plugin. The goal is to move beyond simple "context packing" (stuffing everything into the prompt) to a smart "Handoff & Resume" system.

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

## 4. Implementation Plan
1.  **File System Layer:** Implement a `ContextManager` in `packages/core` that watches the `.context/` directory (inspired by `beads`).
2.  **Vector Layer:** Ensure `claude-mem` is running and indexing tool outputs.
3.  **Handoff Hook:** Add a `SessionEnd` hook that triggers the snapshot routine.
