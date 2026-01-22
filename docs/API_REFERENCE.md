# Borg API Reference

## Overview

Borg provides a REST API (Fastify) and WebSocket API (Socket.io) for managing agents, MCP servers, memory, and system resources.

**Base URL:** `http://localhost:3002` (default)

## Authentication

All API requests require a Bearer token:

```
Authorization: Bearer <SUPER_AI_TOKEN>
```

Set `SUPER_AI_TOKEN` environment variable or use `dev-token` for development.

---

## REST API Endpoints

### System

#### GET /health
Returns system health status.

**Response:**
```json
{
  "status": "operational",
  "uptime": 12345,
  "connections": { "total": 3, "vscode": 1, "browser": 1, "cli": 1 },
  "mcp": { "total": 5, "running": 4 }
}
```

#### GET /api/system/status
Returns detailed system status including memory, CPU, and service states.

---

### Agents

#### GET /api/agents
List all registered agents.

#### POST /api/agents/:id/execute
Execute a task with a specific agent.

**Body:**
```json
{
  "task": "Analyze the codebase structure",
  "context": { "files": ["src/"] }
}
```

---

### MCP Servers

#### GET /api/mcp/servers
List all MCP servers and their status.

#### POST /api/mcp/servers/:name/start
Start an MCP server.

#### POST /api/mcp/servers/:name/stop
Stop an MCP server.

#### GET /api/mcp/tools
List all available tools across MCP servers.

---

### Memory

#### POST /api/memory/remember
Store information in long-term memory.

**Body:**
```json
{
  "content": "Important information to remember",
  "tags": ["project", "architecture"]
}
```

#### POST /api/memory/search
Search memory semantically.

**Body:**
```json
{
  "query": "project architecture decisions"
}
```

#### GET /api/memory/recall?limit=10
Recall recent memories.

---

### Secrets

#### GET /api/secrets
List all secret keys (values masked).

#### POST /api/secrets
Create or update a secret.

**Body:**
```json
{
  "key": "OPENAI_API_KEY",
  "value": "sk-..."
}
```

#### DELETE /api/secrets/:key
Delete a secret.

---

### Ecosystem

#### GET /api/ecosystem/submodules
List all submodules with sync status.

#### POST /api/ecosystem/health
Check health of specific submodules.

**Body:**
```json
{
  "names": ["mcp-hub", "claude-code"]
}
```

---

## WebSocket API

Connect via Socket.io to `http://localhost:3002`.

### Events (Client -> Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `register` | `{ type: 'vscode' \| 'browser' \| 'cli' }` | Register client connection |
| `agent:execute` | `{ agentId, task, context }` | Execute agent task |
| `mcp:callTool` | `{ tool, arguments }` | Call MCP tool |

### Events (Server -> Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `system:status` | System status object | Periodic status updates |
| `agent:response` | `{ agentId, result }` | Agent execution result |
| `agent:stream` | `{ agentId, chunk }` | Streaming agent response |
| `mcp:toolResult` | `{ tool, result }` | Tool execution result |
| `log:entry` | Log entry object | Real-time log streaming |

---

## Core Services

### CacheService

LRU cache with TTL support.

```typescript
import { CacheService, cached } from './services/CacheService.js';

const cache = CacheService.getInstance<User>('users', { maxSize: 100, defaultTTL: 300000 });
cache.set('user:123', userData);
const user = cache.get('user:123');

// Or use the helper
const user = await cached(cache, 'user:123', () => fetchUser(123));
```

### MetricsService

Prometheus-compatible metrics.

```typescript
import { metrics } from './services/MetricsService.js';

metrics.incCounter('requests_total', 1, { endpoint: '/api/agents' });
metrics.setGauge('active_connections', 5);

const endTimer = metrics.timer('request_duration_ms');
// ... do work ...
endTimer();

// Export for Prometheus
const prometheusFormat = metrics.exportPrometheus();
```

### AuditService

Security audit logging.

```typescript
import { AuditService } from './services/AuditService.js';

const audit = AuditService.getInstance();
audit.logAuth('user@example.com', 'login');
audit.logSecretAccess('system', 'OPENAI_API_KEY', 'access');
audit.logToolExecution('agent-1', 'file_read', 'success');
```

### TelemetryService

Distributed tracing.

```typescript
import { telemetry } from './services/TelemetryService.js';

// Manual spans
const span = telemetry.startSpan('processRequest');
telemetry.addSpanAttribute(span.spanId, 'user.id', '123');
telemetry.endSpan(span.spanId, 'ok');

// Automatic tracing
const result = await telemetry.trace('fetchData', async (span) => {
  telemetry.addSpanEvent(span.spanId, 'cache_miss');
  return await fetchFromDatabase();
});
```

### ConnectionPool

Generic connection pooling.

```typescript
import { ConnectionPool, ConnectionPoolManager } from './services/ConnectionPoolService.js';

const pool = new ConnectionPool(
  () => createDatabaseConnection(),
  (conn) => conn.close(),
  (conn) => conn.ping(),
  { minSize: 2, maxSize: 10 }
);

await pool.initialize();
ConnectionPoolManager.register('database', pool);

const conn = await pool.acquire();
try {
  // use connection
} finally {
  pool.release(conn);
}
```

---

## Rate Limiting

API endpoints are rate-limited to 100 requests per minute per user/tool.

**Response when exceeded:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "details": {}
}
```

Common error codes:
- `unauthorized` - Missing or invalid auth token
- `not_found` - Resource not found
- `rate_limit_exceeded` - Too many requests
- `validation_error` - Invalid request body
- `internal_error` - Server error

---

## MetaMCP Integration

Borg integrates MetaMCP functionality for advanced MCP server orchestration, multi-transport support, and sandboxed code execution.

### Documentation

For comprehensive MetaMCP documentation, see:

| Document | Description |
|----------|-------------|
| [Overview](metamcp/README.md) | Architecture, migration guide, quick start |
| [Core Concepts](metamcp/CONCEPTS.md) | Namespaces, endpoints, tool sets, code mode, agents |
| [REST API](metamcp/API.md) | Complete API reference for MetaMCP endpoints |
| [Middleware](metamcp/MIDDLEWARE.md) | ListTools/CallTool pipelines, custom middleware |
| [Configuration](metamcp/CONFIGURATION.md) | Environment variables, database config, policies |
| [Code Execution](metamcp/CODE_EXECUTION.md) | Sandboxed TS/Python execution, `run_code`, `run_agent` |

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/metamcp/servers` | List all MCP servers with namespace info |
| `POST /api/metamcp/tools/search` | Fuzzy + semantic tool search |
| `POST /api/metamcp/code/execute` | Execute sandboxed TypeScript/Python |
| `GET /api/metamcp/namespaces` | List namespaces and their endpoints |
| `POST /api/metamcp/endpoints/:id/connect` | Connect to an MCP endpoint |

### Features

- **Multi-Transport**: STDIO, SSE, and Streamable HTTP transports
- **Namespaces & Endpoints**: Organize MCP servers hierarchically
- **Policy-Based Access**: Fine-grained tool access control
- **Tool Search**: Fuzzy matching + semantic search with embeddings
- **Code Mode**: Isolated-vm sandbox for safe code execution
- **Saved Scripts**: Persist and reuse code snippets
