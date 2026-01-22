# Memory System Documentation

## Overview
The Memory System provides persistence and context management for AI agents within borg. It enables storing, retrieving, and snapshotting interaction data to maintain continuity across sessions.

## Components

### 1. Memory Orchestrator (Backend)
Located in `packages/core/src/memory/`, this module manages:
- **Providers:** Pluggable storage backends (File System, Vector DBs, etc.).
- **Ingestion:** Storing new information with tags.
- **Retrieval:** Semantic search and filtering of memories.
- **Snapshots:** Creating and restoring full context states.

### 2. UI Interface (Frontend)
Located at `/memory` in the UI, providing:
- **Dashboard:** Overview of connected providers and memory stats.
- **Ingest Tool:** Form to manually add new memories with tags.
- **Explorer:** Search interface to browse stored memories.
- **Snapshot Manager:** List, view, and restore context snapshots.

## Usage

### Ingesting Memory
Memories can be added via the UI or API:
```typescript
// API Endpoint: POST /api/memory/remember
{
  "content": "User prefers concise answers.",
  "tags": ["preferences", "user-profile"]
}
```

### Searching
Retrieve relevant context:
```typescript
// API Endpoint: GET /api/memory/search?query=preferences
```

### Snapshots
Snapshots capture the entire state of an agent's context.
- **List:** `GET /api/memory/snapshots`
- **Restore:** `POST /api/memory/snapshots/restore` (payload: `{ "filename": "session_123.json" }`)

## Architecture
- **Storage:** JSON-based local file storage (default) in `packages/core/data/memory`.
- **Snapshots:** Stored in `packages/core/data/snapshots`.
- **Integration:** The `ContextManager` in `packages/core` utilizes the Memory System to hydrate agent prompts.

## Future Improvements
- Vector Database integration (Pinecone/Weaviate).
- Automatic background snapshotting.
- Memory decay and relevance scoring.
