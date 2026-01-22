# MetaMCP Configuration

This document covers all configuration options for MetaMCP functionality in Borg.

## Configuration Layers

Borg uses a layered configuration system:

| Layer | Storage | Requires Restart | Scope |
|-------|---------|------------------|-------|
| **Environment** | `.env` / System | Yes | Global |
| **Database** | SQLite `config` table | No | Global |
| **Per-Endpoint** | SQLite `endpoints` table | No | Endpoint |

**Priority**: Environment > Database > Defaults

---

## Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPER_AI_TOKEN` | (none) | Bearer token for API authentication |
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server bind address |
| `NODE_ENV` | `development` | Environment: `development`, `production`, `test` |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./data/borg.db` | SQLite database file path |
| `DATABASE_WAL` | `true` | Enable WAL mode for better concurrency |

### MCP Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TIMEOUT` | `60000` | Default tool execution timeout (ms) |
| `MCP_MAX_TOTAL_TIMEOUT` | `300000` | Maximum total timeout for chained operations (ms) |
| `MCP_MAX_ATTEMPTS` | `3` | Max retry attempts for failed tool calls |
| `MCP_RESET_TIMEOUT_ON_PROGRESS` | `true` | Reset timeout when server sends progress |
| `MCP_STDIO_BUFFER_SIZE` | `1048576` | STDIO buffer size (1MB default) |

### Session Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_LIFETIME` | `3600` | Session TTL in seconds (1 hour) |
| `SESSION_CLEANUP_INTERVAL` | `300` | Cleanup interval in seconds (5 min) |

### Code Execution

| Variable | Default | Description |
|----------|---------|-------------|
| `CODE_EXECUTION_ENABLED` | `true` | Enable `run_code` and `run_agent` tools |
| `CODE_EXECUTION_TIMEOUT` | `30000` | Code execution timeout (ms) |
| `CODE_EXECUTION_MEMORY_LIMIT` | `128` | Memory limit per execution (MB) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | `true` | Require authentication |
| `API_KEY_HEADER` | `X-API-Key` | Header name for API key auth |
| `DISABLE_SIGNUP` | `false` | Disable new user registration |
| `DISABLE_BASIC_AUTH` | `false` | Disable username/password auth |

### SSO/OIDC (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `OIDC_CLIENT_ID` | (none) | OIDC client ID |
| `OIDC_CLIENT_SECRET` | (none) | OIDC client secret |
| `OIDC_DISCOVERY_URL` | (none) | OIDC discovery URL (`.well-known/openid-configuration`) |
| `OIDC_SCOPES` | `openid profile email` | Requested OIDC scopes |
| `DISABLE_SSO_SIGNUP` | `false` | Block new users via SSO |

### Telemetry

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEMETRY_ENABLED` | `true` | Enable anonymous telemetry |
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics endpoint |
| `METRICS_PATH` | `/metrics` | Metrics endpoint path |

---

## Database Configuration

Runtime-modifiable settings stored in the `config` table.

### Viewing Configuration

```http
GET /api/system/config
```

```json
{
  "mcp.timeout": 60000,
  "mcp.maxAttempts": 3,
  "session.lifetime": 3600,
  "code.enabled": true,
  "code.timeout": 30000
}
```

### Updating Configuration

```http
PUT /api/system/config
```

```json
{
  "mcp.timeout": 120000,
  "code.timeout": 60000
}
```

### Available Database Config Keys

| Key | Type | Description |
|-----|------|-------------|
| `mcp.timeout` | number | Default tool timeout (ms) |
| `mcp.maxAttempts` | number | Retry attempts |
| `mcp.resetTimeoutOnProgress` | boolean | Reset timeout on progress |
| `session.lifetime` | number | Session TTL (seconds) |
| `code.enabled` | boolean | Enable code execution |
| `code.timeout` | number | Code timeout (ms) |
| `code.memoryLimit` | number | Memory limit (MB) |
| `search.fuzzyThreshold` | number | Fuzzy search threshold (0-1) |
| `search.semanticThreshold` | number | Semantic search threshold (0-1) |
| `log.retention` | number | Log retention days |

---

## Per-Endpoint Configuration

Each endpoint can override global settings.

### Endpoint Schema

```typescript
interface EndpointConfig {
  id: string;
  name: string;
  namespaceId: string;
  path: string;
  
  // Authentication
  apiKeyRequired: boolean;
  allowedApiKeys?: string[];
  
  // Overrides
  config?: {
    timeout?: number;
    maxAttempts?: number;
    codeEnabled?: boolean;
    codeTimeout?: number;
    rateLimit?: {
      requests: number;
      windowSeconds: number;
    };
  };
  
  // Middleware
  middleware?: {
    callTool?: string[];
    listTools?: string[];
  };
}
```

### Example: Restricted Endpoint

```json
{
  "id": "ep-restricted",
  "name": "Restricted Endpoint",
  "namespaceId": "production",
  "path": "restricted",
  "apiKeyRequired": true,
  "config": {
    "timeout": 30000,
    "codeEnabled": false,
    "rateLimit": {
      "requests": 50,
      "windowSeconds": 60
    }
  },
  "middleware": {
    "callTool": ["logging", "policy", "rateLimit"],
    "listTools": ["filter"]
  }
}
```

---

## Server Configuration

MCP server definitions include configuration options.

### STDIO Server

```json
{
  "id": "filesystem",
  "name": "Filesystem",
  "type": "stdio",
  "command": "npx",
  "args": ["@anthropic/mcp-server-filesystem", "--allowed-paths", "/home/user"],
  "env": {
    "DEBUG": "true"
  },
  "config": {
    "timeout": 120000,
    "retryOnError": true
  },
  "enabled": true,
  "namespaceId": "default"
}
```

### SSE Server

```json
{
  "id": "remote-api",
  "name": "Remote API",
  "type": "sse",
  "url": "https://api.example.com/mcp/sse",
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  },
  "config": {
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10
  },
  "enabled": true,
  "namespaceId": "external"
}
```

### HTTP Server

```json
{
  "id": "streamable-api",
  "name": "Streamable API",
  "type": "http",
  "url": "https://api.example.com/mcp",
  "headers": {
    "X-API-Key": "${API_KEY}"
  },
  "config": {
    "timeout": 60000
  },
  "enabled": true,
  "namespaceId": "external"
}
```

---

## Policy Configuration

Access control policies have extensive configuration options.

### Policy Schema

```typescript
interface Policy {
  id: string;
  name: string;
  description?: string;
  
  // Evaluation order (higher = first)
  priority: number;
  
  // Effect when matched
  effect: 'allow' | 'deny';
  
  // Tool matching (glob pattern)
  toolPattern: string;
  
  // Optional: Server matching
  serverPattern?: string;
  
  // Optional: Namespace matching
  namespacePattern?: string;
  
  // Conditions
  conditions?: {
    // Time-based restrictions
    timeRange?: {
      start: string;  // HH:MM
      end: string;    // HH:MM
      timezone?: string;
      daysOfWeek?: number[];  // 0=Sunday, 6=Saturday
    };
    
    // User-based restrictions
    userRoles?: string[];
    userIds?: string[];
    
    // Rate limiting
    rateLimit?: {
      requests: number;
      windowSeconds: number;
      scope: 'user' | 'endpoint' | 'global';
    };
    
    // Argument validation
    argumentConstraints?: {
      field: string;
      operator: 'equals' | 'contains' | 'matches' | 'in';
      value: string | string[];
    }[];
  };
  
  enabled: boolean;
}
```

### Example Policies

**Block Dangerous Tools:**
```json
{
  "name": "Block Destructive Operations",
  "priority": 1000,
  "effect": "deny",
  "toolPattern": "*__delete*",
  "enabled": true
}
```

**Rate Limit External APIs:**
```json
{
  "name": "Rate Limit External",
  "priority": 500,
  "effect": "allow",
  "serverPattern": "external__*",
  "conditions": {
    "rateLimit": {
      "requests": 100,
      "windowSeconds": 60,
      "scope": "user"
    }
  },
  "enabled": true
}
```

**Business Hours Only:**
```json
{
  "name": "Business Hours Only",
  "priority": 100,
  "effect": "deny",
  "toolPattern": "production__*",
  "conditions": {
    "timeRange": {
      "start": "18:00",
      "end": "09:00",
      "timezone": "America/New_York",
      "daysOfWeek": [0, 6]
    }
  },
  "enabled": true
}
```

---

## Logging Configuration

### Log Levels

| Level | Description |
|-------|-------------|
| `debug` | Verbose debugging (tool args, results) |
| `info` | Standard operational logs |
| `warn` | Warning conditions |
| `error` | Error conditions only |

### Log Output

```bash
# Console (default in development)
LOG_OUTPUT=console

# File
LOG_OUTPUT=file
LOG_FILE_PATH=./logs/borg.log
LOG_FILE_MAX_SIZE=10485760  # 10MB
LOG_FILE_MAX_FILES=5

# JSON (for log aggregation)
LOG_FORMAT=json
```

### Tool Call Log Retention

```bash
# Days to retain tool call logs
LOG_RETENTION_DAYS=30

# Cleanup on startup
LOG_CLEANUP_ON_START=true
```

---

## Example .env File

```bash
# Core
SUPER_AI_TOKEN=your-secure-token-here
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_PATH=./data/borg.db
DATABASE_WAL=true

# MCP
MCP_TIMEOUT=60000
MCP_MAX_ATTEMPTS=3

# Sessions
SESSION_LIFETIME=3600

# Code Execution
CODE_EXECUTION_ENABLED=true
CODE_EXECUTION_TIMEOUT=30000
CODE_EXECUTION_MEMORY_LIMIT=128

# Auth
AUTH_ENABLED=true
DISABLE_SIGNUP=true

# Optional: OIDC
# OIDC_CLIENT_ID=your-client-id
# OIDC_CLIENT_SECRET=your-client-secret
# OIDC_DISCOVERY_URL=https://auth.example.com/.well-known/openid-configuration

# Telemetry
TELEMETRY_ENABLED=false
METRICS_ENABLED=true
METRICS_PATH=/metrics

# Logging
LOG_OUTPUT=file
LOG_FILE_PATH=./logs/borg.log
LOG_FORMAT=json
LOG_RETENTION_DAYS=30
```

---

## Configuration Validation

On startup, Borg validates all configuration:

```
[INFO] Configuration loaded
[INFO]   - Environment: production
[INFO]   - Port: 3000
[INFO]   - Database: ./data/borg.db
[INFO]   - Auth: enabled
[INFO]   - Code execution: enabled
[WARN]   - TELEMETRY_ENABLED=false, metrics will not be reported
```

Invalid configuration causes startup failure:

```
[ERROR] Configuration validation failed:
[ERROR]   - MCP_TIMEOUT must be a positive number
[ERROR]   - DATABASE_PATH directory does not exist
```

---

## Related Documentation

- [Concepts](./CONCEPTS.md) - Core MetaMCP concepts
- [API Reference](./API.md) - REST endpoints
- [Middleware](./MIDDLEWARE.md) - Middleware customization
- [Code Execution](./CODE_EXECUTION.md) - Sandbox configuration
