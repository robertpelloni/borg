# OpenCode Web

Next.js 16 rebuild of the OpenCode web application with React Server Components.

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## Multi-Server Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           YOUR MACHINE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│   │   TUI :4056  │     │   TUI :4057  │     │   TUI :4058  │   ...          │
│   │  ~/project-a │     │  ~/project-b │     │  ~/project-c │                │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│          │                    │                    │                         │
│          │ SSE events         │ SSE events         │ SSE events              │
│          │                    │                    │                         │
│          ▼                    ▼                    ▼                         │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                    MultiServerSSE                            │           │
│   │  ┌─────────────────────────────────────────────────────┐    │           │
│   │  │  directoryToPort Map                                 │    │           │
│   │  │  ~/project-a → 4056                                  │    │           │
│   │  │  ~/project-b → 4057                                  │    │           │
│   │  │  ~/project-c → 4058                                  │    │           │
│   │  └─────────────────────────────────────────────────────┘    │           │
│   └─────────────────────────────────────────────────────────────┘           │
│          │                                                                   │
│          │ Aggregated events                                                 │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                 Next.js Web App :8423                        │           │
│   │  ┌─────────────────────────────────────────────────────┐    │           │
│   │  │  Zustand Store                                       │    │           │
│   │  │  directories: {                                      │    │           │
│   │  │    "~/project-a": { sessions, messages, parts... }   │    │           │
│   │  │    "~/project-b": { sessions, messages, parts... }   │    │           │
│   │  │  }                                                   │    │           │
│   │  └─────────────────────────────────────────────────────┘    │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works

**The Problem:** OpenCode can run multiple TUI instances, each managing a different project directory. Each TUI runs its own HTTP server on a different port. The web UI needs to:

1. See sessions from ALL running TUIs
2. Send messages to the CORRECT TUI (the one managing that session's directory)

**The Solution:** Multi-Server SSE with Smart Routing

#### 1. Server Discovery (`/api/opencode-servers`)

Every 5 seconds, the web app discovers running OpenCode servers:

```bash
# Finds all bun/opencode processes listening on TCP ports
lsof -iTCP -sTCP:LISTEN | grep -E 'bun|opencode'

# Verifies each is an OpenCode server by hitting /project/current
curl http://127.0.0.1:4056/project/current
# → { "worktree": "/Users/joel/project-a" }
```

Returns: `[{ port: 4056, pid: 12345, directory: "/Users/joel/project-a" }, ...]`

#### 2. SSE Aggregation (`MultiServerSSE`)

Maintains persistent SSE connections to ALL discovered servers:

```typescript
// Connects to each server's event stream
fetch(`http://127.0.0.1:${port}/global/event`)

// Events include the directory they came from
{ directory: "/Users/joel/project-a", payload: { type: "message.updated", ... } }
```

All events are forwarded to the Zustand store, keyed by directory.

#### 3. Smart Request Routing (`createClient`)

When sending a message, the client routes to the correct server:

```typescript
function createClient(directory?: string) {
  // Look up which port handles this directory
  const serverUrl =
    multiServerSSE.getBaseUrlForDirectory(directory) ?? "http://localhost:4056"; // fallback

  return createOpencodeClient({ baseUrl: serverUrl, directory });
}
```

**Example:** User sends message in session from `~/project-b`:

- `createClient("/Users/joel/project-b")`
- Looks up directory → port 4057
- Request goes to `http://127.0.0.1:4057/session/{id}/prompt`
- TUI on port 4057 receives it and processes

#### 4. Bidirectional Sync

```
┌─────────────┐                      ┌─────────────┐
│   Web UI    │                      │     TUI     │
│             │                      │             │
│  [Send Msg] │ ───── HTTP POST ───▶ │  [Process]  │
│             │                      │             │
│  [Display]  │ ◀──── SSE Event ──── │  [Respond]  │
│             │                      │             │
└─────────────┘                      └─────────────┘
```

- **Web → TUI:** HTTP POST to the correct server (via directory lookup)
- **TUI → Web:** SSE events streamed back (via aggregated connections)

### Key Files

| File                                    | Purpose                                |
| --------------------------------------- | -------------------------------------- |
| `src/core/multi-server-sse.ts`          | SSE aggregator, directory→port mapping |
| `src/core/client.ts`                    | Smart client factory with routing      |
| `src/app/api/opencode-servers/route.ts` | Server discovery via lsof              |
| `src/react/provider.tsx`                | SSE subscription, store hydration      |
| `src/react/store.ts`                    | Zustand store, per-directory state     |
| `src/react/use-multi-server-sse.ts`     | Hook to start SSE and forward events   |

### Debugging

The session page includes a debug panel (bottom-right) showing:

- Discovered servers and their directories
- Current directory context
- Store state (sessions, messages, parts)
- SSE connection status

Console logs show routing decisions:

```
[createClient] directory: /Users/joel/project-a
[createClient] discoveredUrl: http://127.0.0.1:4056
[createClient] using serverUrl: http://127.0.0.1:4056
```

---

## Prompt Input Features

### Slash Commands (`/`)

Type `/` to execute actions:

- Autocomplete dropdown shows available commands
- Navigate with `↑`/`↓` arrow keys or Tab
- Press Enter to select
- Commands trigger workflows (e.g., `/fix`, `/test`, `/refactor`)

### File References (`@`)

Type `@` to reference files as context:

- Fuzzy file search across the codebase
- Navigate suggestions with keyboard
- Selected files appear as removable pills
- Multiple files can be referenced
- Files are included in message context metadata

### Components

- **PromptInput** - Main input orchestrator with autocomplete
- **Autocomplete** - Dropdown for slash commands and file search
- **FilePill** - Removable file reference badges

### Hooks

- **useFileSearch** - Fuzzy file search with debouncing
- **useCommands** - Available slash commands registry
- **useSendMessage** - Context-aware message dispatch to API

---

## Tech Stack

- **Next.js 16** - App Router, React Server Components, Turbopack
- **Bun** - Runtime and package manager
- **TypeScript** - Strict type checking
- **Zustand** - State management (per-directory stores)
- **Tailwind CSS** - Styling
- **Streamdown** - Markdown rendering with streaming support
- **TDD** - 119+ tests

See [AGENTS.md](../../AGENTS.md) for full architecture documentation.
