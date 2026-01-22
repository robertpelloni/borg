# Code Execution Guide

This document covers the sandboxed code execution capabilities in Borg, including `run_code`, `run_agent`, and saved scripts.

## Overview

Borg provides secure code execution via an isolated V8 sandbox. This enables:

- **Tool Chaining**: Execute multiple tools in a single request
- **Data Processing**: Transform and filter tool outputs
- **Automation**: Create reusable scripts for common workflows
- **Autonomous Agents**: Natural language task execution

## Security Model

### Isolation

Code runs in an **isolated-vm** sandbox - a separate V8 isolate with:

| Restriction | Purpose |
|-------------|---------|
| No Node.js APIs | Prevents filesystem/network access |
| No `require`/`import` | Prevents module loading |
| Memory limits | Prevents resource exhaustion |
| CPU timeout | Prevents infinite loops |
| No global state | Prevents cross-execution leaks |

### What's Available

| API | Description |
|-----|-------------|
| `mcp.call(tool, args)` | Execute MCP tools |
| `console.log/warn/error` | Logging (captured) |
| `JSON` | JSON parse/stringify |
| `Math` | Mathematical operations |
| `Date` | Date operations (read-only) |
| `Array/Object/String` | Standard prototypes |
| `Promise/async/await` | Asynchronous execution |

### What's NOT Available

| API | Reason |
|-----|--------|
| `require()` / `import` | Module loading blocked |
| `process` | Node.js API blocked |
| `fs` / `path` | Filesystem blocked |
| `fetch` / `XMLHttpRequest` | Network blocked |
| `setTimeout` / `setInterval` | Async scheduling blocked |
| `eval` / `Function` | Dynamic code execution blocked |
| `__dirname` / `__filename` | Path information blocked |

---

## The `run_code` Tool

Execute arbitrary JavaScript/TypeScript code with tool access.

### Basic Usage

```typescript
const result = await mcp.call('run_code', {
  code: `
    const files = await mcp.call('filesystem__list', { path: './src' });
    return files.filter(f => f.endsWith('.ts')).length;
  `
});
// result: 42
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | string | (required) | JavaScript/TypeScript code to execute |
| `timeout` | number | 30000 | Execution timeout (ms) |
| `memoryLimit` | number | 128 | Memory limit (MB) |

### Return Values

The code must return a JSON-serializable value:

```typescript
// Valid returns
return 42;
return "hello";
return { count: 10, files: ['a.ts', 'b.ts'] };
return [1, 2, 3];
return null;

// Invalid returns (will error)
return () => {};        // Functions not serializable
return new Map();       // Map not serializable
return Symbol('test');  // Symbols not serializable
```

### Accessing Console Output

Logs are captured and returned separately:

```typescript
const result = await mcp.call('run_code', {
  code: `
    console.log('Processing...');
    console.warn('This might take a while');
    return { done: true };
  `
});

// Result includes:
// {
//   result: { done: true },
//   logs: [
//     { level: 'log', message: 'Processing...' },
//     { level: 'warn', message: 'This might take a while' }
//   ]
// }
```

---

## The `mcp.call()` API

Inside the sandbox, use `mcp.call()` to execute MCP tools.

### Syntax

```typescript
const result = await mcp.call(toolName: string, arguments: object);
```

### Examples

```typescript
// Read a file
const content = await mcp.call('filesystem__read', { path: './README.md' });

// Execute git command
const status = await mcp.call('git__status', {});

// Query database
const rows = await mcp.call('postgres__query', {
  query: 'SELECT * FROM users WHERE active = $1',
  params: [true]
});

// Send notification
await mcp.call('slack__post_message', {
  channel: '#alerts',
  text: 'Build completed!'
});
```

### Error Handling

```typescript
try {
  const result = await mcp.call('filesystem__read', { path: '/nonexistent' });
} catch (error) {
  console.error('Tool failed:', error.message);
  return { error: error.message };
}
```

### Chaining Tools

```typescript
const code = `
  // 1. Get list of files
  const files = await mcp.call('filesystem__list', { path: './src' });
  
  // 2. Filter TypeScript files
  const tsFiles = files.filter(f => f.endsWith('.ts'));
  
  // 3. Get stats for each
  const stats = await Promise.all(
    tsFiles.map(f => mcp.call('filesystem__stat', { path: './src/' + f }))
  );
  
  // 4. Calculate total size
  const totalSize = stats.reduce((sum, s) => sum + s.size, 0);
  
  return {
    fileCount: tsFiles.length,
    totalSize,
    averageSize: Math.round(totalSize / tsFiles.length)
  };
`;
```

---

## The `run_agent` Tool

Execute tasks described in natural language.

### How It Works

1. **Parse Intent**: Analyze the task description
2. **Discover Tools**: Semantic search for relevant tools
3. **Generate Code**: LLM writes execution code
4. **Execute**: Run in sandbox with tool access
5. **Return Result**: Structured output

### Basic Usage

```typescript
const result = await mcp.call('run_agent', {
  task: 'Find all TODO comments in the src directory and list them'
});
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | string | (required) | Natural language task description |
| `maxSteps` | number | 10 | Maximum tool calls allowed |
| `timeout` | number | 60000 | Total execution timeout (ms) |

### Example Tasks

```typescript
// File operations
await mcp.call('run_agent', {
  task: 'List all JavaScript files larger than 100KB in the project'
});

// Git operations
await mcp.call('run_agent', {
  task: 'Show the last 5 commits that modified package.json'
});

// Data analysis
await mcp.call('run_agent', {
  task: 'Count the number of active users in the database who signed up this month'
});

// Multi-step workflows
await mcp.call('run_agent', {
  task: 'Find all failing tests, read their source code, and suggest fixes'
});
```

### Limitations

- Works best for single, well-defined tasks
- Complex multi-step workflows may need explicit code
- Uses additional LLM calls (costs tokens)
- May produce different results on repeated calls

---

## Saved Scripts

Persist useful code snippets for reuse.

### Creating Scripts

```typescript
await mcp.call('save_script', {
  name: 'count-lines',
  description: 'Count lines in all files of a given type',
  code: `
    const files = await mcp.call('filesystem__glob', { 
      pattern: '**/*' + args.extension 
    });
    let total = 0;
    for (const file of files) {
      const content = await mcp.call('filesystem__read', { path: file });
      total += content.split('\\n').length;
    }
    return { files: files.length, totalLines: total };
  `,
  tags: ['filesystem', 'analysis']
});
```

### Running Scripts

```typescript
// By name
await mcp.call('run_script', {
  name: 'count-lines',
  args: { extension: '.ts' }
});

// By ID
await mcp.call('run_script', {
  scriptId: 'script-123',
  args: { extension: '.js' }
});
```

### Script Parameters

Scripts receive parameters via the `args` object:

```typescript
// Script definition
const code = `
  // args is automatically available
  const { path, recursive } = args;
  
  const pattern = recursive ? '**/*' : '*';
  return await mcp.call('filesystem__glob', { 
    pattern,
    cwd: path 
  });
`;

// Invocation
await mcp.call('run_script', {
  name: 'list-files',
  args: { path: './src', recursive: true }
});
```

### Managing Scripts

```typescript
// List all scripts
const scripts = await mcp.call('list_scripts', {});

// Get script details
const script = await mcp.call('get_script', { name: 'count-lines' });

// Delete script
await mcp.call('delete_script', { name: 'count-lines' });

// Update script
await mcp.call('update_script', {
  name: 'count-lines',
  description: 'Updated description',
  code: '...'
});
```

---

## Patterns and Best Practices

### Error Handling Pattern

```typescript
const code = `
  const results = [];
  const errors = [];
  
  for (const item of args.items) {
    try {
      const result = await mcp.call('process_item', { item });
      results.push({ item, result, success: true });
    } catch (error) {
      errors.push({ item, error: error.message, success: false });
    }
  }
  
  return { 
    processed: results.length, 
    failed: errors.length,
    results,
    errors 
  };
`;
```

### Batching Pattern

```typescript
const code = `
  // Process in batches to avoid overwhelming servers
  const batchSize = 5;
  const items = args.items;
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => mcp.call('process', { item }))
    );
    results.push(...batchResults);
    console.log(\`Processed \${Math.min(i + batchSize, items.length)} / \${items.length}\`);
  }
  
  return results;
`;
```

### Conditional Logic Pattern

```typescript
const code = `
  const status = await mcp.call('git__status', {});
  
  if (status.staged.length === 0) {
    return { action: 'none', message: 'Nothing to commit' };
  }
  
  if (args.dryRun) {
    return { 
      action: 'preview', 
      files: status.staged,
      message: \`Would commit \${status.staged.length} files\`
    };
  }
  
  await mcp.call('git__commit', { message: args.message });
  return { action: 'committed', files: status.staged };
`;
```

### Data Transformation Pattern

```typescript
const code = `
  // Fetch raw data
  const users = await mcp.call('database__query', {
    query: 'SELECT * FROM users'
  });
  
  // Transform and enrich
  const enriched = users.map(user => ({
    id: user.id,
    displayName: \`\${user.first_name} \${user.last_name}\`,
    isActive: user.status === 'active',
    daysSinceSignup: Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / 86400000
    )
  }));
  
  // Filter
  const activeRecent = enriched.filter(
    u => u.isActive && u.daysSinceSignup < 30
  );
  
  return {
    total: users.length,
    active: enriched.filter(u => u.isActive).length,
    newUsers: activeRecent.length,
    users: activeRecent
  };
`;
```

---

## Debugging

### Verbose Logging

```typescript
const code = `
  console.log('Starting execution...');
  console.log('Args:', JSON.stringify(args, null, 2));
  
  const step1 = await mcp.call('tool1', { x: 1 });
  console.log('Step 1 result:', JSON.stringify(step1, null, 2));
  
  const step2 = await mcp.call('tool2', { y: step1.value });
  console.log('Step 2 result:', JSON.stringify(step2, null, 2));
  
  return step2;
`;
```

### Inspecting Tool Results

```typescript
const code = `
  // Wrap tool calls to inspect results
  async function trace(name, args) {
    console.log(\`Calling \${name} with:\`, JSON.stringify(args));
    const start = Date.now();
    try {
      const result = await mcp.call(name, args);
      console.log(\`\${name} returned in \${Date.now() - start}ms:\`, 
        JSON.stringify(result).slice(0, 200));
      return result;
    } catch (e) {
      console.error(\`\${name} failed:\`, e.message);
      throw e;
    }
  }
  
  return await trace('filesystem__list', { path: '.' });
`;
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODE_EXECUTION_ENABLED` | `true` | Enable code execution |
| `CODE_EXECUTION_TIMEOUT` | `30000` | Default timeout (ms) |
| `CODE_EXECUTION_MEMORY_LIMIT` | `128` | Memory limit (MB) |

### Per-Endpoint Settings

```json
{
  "id": "ep-secure",
  "config": {
    "codeEnabled": false
  }
}
```

### Runtime Configuration

```http
PUT /api/system/config
Content-Type: application/json

{
  "code.enabled": true,
  "code.timeout": 60000,
  "code.memoryLimit": 256
}
```

---

## Related Documentation

- [Concepts](./CONCEPTS.md) - Code Mode overview
- [API Reference](./API.md) - REST endpoints
- [Configuration](./CONFIGURATION.md) - Environment variables
