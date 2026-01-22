# Universal Memory Strategy: The "Memory Orchestrator"

This document outlines the expanded strategy for a **Universal Memory System** in borg. The goal is to create a unified interface that can orchestrate multiple memory backends (local, cloud, browser) and synchronize data between them.

## 1. Vision: The "Memory Orchestrator"
Instead of building a single monolithic memory store, borg will act as a **Memory Orchestrator**. It will:
1.  **Detect** existing memory systems (Pinecone, Chroma, Mem0, Browser Storage).
2.  **Abstract** them behind a common `MemoryProvider` interface.
3.  **Ingest** context from external sources (Jules, VS Code, Browser).
4.  **Compact** raw streams into structured insights (Facts, Decisions, Action Items).
5.  **Visualize** memory state via a unified Dashboard.

## 2. Architecture

### A. The `MemoryManager` (Orchestrator)
The core `MemoryManager` in `packages/core` manages:
- **Providers**: Storage backends (File, Mem0, etc.).
- **Ingestors**: Data sources (Jules, Agent Messages).
- **Compactor**: LLM-based extraction of insights.

```typescript
interface MemoryProvider {
    id: string;
    name: string;
    type: 'vector' | 'graph' | 'key-value' | 'file';
    capabilities: ('read' | 'write' | 'search' | 'delete')[];
    
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    
    insert(item: MemoryItem): Promise<string>;
    search(query: string, limit?: number): Promise<MemoryResult[]>;
    delete(id: string): Promise<void>;
}
```

### B. The "Context Compactor"
A specialized module that processes raw text streams (logs, chat transcripts) and extracts:
- **Facts**: Permanent truths established in conversation.
- **Decisions**: Choices made by agents or users.
- **Action Items**: Tasks that need to be tracked.

### C. Ingestors
- **AgentMessageBroker Hook**: Automatically captures all inter-agent communication.
- **JulesIngestor**: Syncs sessions and activities from the Jules platform.
- **Tool Hook**: Captures tool inputs and outputs.

## 3. Features

### A. Auto-Detection & Ingestion
The system will scan for:
- **Providers**: Docker containers (`chroma`), Env vars (`MEM0_API_KEY`).
- **Sources**: `Jules` API keys (`JULES_API_KEY`).

### B. The "Memory Dashboard" (`packages/ui`)
A new page `/memory` allows users to:
- **View Providers:** See status of connected systems.
- **Visualize Insights:** Filter by "Facts", "Decisions", "Action Items".
- **Search:** Semantic search across all providers.

### C. Context & Session Management
- **Auto-Save:** Hooks to save context snapshots.
- **Auto-Load:** Hooks to load relevant context.
- **Sync:** "Sync Jules Sessions" tool to pull external context.

## 4. Implementation Roadmap

### Phase 1: Architecture Refactor (Completed)
- [x] Define `MemoryProvider` interface.
- [x] Refactor `MemoryManager` to support multiple providers.
- [x] Implement `FileMemoryProvider` and `Mem0Provider`.

### Phase 2: Context Compaction (Completed)
- [x] Implement `ContextCompactor`.
- [x] Add hooks to `AgentMessageBroker`.
- [x] Add hooks to `ToolManager`.

### Phase 3: External Ingestion (Completed)
- [x] Implement `JulesIngestor`.
- [x] Expose `sync_jules_sessions` tool.

### Phase 4: Visualization (Completed)
- [x] Create `/memory` dashboard.
- [x] Add filtering and icons for memory types.

### Phase 5: Git-Based Memory Sync (New)
- [x] Implement `exportMemory` and `importMemory` in `MemoryManager`.
- [x] Expose `export_memory` tool to dump memory to JSON.
- [ ] Create a workflow to auto-commit memory dumps to the repo.

### Phase 6: Browser Integration (In Progress)
- [x] Expose `ingest_browser_page` tool to capture active tab content.
- [ ] Expose `BrowserStorageProvider` via the Extension Bridge.
- [ ] Allow importing browser history/bookmarks.

## 5. Coexistence Strategy
We do not replace existing tools; we **wrap** them.
- If a user uses `mem0` for their personal agent, we connect to it.
- If a user has a `chroma` instance for their RAG pipeline, we index it.
- If a user has no memory system, we default to our local JSON/SQLite store.

## 6. Memory Transfer Protocol
To enable cloud agents (like Jules) to access local memory, we use a **Git-Based Sync**:
1.  **Export**: Local agents run `export_memory` to dump all facts/decisions to `.borg/memory_export.json`.
2.  **Commit**: This file is committed to the repository.
3.  **Ingest**: Cloud agents read this file from the repo to "hydrate" their context.

