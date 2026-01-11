# Kapture MCP Server

MCP server for Kapture browser automation. This server enables AI assistants like Claude to control web browsers through the Kapture Chrome extension.

**✨ Key Feature**: Support for multiple AI assistants running simultaneously! All clients connect via WebSocket to the same server.

## Quick Start

### Run with npx (no installation required)

```bash
npx kapture-mcp
```

The server automatically runs on port 61822.

### Bridge mode (Alternative for stdio-based MCP clients)

```bash
npx kapture-mcp bridge
```

This starts the server and provides stdio-to-WebSocket translation using the built-in mcp2websocket bridge.

### Smart Server Detection

When running `npx kapture-mcp`, it automatically detects if a server is already running:
- **No existing server**: Starts a new server
- **Server already running**: Shows connection info and exits gracefully

This prevents port conflicts and provides helpful information about existing connections.

### Install globally

```bash
npm install -g kapture-mcp
```

### Install locally in a project

```bash
npm install kapture-mcp
```

## Usage with Claude Desktop

### Recommended: Using the bridge command
This single command starts the server and handles stdio communication:
```json
{
  "mcpServers": {
    "kapture": {
      "command": "npx",
      "args": ["-y", "kapture-mcp", "bridge"]
    }
  }
}
```

### Alternative: Direct WebSocket connection
First start the server:
```bash
npx kapture-mcp
```

Then configure Claude Desktop to use WebSocket transport:
```json
{
  "mcpServers": {
    "kapture": {
      "transport": "websocket",
      "url": "ws://localhost:61822/mcp"
    }
  }
}
```

## Command Line Options

- **No arguments**: Starts the server on port 61822
- `bridge`: Starts the server and provides stdio-to-WebSocket bridge for MCP clients

The server always runs on port 61822

## Running Multiple AI Assistants

Kapture supports multiple AI clients through a single server instance:

- **All clients**: Connect via WebSocket to `ws://localhost:61822/mcp`
- All clients share access to the same browser tabs

**Example: Claude Desktop + Cline**

Start the server manually:
```bash
npx kapture-mcp
```

Claude Desktop (claude_desktop_config.json):
```json
{
  "mcpServers": {
    "kapture": {
      "command": "npx",
      "args": ["-y", "kapture-mcp", "bridge"]
    }
  }
}
```

Cline (VS Code settings.json) - WebSocket connection:
```json
{
  "cline.mcpServers": {
    "kapture": {
      "transport": "websocket",
      "url": "ws://localhost:61822/mcp"
    }
  }
}
```

All connected clients can control the same browser tabs simultaneously.

## Requirements

- Node.js 18 or higher
- Chrome browser with Kapture extension installed

## How it Works

1. The MCP server starts and listens on port 61822
2. The Kapture Chrome extension connects to the server via WebSocket
3. AI assistants can now control the browser through MCP tools

## Server Architecture

```mermaid
graph LR
    subgraph "Chrome/Brave"
            Tab1
            Tab2
    end
    subgraph "External Clients"
        MCP1["MCP Client 1<br/>Claude Desktop"]
        MCP2["MCP Client 2<br/>Cline"]
        MCPN["MCP Client N<br/>Custom"]
    end
    
    subgraph "Kapture MCP Server [:61822]"
        WSS_MCP["ws://localhost:61822/mcp"]
        HTTP["HTTP Server"]
        
        MCPServer["MCP Server Manager<br/>Handles MCP protocol"]
        BrowserWSMgr["Browser WebSocket Manager<br/>ws://localhost:61822/"]
        CommandHandler["Browser Command Handler<br/>Executes commands"]

        subgraph "Capability Handlers"
            PromptHandler["Prompt Handler"]
            ToolHandler["Tool Handler"]
            ResourceHandler["Resource Handler"]
        end
        
        subgraph "HTTP Endpoints"
            Discovery["/"]
            Resources["/tab/{id}/*"]
            Screenshot["/tab/{id}/screenshot/view"]
        end
    end
    
    %% External connections
    MCP1 --> WSS_MCP
    MCP2 --> WSS_MCP
    MCPN --> WSS_MCP
    
    %% Network to Protocol
    HTTP --> Discovery
    HTTP --> Resources
    HTTP --> Screenshot
    WSS_MCP --> MCPServer
    
    %% Protocol to Business Logic
    PromptHandler --> ToolHandler
    MCPServer --> PromptHandler
    MCPServer --> ResourceHandler
    MCPServer --> ToolHandler
    ToolHandler --> CommandHandler
    ResourceHandler --> ToolHandler
    CommandHandler --> BrowserWSMgr
    
    %% HTTP endpoint connections
    Resources --> ResourceHandler
    Screenshot --> ResourceHandler

    BrowserWSMgr --> Tab1
    BrowserWSMgr --> Tab2
    
    %% Styling
    classDef network fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef protocol fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    classDef logic fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#000
    classDef endpoint fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000
    classDef external fill:#37474f,stroke:#263238,stroke-width:2px,color:#fff
    
    class HTTP,WSS_MCP,BrowserWSMgr network
    class MCPServer protocol
    class CommandHandler,TabReg,ToolHandler,ResourceHandler,PromptHandler logic
    class Discovery,Resources,Screenshot endpoint
    class MCP1,MCP2,MCPN,Browser external
```

### Component Responsibilities

- **HTTP Server**: Main entry point, handles HTTP requests and WebSocket upgrades
- **WebSocket Server**: Manages all WebSocket connections (both MCP clients and browser extensions)
- **Tab Registry**: Maintains state of all connected browser tabs
- **Browser Command Handler**: Executes browser commands with timeout handling
- **Browser WebSocket Manager**: Routes messages between browser extensions and command handlers
- **MCP Server Manager**: Implements MCP protocol for each connected client
- **Tool Handler**: Processes MCP tool calls and validates inputs
- **Resource Handler**: Handles MCP resource requests (tabs, console logs, screenshots, DOM)
- **Prompt Handler**: Manages MCP prompt operations


## Available MCP Tools

- `navigate` - Navigate to URL
- `back` - Browser back button
- `forward` - Browser forward button
- `click` - Click elements
- `hover` - Hover over elements
- `fill` - Fill input fields
- `select` - Select dropdown options
- `evaluate` - Execute JavaScript
- `elements` - Query all elements matching a CSS selector or XPath with optional visibility filtering

## MCP Resources

- `kapture://tabs` - List all connected browser tabs
- `kapture://tab/{tabId}` - Get detailed tab information
- `kapture://tab/{tabId}/console` - Get console logs
- `kapture://tab/{tabId}/screenshot` - Capture screenshots
- `kapture://tab/{tabId}/dom` - Get DOM HTML
- `kapture://tab/{tabId}/elementsFromPoint` - Get elements at coordinates
- `kapture://tab/{tabId}/elements?selector={selector}&visible={true|false|all}` - Query all elements matching a CSS selector or XPath with optional visibility filtering

## Documentation

For full documentation and Chrome extension installation, visit:
https://github.com/williamkapke/kapture

## License

MIT
