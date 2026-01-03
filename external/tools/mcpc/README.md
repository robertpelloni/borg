# mcpc: Universal command-line client for the Model Context Protocol (MCP)

`mcpc` is a CLI for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) that maps MCP operations to intuitive commands for interactive shell use, scripts, and AI coding agents.

It is useful for inspecting servers, scripting, and enabling AI coding agents to use MCP ["code mode"](#ai-agents) in shell.

## Key Features

-   🌎 **Highly compatible** - Works with any MCP server over Streamable HTTP or stdio.
-   🔄 **Persistent sessions** - Keep multiple server connections alive simultaneously.
-   🚀 **Zero setup** - Connect to remote servers instantly with just a URL.
-   🔧 **Strong MCP support** - Instructions, tools, resources, prompts, dynamic discovery.
-   🔌 **JSON output** - Easy integration with `jq`, scripts, and other CLI tools.
-   🤖 **AI-friendly** - Designed for both function calling and code mode with sandboxing.
-   🔒 **Secure** - Full OAuth 2.1 support, OS keychain for credentials storage.

## Integration in AIOS

`mcpc` is integrated as a tool in AIOS to allow agents to interact with MCP servers directly from the command line.

### Usage

```bash
# List all active sessions and saved authentication profiles
mcpc

# Login to remote MCP server and save OAuth credentials for future use
mcpc mcp.apify.com login

# Show information about a remote MCP server
mcpc mcp.apify.com

# Use JSON mode for scripting
mcpc mcp.apify.com tools-list --json
```

## Source

- Repository: [https://github.com/apify/mcpc](https://github.com/apify/mcpc)
- Package: `npm install -g @apify/mcpc`
