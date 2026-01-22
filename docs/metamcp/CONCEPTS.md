# MetaMCP Core Concepts

This document explains the fundamental concepts of MetaMCP as integrated into Borg.

## Table of Contents

- [MCP Servers](#mcp-servers)
- [Namespaces](#namespaces)
- [Endpoints](#endpoints)
- [Tool Sets](#tool-sets)
- [Progressive Tool Disclosure](#progressive-tool-disclosure)
- [Code Mode](#code-mode)
- [Autonomous Agents](#autonomous-agents)

---

## MCP Servers

MCP (Model Context Protocol) Servers are external processes that expose tools, resources, and prompts to LLM clients. Borg aggregates multiple MCP servers into a unified interface.

### Server Types

| Type | Description | Example |
|------|-------------|---------|
| **STDIO** | Local process communicating via stdin/stdout | `npx @anthropic/mcp-server-git` |
| **SSE** | Remote server using Server-Sent Events | `https://mcp.example.com/sse` |
| **StreamableHTTP** | Remote server with bidirectional HTTP streaming | `https://mcp.example.com/mcp` |

### Server Configuration

```typescript
interface McpServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  
  // STDIO-specific
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  
  // HTTP-specific
  url?: string;
  headers?: Record<string, string>;
  
  // Common
  enabled: boolean;
  namespaceId?: string;
}
```

### Tool Naming Convention

Tools are namespaced to avoid conflicts:

```
{server_name}__{tool_name}
```

For example, a `list` tool from the `filesystem` server becomes `filesystem__list`.

---

## Namespaces

Namespaces provide logical grouping of MCP servers. They enable:

- **Isolation**: Different projects can have different tool sets
- **Organization**: Group related servers (e.g., "dev-tools", "data-tools")
- **Access Control**: Apply policies at the namespace level

### Default Namespace

Every installation has a `default` namespace. Servers without an explicit namespace assignment go here.

### Creating Namespaces

```typescript
import { DatabaseManager } from '@borg/core';

const db = DatabaseManager.getInstance();

db.createNamespace({
  id: 'data-tools',
  name: 'Data Tools',
  description: 'Servers for data analysis and manipulation'
});
```

### Namespace Hierarchy

```
Borg Instance
├── Namespace: default
│   ├── Server: filesystem
│   ├── Server: git
│   └── Server: memory
├── Namespace: data-tools
│   ├── Server: postgres
│   ├── Server: redis
│   └── Server: elasticsearch
└── Namespace: external
    ├── Server: github
    └── Server: slack
```

---

## Endpoints

Endpoints expose namespaces over HTTP for external MCP clients. Each endpoint:

- Has a unique URL path
- Can be protected with API keys
- Supports multiple transport protocols

### Endpoint Configuration

```typescript
interface EndpointConfig {
  id: string;
  name: string;
  namespaceId: string;
  path: string;           // URL path: /metamcp/{path}/sse
  apiKeyRequired: boolean;
  allowedApiKeys?: string[];
}
```

### Endpoint URLs

Each endpoint exposes three URLs:

| Protocol | URL Pattern | Use Case |
|----------|-------------|----------|
| SSE | `/metamcp/{endpoint}/sse` | Claude Desktop, VSCode |
| HTTP | `/metamcp/{endpoint}/mcp` | Streamable HTTP clients |
| REST | `/metamcp/{endpoint}/api/{tool}` | Direct HTTP calls |

### Example: Claude Desktop Configuration

```json
{
  "mcpServers": {
    "borg": {
      "url": "http://localhost:3000/metamcp/default/sse",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

---

## Tool Sets

Tool Sets save and restore collections of loaded tools. This supports workflow-specific configurations.

### Why Tool Sets?

With hundreds of available tools, loading all of them would:
- Overwhelm the LLM's context window
- Slow down tool selection
- Reduce response quality

Tool Sets solve this by saving "snapshots" of useful tool combinations.

### Using Tool Sets

```typescript
// Save current loaded tools as a set
await mcp.call('save_tool_set', {
  name: 'git-workflow',
  description: 'Tools for git operations'
});

// Later, restore the set
await mcp.call('load_tool_set', { name: 'git-workflow' });
```

### Tool Set Schema

```typescript
interface ToolSet {
  id: string;
  name: string;
  description?: string;
  tools: string[];      // Array of tool names
  createdAt: string;
  updatedAt: string;
}
```

---

## Progressive Tool Disclosure

Progressive Tool Disclosure is Borg's strategy for managing large tool inventories without overwhelming the LLM.

### The Problem

- MCP aggregators can have 500+ tools
- Loading all tools wastes context tokens
- LLMs struggle to choose from too many options

### The Solution

Only expose **meta-tools** by default:

| Meta-Tool | Purpose |
|-----------|---------|
| `search_tools` | Find tools by name or description |
| `load_tool` | Load a specific tool into context |
| `load_tool_set` | Load a saved group of tools |
| `save_tool_set` | Save current tools as a set |
| `list_loaded_tools` | Show currently available tools |
| `run_code` | Execute code with tool access |
| `run_agent` | Execute natural language tasks |

### Workflow Example

```
User: "I need to work with git"

LLM: [calls search_tools with query="git"]
     → Returns: git__status, git__commit, git__push, git__log, git__diff...

LLM: [calls load_tool with name="git__commit"]
     → git__commit is now available

LLM: [calls git__commit with message="fix: resolve bug"]
     → Commit created
```

### Benefits

1. **Reduced token usage**: Only relevant tools in context
2. **Better accuracy**: LLM not overwhelmed by choices
3. **Faster responses**: Less processing overhead
4. **Semantic discovery**: Find tools by intent, not just name

---

## Code Mode

Code Mode enables executing JavaScript/TypeScript code with access to MCP tools.

### The `run_code` Tool

```typescript
// Execute arbitrary code with tool access
const result = await mcp.call('run_code', {
  code: `
    const files = await mcp.call('filesystem__list', { path: '.' });
    const jsFiles = files.filter(f => f.endsWith('.js'));
    return { count: jsFiles.length, files: jsFiles };
  `
});
```

### Security Model

Code runs in an **isolated-vm** sandbox:

- **Separate V8 isolate**: No access to Node.js APIs
- **Memory limits**: Configurable (default: 128MB)
- **Timeout**: Configurable (default: 30 seconds)
- **No filesystem access**: Only through MCP tools
- **No network access**: Only through MCP tools

### Available in Sandbox

| API | Description |
|-----|-------------|
| `mcp.call(tool, args)` | Call any MCP tool |
| `console.log/warn/error` | Logging (captured) |
| Standard JS | Math, JSON, Array, Object, etc. |

### NOT Available in Sandbox

- `require()` / `import`
- `process`, `__dirname`, `__filename`
- `fetch`, `XMLHttpRequest`
- `fs`, `path`, `child_process`
- `setTimeout`, `setInterval` (sync execution only)

### Saved Scripts

Useful code snippets can be saved for reuse:

```typescript
await mcp.call('save_script', {
  name: 'count-ts-files',
  description: 'Count TypeScript files in a directory',
  code: `
    const files = await mcp.call('filesystem__list', { path: args.path || '.' });
    return files.filter(f => f.endsWith('.ts')).length;
  `
});

// Later
await mcp.call('run_script', { name: 'count-ts-files', args: { path: './src' } });
```

---

## Autonomous Agents

The `run_agent` tool enables natural language task execution.

### How It Works

1. **Parse Intent**: Analyze the natural language request
2. **Search Tools**: Find relevant tools via semantic search
3. **Generate Code**: Create code that accomplishes the task
4. **Execute**: Run in sandbox with tool access
5. **Return Result**: Structured output

### Example

```typescript
const result = await mcp.call('run_agent', {
  task: 'Find all TODO comments in the src directory and create a summary'
});

// The agent will:
// 1. Search for filesystem tools
// 2. Generate code to recursively read files
// 3. Parse for TODO patterns
// 4. Return structured summary
```

### Agent vs Code Mode

| Feature | `run_code` | `run_agent` |
|---------|-----------|-------------|
| Input | JavaScript code | Natural language |
| Tool Discovery | Manual (you specify) | Automatic (semantic search) |
| Use Case | Known procedures | Open-ended tasks |
| Determinism | High | Variable |

### Limitations

- Agents work best for single, well-defined tasks
- Complex multi-step workflows may need explicit code
- Cost: Uses additional LLM calls for code generation

---

## Next Steps

- [API Reference](./API.md) - REST endpoints for all operations
- [Middleware](./MIDDLEWARE.md) - Customize the tool pipeline
- [Configuration](./CONFIGURATION.md) - Environment variables
- [Code Execution](./CODE_EXECUTION.md) - Deep dive into sandboxing
