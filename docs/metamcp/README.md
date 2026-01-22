# MetaMCP Integration Guide

> **MetaMCP**: MCP Aggregator, Orchestrator, Middleware, and Gateway integrated into Borg

## Overview

MetaMCP functionality has been migrated into Borg Core (Phase 10), providing a unified MCP proxy that dynamically aggregates MCP servers into a single unified endpoint with middleware support. This enables:

- **Progressive Tool Disclosure**: Minimize context window usage by exposing only meta-tools
- **Semantic Tool Search**: "Tool RAG" using embeddings for intelligent tool discovery
- **Code Mode**: Execute TypeScript/JavaScript in a secure sandbox with tool access
- **Autonomous Agents**: Natural language task execution via `run_agent`
- **Traffic Inspection**: Persistent logging of all tool calls ("Mcpshark")
- **Policy Enforcement**: Access control with glob patterns and rate limiting

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           Borg Core Engine               │
                    │  ┌─────────────────────────────────────┐ │
                    │  │         McpManager                  │ │
                    │  │  ┌───────────┐  ┌───────────────┐  │ │
  MCP Client ──────►│  │  │ Namespace │  │   Endpoint    │  │ │
  (Claude, VSCode)  │  │  │  Manager  │  │   Manager     │  │ │
                    │  │  └─────┬─────┘  └───────┬───────┘  │ │
                    │  │        │                │          │ │
                    │  │        ▼                ▼          │ │
                    │  │  ┌─────────────────────────────┐   │ │
                    │  │  │     Middleware Pipeline     │   │ │
                    │  │  │  Logging → Policy → Filter  │   │ │
                    │  │  └─────────────┬───────────────┘   │ │
                    │  │                │                   │ │
                    │  │                ▼                   │ │
                    │  │  ┌─────────────────────────────┐   │ │
                    │  │  │    Multi-Transport Layer    │   │ │
                    │  │  │  STDIO │ SSE │ StreamableHTTP│  │ │
                    │  │  └─────────────────────────────┘   │ │
                    │  └─────────────────────────────────────┘ │
                    │                    │                     │
                    │                    ▼                     │
                    │  ┌─────────────────────────────────────┐ │
                    │  │         SQLite Database             │ │
                    │  │  Servers│Tools│Policies│Logs│Scripts│ │
                    │  └─────────────────────────────────────┘ │
                    └─────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │          MCP Server Farm                 │
                    │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐   │
                    │  │ Git │ │Slack│ │ DB  │ │Filesystem│   │
                    │  └─────┘ └─────┘ └─────┘ └─────────┘   │
                    └─────────────────────────────────────────┘
```

## Key Components

### DatabaseManager (`packages/core/src/db/`)

SQLite-based persistence for all MetaMCP entities:

| Table | Purpose |
|-------|---------|
| `mcp_servers` | Server configurations (STDIO, SSE, HTTP) |
| `tools` | Tool definitions with schemas |
| `namespaces` | Logical groupings of servers |
| `endpoints` | HTTP endpoints exposing namespaces |
| `policies` | Access control rules |
| `api_keys` | Authentication keys |
| `tool_call_logs` | Audit trail for all tool executions |
| `saved_scripts` | Persisted code snippets |
| `tool_sets` | Saved tool groupings |

### McpManager (`packages/core/src/managers/McpManager.ts`)

Extended MCP management with:

- **Multi-transport**: STDIO (via BridgeManager), SSE, StreamableHTTP
- **Namespace support**: Group servers logically
- **Endpoint management**: HTTP exposure with authentication
- **Tool aggregation**: Unified tool list across servers

### Services (`packages/core/src/services/`)

| Service | Purpose |
|---------|---------|
| `ToolSearchService` | Fuzzy (Fuse.js) + semantic search for tools |
| `PolicyService` | Access control evaluation |
| `CodeExecutorService` | Sandboxed JS/TS execution (isolated-vm) |
| `SavedScriptService` | Script CRUD and execution tracking |

## Quick Start

### Accessing MCP Tools

```typescript
import { McpManager } from '@borg/core';

const manager = McpManager.getInstance();

// List all tools in a namespace
const tools = await manager.listTools('default');

// Execute a tool
const result = await manager.callTool('namespace', 'tool_name', { arg: 'value' });
```

### Using Code Mode

```typescript
import { CodeExecutorService } from '@borg/core';

const executor = new CodeExecutorService(manager);

const result = await executor.execute(`
  // Access MCP tools via mcp.call()
  const files = await mcp.call('filesystem__list', { path: '.' });
  const filtered = files.filter(f => f.endsWith('.ts'));
  return { count: filtered.length, files: filtered };
`);
```

### Searching for Tools

```typescript
import { ToolSearchService } from '@borg/core';

const searchService = new ToolSearchService(manager);

// Fuzzy search
const fuzzyResults = await searchService.searchTools('git commit', 'fuzzy', 10);

// Semantic search (requires embeddings)
const semanticResults = await searchService.searchTools(
  'push code changes to repository', 
  'semantic', 
  10
);

// Hybrid search (best of both)
const hybridResults = await searchService.searchTools(
  'git push',
  'hybrid',
  10,
  { fuzzyWeight: 0.4, semanticWeight: 0.6 }
);
```

## Transports

Borg supports multiple MCP transport mechanisms:

| Transport | Use Case | Configuration |
|-----------|----------|---------------|
| **STDIO** | Local CLI tools | `{ type: 'stdio', command: 'npx', args: ['mcp-server'] }` |
| **SSE** | Remote servers | `{ type: 'sse', url: 'https://mcp.example.com/sse' }` |
| **HTTP** | Streamable HTTP | `{ type: 'http', url: 'https://mcp.example.com/mcp' }` |

## Documentation Index

- [Concepts](./CONCEPTS.md) - Core concepts: namespaces, endpoints, tool sets
- [API Reference](./API.md) - REST API endpoints
- [Middleware](./MIDDLEWARE.md) - Middleware pipeline and customization
- [Configuration](./CONFIGURATION.md) - Environment variables and settings
- [Code Execution](./CODE_EXECUTION.md) - Sandbox execution guide

## Migration from Standalone MetaMCP

If you were using the standalone MetaMCP Docker image, the core functionality is now available directly in Borg:

| MetaMCP Feature | Borg Equivalent |
|-----------------|-----------------|
| `docker compose up` | `pnpm run start:all` |
| Dashboard at `:12009` | Dashboard at `:3000` |
| PostgreSQL | SQLite (embedded) |
| pgvector semantic search | Cosine similarity on embeddings |
| tRPC API | Fastify REST API |

### Key Differences

1. **Database**: Borg uses SQLite instead of PostgreSQL. No external database required.
2. **Embeddings**: Semantic search uses cosine similarity on pre-computed embeddings rather than pgvector.
3. **API**: REST endpoints instead of tRPC. See [API Reference](./API.md).
4. **Auth**: Bearer token via `SUPER_AI_TOKEN` environment variable.

## Related Documentation

- [Borg API Reference](../API_REFERENCE.md) - Full REST API documentation
- [Borg Deployment Guide](../DEPLOYMENT.md) - Production deployment
- [Original MetaMCP](https://docs.metamcp.com) - Reference documentation
