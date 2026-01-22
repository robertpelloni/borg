# Borg Architecture Blueprint

**Version:** 0.1.0-draft
**Status:** Planning
**Mission:** Universal AI Tool Dashboard & Ultimate CLI Harness

## 1. Core Philosophy & Design Pattern
The system follows the **"Director + Swarm"** architecture:
*   **The Director (Supervisor):** A premium "Frontier Model" (e.g., Claude 3.5 Sonnet, Gemini 1.5 Pro) running on the **Dashboard/WebUI**. It plans high-level objectives, manages budget, and oversees the swarm.
*   **The Swarm (Workers):** Multiple concurrent CLI sessions (`subagent_worker`) running cheaper/faster models (e.g., GLM-4.7, Haiku) or specialized tools.
*   **The Glue (Orchestrator):** A local `node.js` service that manages these sessions, streams their output to the UI, and handles resource contention.

## 2. Tech Stack Setup (Monorepo)
We will use a **Turborepo** structure for maximum modularity and build speed.

```
/borg
  /apps
    /web             # "Mission Control" Dashboard (Next.js 14, React, Tailwind)
    /extension       # Browser Extension (Plasmo or standard WebExt)
  /packages
    /core            # The Orchestrator Logic (Node.js, MCP Host)
    /ui              # Shared UI Component Library (ShadCN)
    /cli             # The "Ultimate Harness" CLI entry point (Node/Ink)
    /mcp-client      # Universal MCP Client Logic
  /submodules        # All indexed external tools (MetaMCP, OpenHands, etc.)
  /tools             # Scripts and utilities
```

## 3. Key Components & Implementation Strategy

### A. The Universal MCP Server ("MetaMCP" Integration)
*Strategy: Absorb MetaMCP functionality into `packages/core`.*
*   **Router:** Proxies requests to sub-MCPs (`filesystem`, `github`, `gdrive`).
*   **Tool RAG:** Implement `pgvector` (or local file-based vector search like LanceDB from `Continue`) to index tool descriptions for semantic discovery.
*   **Progressive Disclosure:** Expose only `search_tools` initially.

### B. The Ultimate CLI Harness ("Claudish" + "Maestro")
*Strategy: Wrap `Claudish` and `Maestro` logic into `packages/cli`.*
*   **Session Management:** `packages/core` spawns CLI processes (PTYs).
*   **Multi-Provider:** Use `Claudish` pattern to route to OpenRouter/Anthropic/Gemini.
*   **Output Streaming:** Stream stdout/stderr from PTYs to `apps/web` via WebSockets (tRPC subscription).

### C. Infinite Memory ("Letta" + "Beads" Integration)
*Strategy: Layered Memory Access.*
*   **Short-term:** In-context RAM (managed by `packages/core`).
*   **Medium-term:** `Beads` pattern (Git-backed JSONL tasks in `.beads/`).
*   **Long-term:** Vector DB (LanceDB) for "Archival Memory" (Code snippets, Docs).

### D. Code Indexing ("Cursor" Shadow Workspace)
*Strategy: Background Indexer Service.*
*   **Shadow Workspace:** A headless process (possibly `code-server` or `Monaco` headless) that maintains an AST of the current project.
*   **Indexing:** Background job chunking files -> Embeddings -> LanceDB.

## 4. Quota Management & Routing (`AgentRouter`)
*   **ModelSelector:** A utility in `packages/core` that checks local usage stats.
*   **Logic:**
    ```typescript
    if (user.isPremium() && credits > 0) return Models.GEMINI_PRO;
    if (task.complexity == 'low') return Models.GLM_4_FLASH;
    return Models.GEMINI_FLASH; // Default fallsafe
    ```

## 5. Immediate Implementation Plan (Scaffold Phase)
1.  **Init Monorepo:** `npx create-turbo@latest`.
2.  **Scaffold `apps/web`:** Next.js + Shadcn UI.
3.  **Scaffold `packages/core`:** Node.js + MCP SDK.
4.  **Prototype `ModelSelector`:** Basic hardcoded logic, then expanded.
