# MetaMCP Middleware

This document explains the middleware pipeline system for customizing tool execution in Borg.

## Overview

Middleware intercepts tool calls at two stages:
1. **ListTools**: When clients request available tools
2. **CallTool**: When tools are executed

This enables logging, access control, filtering, and transformation without modifying tool implementations.

## Architecture

```
                     ┌─────────────────────────────────────────┐
                     │            Middleware Pipeline           │
                     │                                         │
  Tool Request ──────►  Logging ─► Policy ─► Filter ─► Override │
                     │      │         │         │          │    │
                     │      ▼         ▼         ▼          ▼    │
                     │   [log]    [allow?]  [visible?]  [transform]
                     │                                         │
                     └─────────────────────────────────────────┘
                                         │
                                         ▼
                                   Tool Execution
```

## Middleware Types

### ListToolsMiddleware

Intercepts `tools/list` requests to modify available tools.

```typescript
type ListToolsMiddleware = (
  tools: Tool[],
  context: MiddlewareContext
) => Promise<Tool[]> | Tool[];
```

**Use cases:**
- Filter out inactive tools
- Hide tools based on permissions
- Transform tool names/descriptions

### CallToolMiddleware

Intercepts tool execution requests.

```typescript
type CallToolMiddleware = (
  request: CallToolRequest,
  context: MiddlewareContext,
  next: () => Promise<CallToolResult>
) => Promise<CallToolResult>;
```

**Use cases:**
- Log tool calls
- Enforce access policies
- Rate limiting
- Argument validation
- Result transformation

## Context Object

Both middleware types receive a context object:

```typescript
interface MiddlewareContext {
  // Request info
  endpointId: string;
  namespaceId: string;
  apiKeyId?: string;
  
  // User info (if authenticated)
  userId?: string;
  userRoles?: string[];
  
  // Request metadata
  requestId: string;
  timestamp: Date;
  clientIp?: string;
  userAgent?: string;
  
  // Custom data (set by earlier middleware)
  data: Record<string, unknown>;
}
```

## Built-in Middleware

### Logging Middleware

Records all tool calls to the `tool_call_logs` table.

```typescript
import { loggingMiddleware } from '@borg/core';

// Automatically logs:
// - Tool name
// - Arguments (sanitized)
// - Result
// - Duration
// - Status (success/error)
// - Context (endpoint, user, etc.)
```

**Configuration:**
```typescript
loggingMiddleware({
  // Log successful calls
  logSuccess: true,
  
  // Log failed calls
  logErrors: true,
  
  // Fields to redact from arguments
  redactFields: ['password', 'apiKey', 'secret', 'token'],
  
  // Max argument size to log (bytes)
  maxArgumentSize: 10000,
  
  // Max result size to log (bytes)
  maxResultSize: 50000
});
```

### Policy Middleware

Enforces access control policies.

```typescript
import { policyMiddleware } from '@borg/core';

// Evaluates policies in priority order
// First matching policy determines access
// Default: allow (if no policy matches)
```

**Policy evaluation:**
1. Load all enabled policies
2. Sort by priority (higher = evaluated first)
3. Match tool name against `toolPattern` (glob)
4. Check conditions (time, rate limit, etc.)
5. Apply effect (allow/deny)

### Filter Middleware

Removes tools from listings based on criteria.

```typescript
import { filterToolsMiddleware } from '@borg/core';

filterToolsMiddleware({
  // Only show tools matching these patterns
  allowedTools: ['filesystem__*', 'git__*'],
  
  // Hide tools matching these patterns
  blockedTools: ['*__delete*', '*__drop*'],
  
  // Hide inactive tools
  hideInactive: true,
  
  // Hide tools from disconnected servers
  hideDisconnected: true
});
```

### Override Middleware

Transforms tool metadata.

```typescript
import { toolOverridesMiddleware } from '@borg/core';

toolOverridesMiddleware({
  overrides: {
    'filesystem__read': {
      // Rename the tool
      name: 'read_file',
      
      // Override description
      description: 'Read contents of a file (UTF-8)',
      
      // Add custom metadata
      metadata: {
        category: 'filesystem',
        risk: 'low'
      }
    }
  }
});
```

## Composing Middleware

Use `compose()` to chain middleware functions:

```typescript
import { compose, loggingMiddleware, policyMiddleware, filterToolsMiddleware } from '@borg/core';

const callToolPipeline = compose(
  loggingMiddleware(),
  policyMiddleware(),
  rateLimitMiddleware({ requests: 100, windowSeconds: 60 })
);

const listToolsPipeline = compose(
  filterToolsMiddleware({ hideInactive: true }),
  toolOverridesMiddleware({ overrides: { ... } })
);
```

**Execution order:**
- Middleware executes in the order specified
- For `CallTool`, the `next()` function invokes the next middleware
- The final `next()` call executes the actual tool

## Custom Middleware

### CallTool Example: Audit Middleware

```typescript
const auditMiddleware: CallToolMiddleware = async (request, context, next) => {
  const startTime = Date.now();
  
  // Before tool execution
  console.log(`[AUDIT] Starting ${request.name} at ${context.timestamp}`);
  
  try {
    // Execute the tool (or next middleware)
    const result = await next();
    
    // After successful execution
    console.log(`[AUDIT] ${request.name} completed in ${Date.now() - startTime}ms`);
    
    return result;
  } catch (error) {
    // On error
    console.error(`[AUDIT] ${request.name} failed: ${error.message}`);
    throw error;
  }
};
```

### CallTool Example: Validation Middleware

```typescript
const validationMiddleware: CallToolMiddleware = async (request, context, next) => {
  // Validate specific tools
  if (request.name === 'filesystem__write') {
    const { path } = request.arguments;
    
    // Block writes to sensitive paths
    if (path.startsWith('/etc/') || path.startsWith('/usr/')) {
      throw new Error('Writing to system directories is not allowed');
    }
  }
  
  return next();
};
```

### ListTools Example: Category Middleware

```typescript
const categoryMiddleware: ListToolsMiddleware = (tools, context) => {
  // Add category metadata to tools
  return tools.map(tool => ({
    ...tool,
    metadata: {
      ...tool.metadata,
      category: inferCategory(tool.name)
    }
  }));
};

function inferCategory(toolName: string): string {
  if (toolName.startsWith('filesystem__')) return 'filesystem';
  if (toolName.startsWith('git__')) return 'version-control';
  if (toolName.startsWith('postgres__') || toolName.startsWith('redis__')) return 'database';
  return 'other';
}
```

### ListTools Example: Permission Middleware

```typescript
const permissionMiddleware: ListToolsMiddleware = (tools, context) => {
  // Filter tools based on user roles
  const userRoles = context.userRoles || [];
  
  return tools.filter(tool => {
    // Admin sees all
    if (userRoles.includes('admin')) return true;
    
    // Check tool-specific permissions
    const requiredRole = tool.metadata?.requiredRole;
    if (requiredRole && !userRoles.includes(requiredRole)) {
      return false;
    }
    
    return true;
  });
};
```

## Caching

Middleware results can be cached for performance:

```typescript
import { withCache } from '@borg/core';

const cachedFilterMiddleware = withCache(
  filterToolsMiddleware({ hideInactive: true }),
  {
    // Cache key generator
    keyFn: (tools, context) => `filter:${context.endpointId}`,
    
    // TTL in seconds
    ttl: 60,
    
    // Invalidation events
    invalidateOn: ['server:connected', 'server:disconnected', 'tool:updated']
  }
);
```

## Error Handling

Middleware should handle errors gracefully:

```typescript
const safeMiddleware: CallToolMiddleware = async (request, context, next) => {
  try {
    return await next();
  } catch (error) {
    // Log the error
    console.error(`Middleware error for ${request.name}:`, error);
    
    // Option 1: Re-throw (fails the request)
    throw error;
    
    // Option 2: Return error result (tool appears to fail)
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
    
    // Option 3: Return fallback (masks the error)
    return {
      content: [{ type: 'text', text: 'Operation could not be completed' }],
      isError: true
    };
  }
};
```

## Recursive Middleware

When tools call other tools (e.g., via `run_code`), middleware applies recursively:

```
User calls run_code
  └── Middleware: log, policy, filter
       └── run_code executes
            └── Code calls filesystem__read
                 └── Middleware: log, policy, filter (again!)
                      └── filesystem__read executes
```

This ensures:
- All nested tool calls are logged
- Policies apply to programmatic calls
- No bypassing security via code execution

## Best Practices

### DO

- Keep middleware focused (single responsibility)
- Use `compose()` to build pipelines
- Handle errors gracefully
- Cache expensive operations
- Log meaningful context

### DON'T

- Mutate the request object directly
- Block indefinitely in middleware
- Swallow errors silently
- Cache user-specific data globally
- Put business logic in middleware

## Configuration

Middleware can be configured per-endpoint:

```typescript
const endpointConfig = {
  id: 'ep-secure',
  name: 'Secure Endpoint',
  namespaceId: 'production',
  middleware: {
    callTool: [
      'logging',
      'policy',
      { name: 'rateLimit', config: { requests: 50, windowSeconds: 60 } }
    ],
    listTools: [
      'filter',
      { name: 'override', config: { overrides: { ... } } }
    ]
  }
};
```

---

## Related Documentation

- [Concepts](./CONCEPTS.md) - Core MetaMCP concepts
- [API Reference](./API.md) - REST endpoints
- [Configuration](./CONFIGURATION.md) - Environment variables
