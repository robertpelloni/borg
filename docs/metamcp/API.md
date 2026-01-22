# MetaMCP API Reference

This document details the REST API endpoints for MetaMCP functionality in Borg.

## Base URL

```
http://localhost:3000
```

## Authentication

All endpoints require authentication via Bearer token or API key.

### Bearer Token (Recommended)

```http
Authorization: Bearer <SUPER_AI_TOKEN>
```

### API Key (For MCP Endpoints)

```http
X-API-Key: <your-api-key>
```

---

## MCP Proxy Endpoints

These endpoints expose MCP servers to external clients.

### SSE Transport

```http
GET /metamcp/{endpoint}/sse
```

Server-Sent Events transport for MCP clients (Claude Desktop, VSCode).

**Headers:**
- `X-API-Key`: API key (if endpoint requires authentication)

**Response:** SSE stream following MCP protocol

### Streamable HTTP Transport

```http
POST /metamcp/{endpoint}/mcp
```

Bidirectional HTTP streaming for MCP clients.

**Headers:**
- `X-API-Key`: API key (if required)
- `Content-Type`: `application/json`

**Body:** MCP JSON-RPC request

### Direct Tool Execution

```http
POST /metamcp/{endpoint}/api/{tool_name}
```

Execute a tool directly via REST.

**Headers:**
- `X-API-Key`: API key (if required)
- `Content-Type`: `application/json`

**Body:**
```json
{
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Tool execution result"
    }
  ],
  "isError": false
}
```

---

## Server Management

### List MCP Servers

```http
GET /api/mcp/servers
```

**Response:**
```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Filesystem",
      "type": "stdio",
      "command": "npx",
      "args": ["@anthropic/mcp-server-filesystem"],
      "enabled": true,
      "status": "connected",
      "namespaceId": "default"
    }
  ]
}
```

### Get Server Details

```http
GET /api/mcp/servers/{serverId}
```

**Response:**
```json
{
  "id": "filesystem",
  "name": "Filesystem",
  "type": "stdio",
  "command": "npx",
  "args": ["@anthropic/mcp-server-filesystem"],
  "enabled": true,
  "status": "connected",
  "namespaceId": "default",
  "tools": [
    {
      "name": "filesystem__read",
      "description": "Read file contents",
      "inputSchema": { ... }
    }
  ]
}
```

### Create Server

```http
POST /api/mcp/servers
```

**Body:**
```json
{
  "name": "My Server",
  "type": "stdio",
  "command": "npx",
  "args": ["my-mcp-server"],
  "env": {
    "API_KEY": "secret"
  },
  "enabled": true,
  "namespaceId": "default"
}
```

### Update Server

```http
PUT /api/mcp/servers/{serverId}
```

**Body:** Same as create, partial updates allowed.

### Delete Server

```http
DELETE /api/mcp/servers/{serverId}
```

### Connect/Disconnect Server

```http
POST /api/mcp/servers/{serverId}/connect
POST /api/mcp/servers/{serverId}/disconnect
```

---

## Tool Management

### List All Tools

```http
GET /api/mcp/tools
```

**Query Parameters:**
- `namespace`: Filter by namespace (default: all)
- `server`: Filter by server ID

**Response:**
```json
{
  "tools": [
    {
      "name": "filesystem__read",
      "serverId": "filesystem",
      "description": "Read file contents",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string" }
        },
        "required": ["path"]
      }
    }
  ]
}
```

### Search Tools

```http
POST /api/mcp/tools/search
```

**Body:**
```json
{
  "query": "read files",
  "mode": "hybrid",
  "limit": 10,
  "options": {
    "fuzzyWeight": 0.4,
    "semanticWeight": 0.6
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "tool": {
        "name": "filesystem__read",
        "description": "Read file contents"
      },
      "score": 0.92,
      "matchType": "semantic"
    }
  ]
}
```

### Execute Tool

```http
POST /api/mcp/tools/{toolName}/execute
```

**Body:**
```json
{
  "arguments": {
    "path": "/etc/hosts"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "127.0.0.1 localhost\n..."
    }
  ],
  "isError": false,
  "executionTime": 45
}
```

---

## Namespace Management

### List Namespaces

```http
GET /api/mcp/namespaces
```

**Response:**
```json
{
  "namespaces": [
    {
      "id": "default",
      "name": "Default",
      "description": "Default namespace",
      "serverCount": 5
    }
  ]
}
```

### Create Namespace

```http
POST /api/mcp/namespaces
```

**Body:**
```json
{
  "name": "Data Tools",
  "description": "Servers for data operations"
}
```

### Update Namespace

```http
PUT /api/mcp/namespaces/{namespaceId}
```

### Delete Namespace

```http
DELETE /api/mcp/namespaces/{namespaceId}
```

---

## Endpoint Management

### List Endpoints

```http
GET /api/mcp/endpoints
```

**Response:**
```json
{
  "endpoints": [
    {
      "id": "ep-default",
      "name": "Default Endpoint",
      "namespaceId": "default",
      "path": "default",
      "apiKeyRequired": true,
      "urls": {
        "sse": "/metamcp/default/sse",
        "http": "/metamcp/default/mcp",
        "rest": "/metamcp/default/api"
      }
    }
  ]
}
```

### Create Endpoint

```http
POST /api/mcp/endpoints
```

**Body:**
```json
{
  "name": "Public Endpoint",
  "namespaceId": "default",
  "path": "public",
  "apiKeyRequired": false
}
```

### Update Endpoint

```http
PUT /api/mcp/endpoints/{endpointId}
```

### Delete Endpoint

```http
DELETE /api/mcp/endpoints/{endpointId}
```

---

## Policy Management

### List Policies

```http
GET /api/mcp/policies
```

**Response:**
```json
{
  "policies": [
    {
      "id": "pol-1",
      "name": "Block Dangerous Tools",
      "priority": 100,
      "effect": "deny",
      "toolPattern": "*__delete*",
      "enabled": true
    }
  ]
}
```

### Create Policy

```http
POST /api/mcp/policies
```

**Body:**
```json
{
  "name": "Rate Limit API Calls",
  "priority": 50,
  "effect": "allow",
  "toolPattern": "api__*",
  "rateLimit": {
    "requests": 100,
    "windowSeconds": 60
  },
  "conditions": {
    "timeRange": {
      "start": "09:00",
      "end": "17:00"
    }
  }
}
```

### Update Policy

```http
PUT /api/mcp/policies/{policyId}
```

### Delete Policy

```http
DELETE /api/mcp/policies/{policyId}
```

---

## Code Execution

### Execute Code

```http
POST /api/mcp/code/execute
```

**Body:**
```json
{
  "code": "const files = await mcp.call('filesystem__list', { path: '.' }); return files.length;",
  "timeout": 30000,
  "memoryLimit": 128
}
```

**Response:**
```json
{
  "result": 42,
  "logs": [
    { "level": "log", "message": "Processing..." }
  ],
  "executionTime": 150
}
```

### List Saved Scripts

```http
GET /api/mcp/scripts
```

**Response:**
```json
{
  "scripts": [
    {
      "id": "script-1",
      "name": "count-files",
      "description": "Count files in directory",
      "code": "...",
      "isFavorite": true,
      "tags": ["filesystem", "utility"],
      "executionCount": 15
    }
  ]
}
```

### Save Script

```http
POST /api/mcp/scripts
```

**Body:**
```json
{
  "name": "backup-configs",
  "description": "Backup configuration files",
  "code": "const configs = await mcp.call('filesystem__glob', { pattern: '**/*.config.js' }); ...",
  "tags": ["backup", "config"]
}
```

### Run Saved Script

```http
POST /api/mcp/scripts/{scriptId}/run
```

**Body:**
```json
{
  "args": {
    "path": "./src"
  }
}
```

### Delete Script

```http
DELETE /api/mcp/scripts/{scriptId}
```

---

## Tool Sets

### List Tool Sets

```http
GET /api/mcp/tool-sets
```

**Response:**
```json
{
  "toolSets": [
    {
      "id": "ts-1",
      "name": "Git Workflow",
      "description": "Tools for git operations",
      "tools": ["git__status", "git__commit", "git__push"],
      "createdAt": "2025-01-10T10:00:00Z"
    }
  ]
}
```

### Create Tool Set

```http
POST /api/mcp/tool-sets
```

**Body:**
```json
{
  "name": "Data Analysis",
  "description": "Tools for data work",
  "tools": ["postgres__query", "redis__get", "filesystem__read"]
}
```

### Load Tool Set

```http
POST /api/mcp/tool-sets/{toolSetId}/load
```

Loads the tools in this set into the current session.

### Delete Tool Set

```http
DELETE /api/mcp/tool-sets/{toolSetId}
```

---

## API Keys

### List API Keys

```http
GET /api/mcp/api-keys
```

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "key-1",
      "name": "Claude Desktop",
      "prefix": "sk-...abc",
      "createdAt": "2025-01-01T00:00:00Z",
      "lastUsed": "2025-01-10T15:30:00Z",
      "endpointIds": ["ep-default"]
    }
  ]
}
```

### Create API Key

```http
POST /api/mcp/api-keys
```

**Body:**
```json
{
  "name": "VSCode Extension",
  "endpointIds": ["ep-default", "ep-data"]
}
```

**Response:**
```json
{
  "id": "key-2",
  "name": "VSCode Extension",
  "key": "sk-full-key-only-shown-once",
  "prefix": "sk-...xyz"
}
```

### Revoke API Key

```http
DELETE /api/mcp/api-keys/{keyId}
```

---

## Tool Call Logs

### Query Logs

```http
GET /api/mcp/logs
```

**Query Parameters:**
- `tool`: Filter by tool name
- `server`: Filter by server ID
- `status`: Filter by status (success, error)
- `from`: Start timestamp (ISO 8601)
- `to`: End timestamp (ISO 8601)
- `limit`: Max results (default: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "logs": [
    {
      "id": "log-1",
      "tool": "filesystem__read",
      "serverId": "filesystem",
      "arguments": { "path": "/etc/hosts" },
      "result": { "content": [...] },
      "status": "success",
      "duration": 45,
      "timestamp": "2025-01-10T15:30:00Z"
    }
  ],
  "total": 1250,
  "hasMore": true
}
```

### Get Log Details

```http
GET /api/mcp/logs/{logId}
```

### Replay Tool Call

```http
POST /api/mcp/logs/{logId}/replay
```

Re-executes the tool call with the same arguments.

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'unknown__tool' not found",
    "details": {
      "availableTools": ["filesystem__read", "filesystem__write"]
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Policy denied access |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `TOOL_NOT_FOUND` | 404 | Tool does not exist |
| `SERVER_DISCONNECTED` | 503 | MCP server not connected |
| `EXECUTION_TIMEOUT` | 408 | Code/tool execution timed out |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## WebSocket Events

For real-time updates, connect to the Socket.io namespace:

```javascript
const socket = io('http://localhost:3000/mcp');

// Server status changes
socket.on('server:status', (data) => {
  console.log(`Server ${data.serverId} is now ${data.status}`);
});

// Tool call events
socket.on('tool:called', (data) => {
  console.log(`Tool ${data.tool} called with`, data.arguments);
});

socket.on('tool:result', (data) => {
  console.log(`Tool ${data.tool} returned`, data.result);
});

// Log events
socket.on('log:created', (data) => {
  console.log(`New log entry:`, data);
});
```

---

## Rate Limits

Default rate limits (configurable via policies):

| Endpoint Type | Limit |
|---------------|-------|
| Tool Execution | 100 req/min |
| Code Execution | 20 req/min |
| Search | 60 req/min |
| Management APIs | 300 req/min |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704900000
```
