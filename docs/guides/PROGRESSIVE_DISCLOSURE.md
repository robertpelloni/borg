# Progressive Disclosure Strategy

Super AI Plugin implements a "Progressive Disclosure" strategy to manage context window limits effectively. Instead of exposing hundreds of tools to the LLM immediately, we expose a minimal set of "Meta Tools" that allow the LLM to discover and load what it needs.

## Architecture

### 1. Default State
When a client connects to the Hub, they see only:
*   `search_tools`: Fuzzy search for tools by keyword.
*   `load_tool`: Whitelist a specific tool for the current session.
*   `run_code` / `run_agent`: Core execution capabilities.

### 2. Discovery
The LLM (or user) calls `search_tools(query="github")`.
*   The Hub searches its local index (powered by Fuse.js) and the remote MetaMCP index.
*   It returns a list of matching tool definitions *without* loading them into the active context yet.

### 3. Loading
The LLM decides it needs `github__create_issue`.
*   It calls `load_tool(name="github__create_issue")`.
*   The Hub adds this tool to the `sessionVisibleTools` set for that specific connection.
*   The Hub sends a `tools/list_changed` notification (if supported) or the LLM re-lists tools.

### 4. Execution
The LLM can now see and call `github__create_issue`.

## Configuration

To enable this mode locally:
```env
MCP_PROGRESSIVE_MODE=true
```

## Benefits
*   **Token Savings:** Reduces initial context from ~100k tokens (for 50+ tools) to <1k tokens.
*   **Focus:** Prevents the LLM from getting distracted by irrelevant tools.
*   **Scale:** Allows connecting hundreds of MCP servers without breaking the client.
