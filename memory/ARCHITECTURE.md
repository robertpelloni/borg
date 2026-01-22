# Memory Systems Architecture

**Status:** Draft
**Version:** 0.1.0

## Overview
Borg employs a "Memory Router" architecture that allows swapping, chaining, and parallel usage of multiple memory backends. This ensures no vendor lock-in and allows the best tool for the specific task (e.g., Vector DB for semantic search, Graph for relationships).

## Architecture Layers

### 1. The Interface Layer (MCP)
All memory systems are exposed via the Model Context Protocol (MCP).
- **Core Tools:** `create_memory`, `search_memory`, `delete_memory`, `update_memory`
- **Routing:** The `MemoryManager` in `packages/core` routes these MCP calls to the active provider(s).

### 2. The Provider Layer
Adapters for specific backends.
- **Local:** SQLite (Basic), JSON File
- **Vector:** Chroma, Qdrant, Pgvector
- **Graph:** Neo4j, FalkorDB
- **Managed:** Mem0, Zep, Letta

### 3. The Interchange Format
A standardized JSON schema for memory fragments to ensure portability.
```json
{
  "id": "uuid",
  "content": "text content",
  "embedding": [0.1, ...],
  "metadata": {
    "source": "user_chat",
    "timestamp": "iso8601",
    "tags": ["coding", "react"]
  },
  "relations": ["id_of_related_memory"]
}
```

## Integration Strategy

### Submodule Integration
We maintain submodules in `memory/systems/*` to:
1. **Reference:** Study implementation details.
2. **Direct Usage:** Mount them as local MCP servers.
3. **Development:** Contribute patches upstream.

### Active Integrations
- **Supermemory:** Used for broad web/doc context.
- **Mem0:** Used for user profile and preferences.
- **Local SQLite:** Used for immediate session context and scratchpad.

## Configuration
Memory routing is configured in `.borg/config.json`:

```json
{
  "memory": {
    "primary": "mem0",
    "fallback": "local-sqlite",
    "sync": ["chroma"],
    "read_only": ["supermemory"]
  }
}
```

## Future Roadmap
- [ ] **Unified Memory Index:** A single background job that syncs data across all configured providers.
- [ ] **Semantic Context pruning:** Auto-archive old memories from "Hot" (Context Window) to "Cold" (Vector Store).
- [ ] **Memory Browser:** A React-based visualizer for the memory graph (in Dashboard).
