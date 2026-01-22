# Architecture Option C: Hono Backend + Ink CLI

**Decision:** Path C - API Server + CLI Client  
**Date:** 2026-01-09  
**Status:** Approved Architecture

---

## Overview

Option C provides the best of both worlds:

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Bun + Hono | High-performance API server |
| **Web UI** | React/htmx | Browser-based dashboard |
| **CLI** | Bun + Ink | Terminal "Mecha Suit" interface |

```
┌─────────────────────────────────────────────────────────────────┐
│                      Borg ARCHITECTURE                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   HONO BACKEND                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐   │   │
│  │  │ REST    │ │ SSE     │ │ WebSocket│ │ MCP Stdio    │   │   │
│  │  │ /api/*  │ │ /hub/sse│ │ Socket.io│ │ Interface    │   │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬───────┘   │   │
│  │       │           │           │             │           │   │
│  │  ┌────┴───────────┴───────────┴─────────────┴────────┐  │   │
│  │  │              CORE SERVICE (CoreService)            │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │  │   │
│  │  │  │ Managers │ │ Services │ │ Agent Executor   │   │  │   │
│  │  │  │ (50+)    │ │ (Vector, │ │ (ReAct Loop)     │   │  │   │
│  │  │  │          │ │  Health) │ │                  │   │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘   │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│              ▼               ▼               ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   WEB UI      │  │   INK CLI     │  │  MCP CLIENTS  │       │
│  │   (React)     │  │   (Terminal)  │  │  (Claude/VS)  │       │
│  │               │  │               │  │               │       │
│  │  Dashboard    │  │  Mecha Suit   │  │  Tool Access  │       │
│  │  Settings     │  │  Agent Chat   │  │  SSE Stream   │       │
│  │  Inspector    │  │  Status View  │  │               │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Option C?

### Advantages

| Benefit | Description |
|---------|-------------|
| **Separation of Concerns** | Backend handles logic, clients handle presentation |
| **Multiple Interfaces** | Same API powers web, terminal, and MCP clients |
| **Developer Experience** | CLI for power users, Web for visual management |
| **Testability** | API can be tested independently |
| **Scalability** | Backend can be deployed separately from clients |
| **TypeScript Everywhere** | Bun + Ink = React patterns in terminal |

### Compared to Other Options

| Aspect | Option A (TUI Only) | Option B (Web Only) | Option C (Both) |
|--------|---------------------|---------------------|-----------------|
| Visual Dashboard | ❌ | ✅ | ✅ |
| Terminal Power | ✅ | ❌ | ✅ |
| API Reusability | ❌ | Partial | ✅ |
| Deployment | Simple | Simple | Flexible |
| Dev Complexity | Low | Medium | Medium |

---

## Technology Stack

### Backend: Bun + Hono

```typescript
// packages/core/src/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { Server as SocketIOServer } from 'socket.io';

export class CoreService {
  private app = new Hono();
  private io: SocketIOServer;
  
  // 50+ Managers
  private agentManager: AgentManager;
  private memoryManager: MemoryManager;
  private mcpProxyManager: McpProxyManager;
  // ... etc

  constructor(rootDir: string) {
    this.app.use('*', cors({ origin: '*' }));
    this.setupRoutes();
  }

  private setupRoutes() {
    // REST API
    this.app.get('/health', (c) => c.json(this.healthService.getSystemStatus()));
    this.app.get('/api/state', (c) => c.json({ agents, skills, hooks, ... }));
    this.app.post('/api/agents/run', async (c) => { /* ... */ });
    
    // SSE for MCP
    this.app.get('/api/hub/sse', async (c) => { /* SSE stream */ });
    this.app.post('/api/hub/messages', async (c) => { /* JSON-RPC */ });
  }

  async start(port = 3000) {
    // HTTP via Hono
    serve({ fetch: this.app.fetch, port });
    
    // Socket.io on port + 1
    this.httpServer.listen(port + 1);
  }
}
```

### CLI: Bun + Ink (React for Terminal)

```typescript
// packages/cli/src/app.tsx
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';

// Main CLI Application
const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'chat' | 'agents' | 'tools'>('dashboard');
  const [connected, setConnected] = useState(false);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) exit();
    if (input === '1') setView('dashboard');
    if (input === '2') setView('chat');
    if (input === '3') setView('agents');
    if (input === '4') setView('tools');
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header connected={connected} />
      <Navigation active={view} />
      {view === 'dashboard' && <DashboardView />}
      {view === 'chat' && <ChatView />}
      {view === 'agents' && <AgentsView />}
      {view === 'tools' && <ToolsView />}
      <StatusBar />
    </Box>
  );
};

// Dashboard View
const DashboardView: React.FC = () => {
  const [state, setState] = useState<SystemState | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/state')
      .then(r => r.json())
      .then(setState);
  }, []);

  if (!state) return <Spinner type="dots" />;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">System Status</Text>
      </Box>
      <Box>
        <Text>Agents: </Text>
        <Text color="green">{state.agents.length}</Text>
      </Box>
      <Box>
        <Text>Skills: </Text>
        <Text color="green">{state.skills.length}</Text>
      </Box>
      <Box>
        <Text>MCP Servers: </Text>
        <Text color="green">{state.mcpServers.length}</Text>
      </Box>
    </Box>
  );
};

// Chat View (Agent Interaction)
const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setLoading(true);
    
    const response = await fetch('http://localhost:3000/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: 'researcher', task: input })
    });
    
    const result = await response.json();
    setMessages(prev => [...prev, { role: 'assistant', content: result.result }]);
    setLoading(false);
    setInput('');
  };

  return (
    <Box flexDirection="column" height={20}>
      <MessageList messages={messages} />
      {loading && <Spinner type="dots" />}
      <TextInput value={input} onChange={setInput} onSubmit={sendMessage} />
    </Box>
  );
};

// Entry point
render(<App />);
```

### Web UI: React + Hono Static Serving

```typescript
// packages/ui stays as Next.js or converts to React + htmx
// Served via Hono static middleware or separate dev server

// In CoreService:
this.app.get('/*', async (c) => {
  const indexPath = path.resolve(this.rootDir, '../ui/dist/index.html');
  if (fs.existsSync(indexPath)) {
    return c.html(fs.readFileSync(indexPath, 'utf-8'));
  }
  return c.json({ error: 'Not found' }, 404);
});
```

---

## Package Structure

```
packages/
├── core/                 # Backend (Hono API Server)
│   ├── src/
│   │   ├── server.ts     # Hono app + routes
│   │   ├── managers/     # All Manager classes
│   │   ├── services/     # VectorStore, Health, etc.
│   │   ├── agents/       # AgentExecutor, LoopManager
│   │   ├── hub/          # HubServer (MCP JSON-RPC)
│   │   └── gateway/      # ModelGateway (LLM abstraction)
│   └── package.json
│
├── cli/                  # Terminal Client (Ink)
│   ├── src/
│   │   ├── app.tsx       # Main Ink application
│   │   ├── views/        # Dashboard, Chat, Agents, Tools
│   │   ├── components/   # Reusable Ink components
│   │   ├── hooks/        # React hooks for API calls
│   │   └── commands/     # CLI command handlers
│   └── package.json
│
├── ui/                   # Web Client (React)
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   └── lib/          # API client, utilities
│   └── package.json
│
└── types/                # Shared TypeScript types
    └── src/
        ├── api.ts        # API request/response types
        ├── state.ts      # System state types
        └── mcp.ts        # MCP protocol types
```

---

## API Contract

Both CLI and Web UI consume the same API:

### Core Endpoints

```typescript
// GET /health
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: { used: number; total: number };
  connections: { mcp: number; websocket: number };
}

// GET /api/state
interface StateResponse {
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  hooks: HookDefinition[];
  prompts: PromptDefinition[];
  context: ContextFile[];
  mcpServers: McpServerStatus[];
  commands: CommandDefinition[];
  scheduledTasks: ScheduledTask[];
  marketplace: MarketplacePackage[];
  profiles: ProfileDefinition[];
}

// POST /api/agents/run
interface RunAgentRequest {
  agentName: string;
  task: string;
  sessionId?: string;
}
interface RunAgentResponse {
  result: string;
  sessionId: string;
  toolCalls: ToolCall[];
}

// GET /api/hub/sse
// Server-Sent Events stream for MCP protocol

// POST /api/hub/messages?sessionId=xxx
interface McpMessage {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}
```

### WebSocket Events (Socket.io)

```typescript
// Client → Server
socket.emit('hook_event', event: HookEvent);

// Server → Client
socket.on('state', (state: StateResponse) => {});
socket.on('agents_updated', (agents: AgentDefinition[]) => {});
socket.on('skills_updated', (skills: SkillDefinition[]) => {});
socket.on('mcp_updated', (servers: McpServerStatus[]) => {});
socket.on('traffic_log', (log: TrafficLog) => {});
socket.on('research_update', (update: ResearchUpdate) => {});
socket.on('health_updated', (health: HealthResponse) => {});
```

---

## CLI Commands (Ink-based)

```bash
# Start the CLI TUI
borg                      # Launch interactive terminal UI

# Direct commands (non-interactive)
borg start                # Start backend server
borg status               # Show system status
borg run <agent> <task>   # Run agent with task
borg chat                 # Interactive chat mode
borg tools                # List available tools
borg agents               # List agents
borg skills               # List skills
borg mine                 # Bobcoin activity submission
borg connect              # Connect to running server
```

### Interactive TUI Navigation

```
┌─────────────────────────────────────────────────────────────────┐
│  Borg v0.4.0                              ● Connected           │
├─────────────────────────────────────────────────────────────────┤
│  [1] Dashboard  [2] Chat  [3] Agents  [4] Tools  [5] Settings   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ╭─ System Status ──────────────────────────────────────────╮  │
│  │                                                           │  │
│  │  Agents:      3    ●                                      │  │
│  │  Skills:    100    ●                                      │  │
│  │  MCP Servers: 5    ●                                      │  │
│  │  Memory:    256MB / 1GB                                   │  │
│  │  Uptime:    2h 34m                                        │  │
│  │                                                           │  │
│  ╰───────────────────────────────────────────────────────────╯  │
│                                                                 │
│  ╭─ Recent Activity ────────────────────────────────────────╮  │
│  │  [14:32] Agent 'researcher' completed task               │  │
│  │  [14:28] Tool 'web_search' called (3 results)            │  │
│  │  [14:25] Memory saved: "Project architecture decision"   │  │
│  ╰───────────────────────────────────────────────────────────╯  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Press [ESC] to exit | [?] for help | [/] command palette      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Stabilization (Current)

- [x] Migrate server.ts from Fastify to Hono
- [ ] Fix SSE endpoint for Hono streaming
- [ ] Fix static file serving
- [ ] Verify Socket.io works on separate port
- [ ] Test all API endpoints

### Phase 2: CLI Foundation

- [ ] Create `packages/cli` with Ink setup
- [ ] Implement API client hooks
- [ ] Build basic views (Dashboard, Status)
- [ ] Add keyboard navigation

### Phase 3: CLI Features

- [ ] Chat view with agent interaction
- [ ] Agents management view
- [ ] Tools browser with search
- [ ] Settings configuration
- [ ] Real-time log streaming

### Phase 4: Polish

- [ ] Shared types package
- [ ] Error handling and reconnection
- [ ] Themes and customization
- [ ] Documentation

---

## Dependencies

### Backend (packages/core)

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "socket.io": "^4.x",
    "@modelcontextprotocol/sdk": "^1.25.x"
  }
}
```

### CLI (packages/cli)

```json
{
  "dependencies": {
    "ink": "^5.x",
    "ink-text-input": "^6.x",
    "ink-spinner": "^5.x",
    "ink-select-input": "^5.x",
    "react": "^18.x",
    "zustand": "^4.x"
  }
}
```

---

## Benefits Summary

| Stakeholder | Benefit |
|-------------|---------|
| **Power Users** | Fast terminal interface, keyboard-driven |
| **Casual Users** | Visual web dashboard |
| **Developers** | Clean API contract, easy to extend |
| **Ops** | Multiple deployment options |
| **MCP Clients** | Standard SSE/stdio interface unchanged |

---

*Option C: The Mecha Suit that runs everywhere.*
