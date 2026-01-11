# ADR 001: Next.js Rebuild of OpenCode Web

**Status:** Proposed  
**Date:** 2025-12-26  
**Deciders:** Joel Hooks, Architecture Team  
**Affected Components:** Web UI (`apps/web/`), SDK integration, real-time sync

---

## Context

OpenCode's web application (`packages/app/`) is built with SolidJS as a single-page application. While SolidJS provides excellent fine-grained reactivity, the current architecture has accumulated significant technical debt that limits our ability to:

1. **Manage complexity** - 13+ nested provider levels create cognitive overhead and make feature additions risky
2. **Deliver mobile UX** - 5 confirmed mobile issues stem from SolidJS patterns that don't translate well to touch interfaces
3. **Leverage modern patterns** - React Server Components and Server Actions provide better separation of concerns than client-side state management
4. **Reuse battle-tested components** - `ai-elements` offers production-grade chat UI components we'd otherwise rebuild

### Current Architecture Problems

#### Provider Hell (13+ Levels)

```
MetaProvider
  → ErrorBoundary
    → DialogProvider
      → MarkedProvider
        → DiffComponentProvider
          → CodeComponentProvider
            → GlobalSDKProvider
              → GlobalSyncProvider
                → ThemeProvider
                  → LayoutProvider
                    → NotificationProvider
                      → CommandProvider
                        → Router
```

**Impact:** Adding a new provider requires threading through all layers. Testing components requires mocking all ancestors. Refactoring is high-risk.

#### GlobalSyncProvider God Object (403 lines)

Located at `packages/app/src/context/global-sync.tsx`, this provider handles:

- SSE connection lifecycle and reconnection logic
- State synchronization for 8+ entity types (sessions, messages, agents, etc.)
- Multi-directory project management
- Real-time event bus for all state updates
- Error handling and recovery

**Impact:** Single point of failure for real-time sync. Changes require deep understanding of entire state machine. Hard to test in isolation.

#### Mobile UX Issues (5 Confirmed)

| Issue                                    | Severity | Root Cause                                        | Current Impact                             |
| ---------------------------------------- | -------- | ------------------------------------------------- | ------------------------------------------ |
| Auto-scroll broken on session load       | CRITICAL | SolidJS reactivity timing + DOM mutation race     | Messages don't scroll to bottom, UX broken |
| No scroll-to-bottom FAB when scrolled up | HIGH     | Custom scroll tracking, no standard patterns      | Users miss new messages                    |
| Aggressive accordion collapse on mobile  | HIGH     | Desktop-first component design                    | Context lost on small screens              |
| Code block horizontal overflow           | MEDIUM   | Fixed-width containers, no responsive breakpoints | Code unreadable on mobile                  |
| Separate mobile/desktop code paths       | MEDIUM   | Conditional rendering throughout codebase         | Maintenance burden, feature drift          |

**Root cause:** SolidJS's fine-grained reactivity doesn't map well to imperative scroll behavior. React's component lifecycle and hooks provide better patterns for this.

---

## Decision

**We will rebuild the OpenCode web application in Next.js 16+ using React Server Components and ai-elements.**

### What We're Preserving

1. **AsyncLocalStorage DI Pattern** - Elegant, portable, no changes needed
2. **SSE Real-Time Sync** - Proven approach, will integrate via Server Actions
3. **OpenAPI SDK Codegen** - Existing workflow stays intact
4. **Session/Message Data Model** - No API changes required
5. **Markdown/Diff/Code Rendering** - Migrate existing components or use ai-elements equivalents

### What We're Changing

| Aspect        | Current (SolidJS)       | New (Next.js)          | Benefit                                                 |
| ------------- | ----------------------- | ---------------------- | ------------------------------------------------------- |
| **Framework** | SolidJS                 | React 19               | Larger ecosystem, easier hiring, better mobile patterns |
| **Chat UI**   | Custom built            | ai-elements            | Battle-tested, accessible, mobile-optimized             |
| **Routing**   | @solidjs/router         | Next.js App Router     | File-based, better code splitting                       |
| **State**     | SolidJS Store + Context | RSC + Server Actions   | Reduced client-side complexity, better data flow        |
| **Real-time** | SSE via context         | SSE via Server Actions | Cleaner separation, easier to test                      |
| **Styling**   | Tailwind (existing)     | Tailwind (existing)    | No change                                               |

---

## Turborepo Vision: `opencode-vibe` (Deferred)

The ideal architecture separates the **service layer** from the **UI layer** completely. This enables:

1. **Multiple UIs** - Web, Desktop (Tauri), CLI, VSCode extension all share the same service layer
2. **Independent versioning** - SDK can evolve separately from UI
3. **Better testing** - Service layer can be tested without UI
4. **Framework agnostic** - Swap SolidJS for React without touching service code

**Note:** We're starting with a simpler structure (see below) and will migrate to full Turborepo when patterns stabilize.

### Initial Structure (Simplified)

**Decision:** Start with a single Next.js app (`apps/web/`) containing extraction-ready folders. These folders are organized as future packages but co-located for faster iteration. When patterns stabilize, we'll extract them into the packages/ directory.

```
opencode-vibe/
├── apps/
│   └── web/                     # Next.js 16 app
│       ├── src/
│       │   ├── core/            # Extraction-ready → @opencode/core
│       │   │   ├── client.ts    # SDK client factory
│       │   │   ├── events.ts    # SSE subscription + event types
│       │   │   ├── session.ts   # Session operations
│       │   │   ├── message.ts   # Message operations
│       │   │   ├── provider.ts  # AI provider management
│       │   │   └── types.ts     # Re-exported from SDK
│       │   │
│       │   ├── react/           # Extraction-ready → @opencode/react
│       │   │   ├── hooks/
│       │   │   │   ├── useSession.ts
│       │   │   │   ├── useMessages.ts
│       │   │   │   ├── useSSE.ts
│       │   │   │   └── useProvider.ts
│       │   │   └── context/
│       │   │       └── OpencodeProvider.tsx
│       │   │
│       │   ├── ui/              # Extraction-ready → @opencode/ui
│       │   │   ├── chat/
│       │   │   ├── code/
│       │   │   └── diff/
│       │   │
│       │   └── app/             # Next.js App Router
│       │       ├── layout.tsx
│       │       ├── page.tsx
│       │       └── session/[id]/page.tsx
│       │
│       └── package.json
│
└── package.json
```

**Benefits:**

- **Faster development** - No package boundary friction during initial build
- **Easier refactoring** - Move files freely without crossing package boundaries
- **Clear extraction path** - When core/ stabilizes → extract to packages/core/
- **Familiar patterns** - Standard Next.js src/ structure, no Turborepo complexity yet
- **Future-proof** - Folder structure maps 1:1 to future packages/

**Extraction Triggers:**

We'll extract to `packages/` when:

1. **Pattern stability** - API surface hasn't changed in 2+ weeks
2. **External reuse** - Need to consume from desktop app, CLI, or VSCode extension
3. **Independent versioning** - Core needs to evolve separately from web UI
4. **Team growth** - Multiple teams working on different UI surfaces

---

## Service Layer Deep Dive

### SDK Architecture

The OpenCode SDK is **generated from OpenAPI 3.1.1 spec** via `@hey-api/openapi-ts`. This is the source of truth for all types.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SDK GENERATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  OpenAPI Spec (packages/sdk/openapi.json)                           │
│       │                                                              │
│       ▼  @hey-api/openapi-ts                                        │
│  Generated Types (packages/sdk/js/src/gen/types.gen.ts)             │
│       │                                                              │
│       ▼                                                              │
│  Generated Client (packages/sdk/js/src/gen/client.gen.ts)           │
│       │                                                              │
│       ▼                                                              │
│  SDK Wrapper (packages/sdk/js/src/gen/sdk.gen.ts)                   │
│       │  ← Namespaced classes (Session, Provider, etc.)             │
│       ▼                                                              │
│  Public API (packages/sdk/js/src/client.ts)                         │
│       │  ← createOpencodeClient() factory                           │
│       ▼                                                              │
│  Consumer (packages/app/, packages/web/, etc.)                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### SDK Client Factory

**File:** `packages/sdk/js/src/client.ts`

```typescript
export function createOpencodeClient(config?: Config & { directory?: string }) {
  // Custom fetch with no timeout (long-running AI operations)
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      req.timeout = false;
      return fetch(req);
    };
    config = { ...config, fetch: customFetch };
  }

  // Directory header for instance scoping
  if (config?.directory) {
    config.headers = {
      ...config.headers,
      "x-opencode-directory": config.directory,
    };
  }

  const client = createClient(config);
  return new OpencodeClient({ client });
}
```

**Key Points:**

- **No timeout** on requests - AI operations can run for minutes
- **Directory scoping** via `x-opencode-directory` header
- **Wraps generated client** from openapi-fetch

### SDK Namespaces (15 Total)

**File:** `packages/sdk/js/src/gen/sdk.gen.ts` (1198 lines)

```typescript
export class OpencodeClient extends _HeyApiClient {
  global = new Global({ client: this._client }); // Health, events, dispose
  project = new Project({ client: this._client }); // List, current, update
  pty = new Pty({ client: this._client }); // Terminal sessions
  config = new Config({ client: this._client }); // Get/update config
  tool = new Tool({ client: this._client }); // List tools, schemas
  instance = new Instance({ client: this._client }); // Dispose instance
  path = new Path({ client: this._client }); // Get paths
  vcs = new Vcs({ client: this._client }); // Git info
  session = new Session({ client: this._client }); // CRUD, messages, prompt
  command = new Command({ client: this._client }); // List commands
  provider = new Provider({ client: this._client }); // List, OAuth
  find = new Find({ client: this._client }); // Text, file, symbol search
  file = new File({ client: this._client }); // List, read, status
  app = new App({ client: this._client }); // Log, agents
  mcp = new Mcp({ client: this._client }); // MCP server management
  lsp = new Lsp({ client: this._client }); // LSP status
  formatter = new Formatter({ client: this._client }); // Formatter status
  tui = new Tui({ client: this._client }); // TUI commands
  auth = new Auth({ client: this._client }); // Set auth tokens
  event = new Event({ client: this._client }); // SSE subscription
}
```

### Session Namespace (Primary API)

The `session` namespace is the most important - it handles all conversation operations:

```typescript
class Session extends _HeyApiClient {
  // CRUD
  list(); // GET /session
  create(body); // POST /session
  get(id); // GET /session/{id}
  update(id, body); // PATCH /session/{id}
  delete(id); // DELETE /session/{id}

  // Messaging
  messages(id, limit?); // GET /session/{id}/message
  prompt(id, body); // POST /session/{id}/message (streaming)
  promptAsync(id, body); // POST /session/{id}/prompt_async (fire-and-forget)
  message(id, messageID); // GET /session/{id}/message/{messageID}

  // Operations
  fork(id, messageID?); // POST /session/{id}/fork
  abort(id); // POST /session/{id}/abort
  share(id); // POST /session/{id}/share
  unshare(id); // DELETE /session/{id}/share
  summarize(id, body); // POST /session/{id}/summarize
  revert(id, body); // POST /session/{id}/revert
  unrevert(id); // POST /session/{id}/unrevert

  // Metadata
  status(); // GET /session/status
  diff(id, messageID?); // GET /session/{id}/diff
  todo(id); // GET /session/{id}/todo
  children(id); // GET /session/{id}/children
  init(id, body); // POST /session/{id}/init

  // Commands
  command(id, body); // POST /session/{id}/command
  shell(id, body); // POST /session/{id}/shell
}
```

### Message Types

**File:** `packages/sdk/js/src/gen/types.gen.ts`

```typescript
// Message info (metadata)
type Message = {
  id: string; // "msg_..."
  sessionID: string; // "ses_..."
  role: "user" | "assistant";
  time: {
    created: number;
    updated: number;
  };
  // User-specific
  agent?: string;
  // Assistant-specific
  model?: { providerID: string; modelID: string };
  tokens?: { input: number; output: number; reasoning: number };
  cost?: { input: number; output: number };
  system?: string;
};

// Message parts (content)
type Part =
  | TextPart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | StepStartPart
  | StepFinishPart
  | SourceUrlPart;

type TextPart = {
  type: "text";
  id: string;
  messageID: string;
  sessionID: string;
  text: string;
  time: { created: number; updated: number };
};

type ToolCallPart = {
  type: "tool-call";
  id: string;
  messageID: string;
  sessionID: string;
  toolCallId: string;
  toolName: string;
  state: "pending" | "running" | "completed" | "error";
  args: Record<string, unknown>;
  time: { created: number; updated: number };
};

type ToolResultPart = {
  type: "tool-result";
  id: string;
  messageID: string;
  sessionID: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
  time: { created: number; updated: number };
};
```

### Prompt Input Schema

```typescript
type SessionPromptInput = {
  messageID?: string; // Optional: continue from specific message
  model?: { providerID: string; modelID: string };
  agent?: string;
  noReply?: boolean; // Don't wait for AI response
  tools?: Record<string, boolean>; // Enable/disable specific tools
  system?: string; // Override system prompt
  parts: Array<
    | { type: "text"; text: string }
    | { type: "file"; url: string; filename: string; mime: string }
    | { type: "agent"; agent: string }
    | { type: "subtask"; subtask: string }
  >;
};
```

---

## Real-Time Sync (SSE)

### SSE Endpoint

**Endpoint:** `GET /global/event`

**Backend:** `packages/opencode/src/server/server.ts:219-284`

```typescript
.get("/global/event", async (c) => {
  return streamSSE(c, async (stream) => {
    // Initial connection event
    stream.writeSSE({
      data: JSON.stringify({
        payload: { type: "server.connected", properties: {} },
      }),
    })

    // Subscribe to global event bus
    async function handler(event: any) {
      await stream.writeSSE({ data: JSON.stringify(event) })
    }
    GlobalBus.on("event", handler)

    // Heartbeat every 30s (prevents WKWebView 60s timeout)
    const heartbeat = setInterval(() => {
      stream.writeSSE({
        data: JSON.stringify({
          payload: { type: "server.heartbeat", properties: {} },
        }),
      })
    }, 30000)

    // Cleanup on disconnect
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        GlobalBus.off("event", handler)
        resolve()
      })
    })
  })
})
```

### Event Types

```typescript
type GlobalEvent = {
  directory: string; // Project directory or "global"
  payload: // Server lifecycle
    | { type: "server.connected"; properties: {} }
    | { type: "server.heartbeat"; properties: {} }
    | { type: "global.disposed"; properties: {} }
    | { type: "server.instance.disposed"; properties: { directory: string } }

    // Project
    | { type: "project.updated"; properties: Project }

    // Session
    | { type: "session.updated"; properties: { info: Session } }
    | {
        type: "session.diff";
        properties: { sessionID: string; diff: FileDiff[] };
      }
    | {
        type: "session.status";
        properties: { sessionID: string; status: SessionStatus };
      }

    // Messages
    | { type: "message.updated"; properties: { info: Message } }
    | {
        type: "message.removed";
        properties: { sessionID: string; messageID: string };
      }
    | { type: "message.part.updated"; properties: { part: Part } }
    | {
        type: "message.part.removed";
        properties: { messageID: string; partID: string };
      }

    // Todos
    | {
        type: "todo.updated";
        properties: { sessionID: string; todos: Todo[] };
      };
};
```

### Client-Side SSE Subscription

**Current (SolidJS):** `packages/app/src/context/global-sdk.tsx`

```typescript
const eventSdk = createOpencodeClient({ baseUrl: props.url });
const emitter = createGlobalEmitter<{ [key: string]: Event }>();

eventSdk.global.event().then(async (events) => {
  for await (const event of events.stream) {
    emitter.emit(event.directory ?? "global", event.payload);
  }
});
```

**Proposed (React):** `packages/react/src/hooks/useSSE.ts`

```typescript
export function useSSE(baseUrl: string) {
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Map<string, Set<(event: Event) => void>>());

  useEffect(() => {
    const client = createOpencodeClient({ baseUrl });
    let aborted = false;

    async function connect() {
      const events = await client.global.event();
      setConnected(true);

      for await (const event of events.stream) {
        if (aborted) break;
        const directory = event.directory ?? "global";
        listeners.current.get(directory)?.forEach((fn) => fn(event.payload));
      }
    }

    connect().catch(() => setConnected(false));
    return () => {
      aborted = true;
    };
  }, [baseUrl]);

  const subscribe = useCallback(
    (directory: string, fn: (event: Event) => void) => {
      if (!listeners.current.has(directory)) {
        listeners.current.set(directory, new Set());
      }
      listeners.current.get(directory)!.add(fn);
      return () => listeners.current.get(directory)?.delete(fn);
    },
    [],
  );

  return { connected, subscribe };
}
```

---

## State Synchronization

### Current State Shape

**File:** `packages/app/src/context/global-sync.tsx`

```typescript
type State = {
  ready: boolean;
  agent: Agent[];
  command: Command[];
  project: string; // Current project ID
  provider: ProviderListResponse;
  config: Config;
  path: Path;
  session: Session[]; // Sorted by ID
  session_status: { [sessionID: string]: SessionStatus };
  session_diff: { [sessionID: string]: FileDiff[] };
  todo: { [sessionID: string]: Todo[] };
  mcp: { [name: string]: McpStatus };
  lsp: LspStatus[];
  limit: number; // Session load limit (default: 5)
  message: { [sessionID: string]: Message[] }; // Sorted by ID
  part: { [messageID: string]: Part[] }; // Sorted by ID
};
```

### Binary Search for Sorted Arrays

All arrays are kept sorted by ID for O(log n) lookups:

```typescript
import { Binary } from "@opencode-ai/util/binary";

// Update or insert session
const result = Binary.search(
  store.session,
  event.properties.info.id,
  (s) => s.id,
);
if (result.found) {
  setStore("session", result.index, reconcile(event.properties.info));
} else {
  setStore(
    "session",
    produce((draft) => {
      draft.splice(result.index, 0, event.properties.info);
    }),
  );
}
```

### Proposed React State Management

Instead of a monolithic store, use React Query + Zustand:

```typescript
// packages/react/src/hooks/useSession.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSSE } from "./useSSE";

export function useSession(sessionID: string) {
  const client = useOpencodeClient();
  const queryClient = useQueryClient();
  const { subscribe } = useSSE();

  // Fetch session data
  const { data: session } = useQuery({
    queryKey: ["session", sessionID],
    queryFn: () => client.session.get({ path: { id: sessionID } }),
  });

  // Fetch messages
  const { data: messages } = useQuery({
    queryKey: ["messages", sessionID],
    queryFn: () => client.session.messages({ path: { id: sessionID } }),
  });

  // Real-time updates
  useEffect(() => {
    return subscribe(session?.directory ?? "", (event) => {
      if (
        event.type === "message.updated" &&
        event.properties.info.sessionID === sessionID
      ) {
        queryClient.setQueryData(["messages", sessionID], (old: Message[]) => {
          // Binary insert/update
          return upsertSorted(old, event.properties.info, (m) => m.id);
        });
      }
    });
  }, [sessionID, subscribe]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: (parts: PromptPart[]) =>
      client.session.prompt({ path: { id: sessionID }, body: { parts } }),
  });

  return { session, messages, sendMessage };
}
```

---

## Backend Service Layer

### AsyncLocalStorage DI Pattern

**File:** `packages/opencode/src/util/context.ts`

```typescript
import { AsyncLocalStorage } from "async_hooks";

export namespace Context {
  export class NotFound extends Error {
    constructor(public override readonly name: string) {
      super(`No context found for ${name}`);
    }
  }

  export function create<T>(name: string) {
    const storage = new AsyncLocalStorage<T>();
    return {
      use() {
        const result = storage.getStore();
        if (!result) throw new NotFound(name);
        return result;
      },
      provide<R>(value: T, fn: () => R) {
        return storage.run(value, fn);
      },
    };
  }
}
```

### Instance Management

**File:** `packages/opencode/src/project/instance.ts`

```typescript
interface Context {
  directory: string;
  worktree: string;
  project: Project.Info;
}

const context = Context.create<Context>("instance");
const cache = new Map<string, Promise<Context>>();

export const Instance = {
  async provide<R>(input: {
    directory: string;
    init?: () => Promise<any>;
    fn: () => R;
  }): Promise<R> {
    let existing = cache.get(input.directory);
    if (!existing) {
      existing = (async () => {
        const project = await Project.fromDirectory(input.directory);
        const ctx = {
          directory: input.directory,
          worktree: project.worktree,
          project,
        };
        await context.provide(ctx, async () => {
          await input.init?.();
        });
        return ctx;
      })();
      cache.set(input.directory, existing);
    }
    const ctx = await existing;
    return context.provide(ctx, async () => input.fn());
  },

  get directory() {
    return context.use().directory;
  },
  get worktree() {
    return context.use().worktree;
  },
  get project() {
    return context.use().project;
  },

  async dispose() {
    await State.dispose(Instance.directory);
    cache.delete(Instance.directory);
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload: {
        type: "server.instance.disposed",
        properties: { directory: Instance.directory },
      },
    });
  },
};
```

### Request Middleware

**File:** `packages/opencode/src/server/server.ts:315-324`

```typescript
.use(async (c, next) => {
  const directory =
    c.req.query("directory") ||
    c.req.header("x-opencode-directory") ||
    process.cwd()

  return Instance.provide({
    directory,
    init: InstanceBootstrap,
    async fn() {
      return next()
    },
  })
})
```

---

## Integration Examples

### Creating a Session and Sending a Message

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk/client";

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
  directory: "/path/to/project",
  throwOnError: true,
});

// Create session
const session = await client.session.create({
  body: { title: "My Session" },
});

// Send message with file attachment
const response = await client.session.prompt({
  path: { id: session.data!.id },
  body: {
    parts: [
      { type: "text", text: "Explain this codebase" },
      {
        type: "file",
        url: "file:///path/to/file.ts",
        filename: "file.ts",
        mime: "text/plain",
      },
    ],
  },
});

console.log(response.data!.info.id); // Assistant message ID
console.log(response.data!.parts); // Message parts (text, tool calls, etc.)
```

### Subscribing to Real-Time Events

```typescript
const eventClient = createOpencodeClient({ baseUrl: "http://localhost:4096" });

const events = await eventClient.global.event();

for await (const event of events.stream) {
  console.log(event.directory, event.payload.type);

  switch (event.payload.type) {
    case "message.updated":
      console.log("New message:", event.payload.properties.info);
      break;
    case "message.part.updated":
      console.log("Part updated:", event.payload.properties.part);
      break;
    case "session.status":
      console.log("Status:", event.payload.properties.status);
      break;
  }
}
```

### Directory-Scoped Operations

```typescript
// Global client (no directory)
const globalClient = createOpencodeClient({ baseUrl: "http://localhost:4096" });
const projects = await globalClient.project.list();

// Directory-scoped client
const projectClient = createOpencodeClient({
  baseUrl: "http://localhost:4096",
  directory: "/path/to/project",
});

const sessions = await projectClient.session.list();
const config = await projectClient.config.get();
const agents = await projectClient.app.agents();
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OPENCODE-VIBE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                   apps/web/ (Next.js 16+ App)                          │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    src/app/ (App Router)                         │ │ │
│  │  │                                                                  │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │ │
│  │  │  │ Server       │  │ Client       │  │ Server Actions       │  │ │ │
│  │  │  │ Components   │  │ Components   │  │                      │  │ │ │
│  │  │  │              │  │              │  │ • sendMessage()      │  │ │ │
│  │  │  │ • Layout     │  │ • ChatUI     │  │ • createSession()    │  │ │ │
│  │  │  │ • SessionList│  │ • CodeViewer │  │ • updateSession()    │  │ │ │
│  │  │  │ • MessageList│  │ • DiffViewer │  │ • subscribeToEvents()│  │ │ │
│  │  │  │              │  │ • ScrollFAB  │  │                      │  │ │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │        src/react/ (Extraction-ready → @opencode/react)          │ │ │
│  │  │                                                                  │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │ │
│  │  │  │ Hooks        │  │ Context      │  │ Utilities            │  │ │ │
│  │  │  │              │  │              │  │                      │  │ │ │
│  │  │  │ • useSession │  │ • OpenCode   │  │ • upsertSorted()     │  │ │ │
│  │  │  │ • useMessages│  │   Provider   │  │ • binarySearch()     │  │ │ │
│  │  │  │ • useSSE     │  │              │  │ • reconcile()        │  │ │ │
│  │  │  │ • useProvider│  │              │  │                      │  │ │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │         src/core/ (Extraction-ready → @opencode/core)           │ │ │
│  │  │                                                                  │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │ │
│  │  │  │ Client       │  │ Events       │  │ Types                │  │ │ │
│  │  │  │              │  │              │  │                      │  │ │ │
│  │  │  │ • createClient│ │ • SSE stream │  │ • Session            │  │ │ │
│  │  │  │ • 15 spaces  │  │ • Event types│  │ • Message            │  │ │ │
│  │  │  │ • 83 endpoints│ │ • Reconnect  │  │ • Part               │  │ │ │
│  │  │  │              │  │              │  │ • Provider           │  │ │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │          src/ui/ (Extraction-ready → @opencode/ui)              │ │ │
│  │  │                                                                  │ │ │
│  │  │  • chat/        - Chat components (ai-elements wrappers)        │ │ │
│  │  │  • code/        - Code viewers, syntax highlighting             │ │ │
│  │  │  • diff/        - Diff viewers                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                   SDK LAYER (@opencode-ai/sdk)                         │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ Generated from OpenAPI 3.1.1 via @hey-api/openapi-ts            │  │ │
│  │  │                                                                 │  │ │
│  │  │ • types.gen.ts    - All TypeScript types                        │  │ │
│  │  │ • client.gen.ts   - Low-level fetch client                      │  │ │
│  │  │ • sdk.gen.ts      - Namespaced SDK classes                      │  │ │
│  │  │ • client.ts       - createOpencodeClient() factory              │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    BACKEND (packages/opencode)                         │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │ │
│  │  │ Hono Server     │  │ Instance DI     │  │ Services                │ │ │
│  │  │                 │  │                 │  │                         │ │ │
│  │  │ • Routes        │  │ • AsyncLocal    │  │ • Session               │ │ │
│  │  │ • SSE stream    │  │   Storage       │  │ • Message               │ │ │
│  │  │ • Middleware    │  │ • Per-directory │  │ • Provider              │ │ │
│  │  │ • Validation    │  │   caching       │  │ • Tool                  │ │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Matrix: Fix vs Rebuild

| Criterion                         | Fix Current                | Rebuild                   | Winner  |
| --------------------------------- | -------------------------- | ------------------------- | ------- |
| **Time to resolve provider hell** | 4-6 weeks (risky refactor) | 2-3 weeks (greenfield)    | Rebuild |
| **Mobile UX improvements**        | Partial (pattern mismatch) | Complete (React patterns) | Rebuild |
| **Code reduction**                | 10-15%                     | 30-40%                    | Rebuild |
| **Team velocity post-fix**        | Moderate (still complex)   | High (simpler patterns)   | Rebuild |
| **Risk of regression**            | High (touching core)       | Low (new codebase)        | Rebuild |
| **Reuse ai-elements**             | Requires porting           | Native support            | Rebuild |
| **Hiring/onboarding**             | Harder (SolidJS niche)     | Easier (React ubiquitous) | Rebuild |
| **Preserve existing code**        | 100%                       | ~20% (SDK, utils)         | Fix     |

**Verdict:** Rebuild wins on 6/7 criteria. The 30-40% code reduction alone justifies the effort.

---

## Consequences

### Positive

1. **Reduced Complexity** - Flat component hierarchy vs 13-level provider nesting
2. **Better Mobile UX** - React patterns (hooks, effects) map naturally to scroll behavior
3. **Faster Development** - ai-elements eliminates chat UI boilerplate
4. **Easier Maintenance** - Smaller codebase (30-40% reduction), clearer data flow
5. **Better Hiring** - React is 10x more common than SolidJS
6. **Server-Side Rendering** - RSC enables better performance and SEO
7. **Type Safety** - Server Actions provide end-to-end type safety
8. **Framework Agnostic Core** - Service layer can be reused across UIs

### Negative

1. **Rewrite Effort** - ~3-4 weeks of development (mitigated by code reduction)
2. **Learning Curve** - Team needs to learn Next.js 16 patterns (RSC, Server Actions)
3. **Temporary Feature Freeze** - Can't ship new features during rebuild
4. **Testing Gaps** - New codebase needs comprehensive test coverage
5. **Dependency on ai-elements** - Adds external dependency (but well-maintained)

### Risks & Mitigations

| Risk                           | Probability | Impact | Mitigation                                          |
| ------------------------------ | ----------- | ------ | --------------------------------------------------- |
| **SSE integration complexity** | Medium      | High   | Prototype SSE + Server Actions early (Phase 2)      |
| **ai-elements API changes**    | Low         | Medium | Pin version, monitor releases, maintain fallback    |
| **Performance regression**     | Low         | Medium | Benchmark before/after, use Next.js profiling tools |
| **Mobile issues persist**      | Low         | High   | Test on real devices during Phase 4                 |
| **SDK integration breaks**     | Low         | Medium | Comprehensive integration tests, SDK versioning     |

---

## Implementation Plan

### Phase 1: Scaffold & Basic Session View (Week 1)

- [ ] Create Next.js 16 project at `apps/web/`
- [ ] Set up Tailwind, TypeScript, ESLint
- [ ] Create `apps/web/src/core/` folder with SDK re-exports (extraction-ready)
- [ ] Create `apps/web/src/react/` folder with hooks (extraction-ready)
- [ ] Create `apps/web/src/ui/` folder for shared components (extraction-ready)
- [ ] Implement layout hierarchy in `apps/web/src/app/` (no provider nesting)
- [ ] Create session list page (RSC)
- [ ] Create session detail page with ai-elements ChatUI
- [ ] **Deliverable:** Basic session view, no real-time sync

### Phase 2: Real-Time Sync via SSE (Week 2)

- [ ] Implement `useSSE` hook with reconnection
- [ ] Create Server Actions for SDK calls
- [ ] Implement message streaming (new messages appear in real-time)
- [ ] Handle part updates (tool calls, results)
- [ ] Add session status updates
- [ ] **Deliverable:** Real-time sync working, messages update live

### Phase 3: Full Feature Parity (Week 3)

- [ ] Implement all session features (agents, commands, etc.)
- [ ] Add code/diff viewers (migrate or use ai-elements)
- [ ] Implement file operations (if applicable)
- [ ] Add search/filtering
- [ ] Implement theme switching
- [ ] Add provider management UI
- [ ] **Deliverable:** Feature-complete, all existing features working

### Phase 4: Mobile-First Polish (Week 4)

- [ ] Fix auto-scroll on session load (React effect timing)
- [ ] Add scroll-to-bottom FAB
- [ ] Responsive design for mobile (single code path)
- [ ] Test on real devices (iOS Safari, Android Chrome)
- [ ] Performance optimization (Core Web Vitals)
- [ ] **Deliverable:** Mobile UX issues resolved, ship to production

### Success Criteria

- [ ] All 5 mobile UX issues resolved
- [ ] Code size reduced by 30-40% (measured in bundle size)
- [ ] Real-time sync latency ≤ 100ms (same as current)
- [ ] 95%+ test coverage for critical paths
- [ ] Lighthouse score ≥ 90 (all categories)
- [ ] Zero regressions in existing functionality
- [ ] Team comfortable with Next.js patterns

---

## Gotchas & Surprises

⚠️ **No timeout on SDK requests** - `req.timeout = false` in client factory. Long-running AI operations can hang indefinitely.

🔄 **Dual SDK instances** - GlobalSDKProvider creates TWO clients: one for SSE (no timeout), one for requests (10min timeout).

💀 **No auth tokens** - Directory header is the only "auth". Anyone with localhost access can read/write any project.

🤔 **Binary search everywhere** - State updates use binary search for sorted arrays. Assumes IDs are sortable (they are - ULIDs).

⚠️ **SSE heartbeat required** - 30s heartbeat prevents WKWebView timeout (60s default). Without it, mobile Safari disconnects.

🔄 **Instance caching** - `Instance.provide()` caches per directory. Dispose required to clear cache.

💀 **No database** - All data in filesystem (`~/.local/state/opencode/`). No migrations, no transactions.

🤔 **Event bus is global** - `GlobalBus.emit()` broadcasts to ALL connected clients. No per-client filtering.

⚠️ **Session limit** - UI only loads 5 sessions by default + any updated in last 4 hours. Older sessions not loaded until explicitly requested.

---

## References

### Source Files

| File                                        | Lines | Purpose                               |
| ------------------------------------------- | ----- | ------------------------------------- |
| `packages/sdk/openapi.json`                 | 4000+ | OpenAPI 3.1.1 spec (source of truth)  |
| `packages/sdk/js/src/gen/sdk.gen.ts`        | 1198  | Generated SDK with namespaced classes |
| `packages/sdk/js/src/gen/types.gen.ts`      | 2000+ | Generated TypeScript types            |
| `packages/sdk/js/src/client.ts`             | 31    | Client factory with directory scoping |
| `packages/opencode/src/server/server.ts`    | 2500+ | Hono server with all routes           |
| `packages/opencode/src/util/context.ts`     | 26    | AsyncLocalStorage DI pattern          |
| `packages/opencode/src/project/instance.ts` | 79    | Per-directory instance management     |
| `packages/app/src/context/global-sync.tsx`  | 403   | SolidJS state sync (god object)       |
| `packages/app/src/context/global-sdk.tsx`   | 35    | SolidJS SDK provider                  |

### Technology Stack

- **Next.js 16+** - https://nextjs.org/docs
- **React Server Components** - https://react.dev/reference/rsc/server-components
- **ai-elements** - https://github.com/vercel-labs/ai-elements
- **@hey-api/openapi-ts** - https://heyapi.dev/
- **Hono** - https://hono.dev/
- **AsyncLocalStorage** - https://nodejs.org/api/async_context.html

---

## Questions for Discussion

1. **Timeline:** Is 4 weeks realistic given team capacity? Should we phase this differently?
2. **ai-elements Dependency:** Are we comfortable depending on a Vercel Labs project? What's the maintenance story?
3. **Feature Freeze:** Can we pause new features during the rebuild, or do we need parallel development?
4. **Testing Strategy:** Should we do TDD (write tests first) or test after implementation?
5. **Rollback Plan:** If rebuild stalls, do we have a fallback to SolidJS?
6. **Turborepo:** Should we set up `opencode-vibe` as a separate repo or a workspace in the existing monorepo?

---

## Approval

- [ ] Architecture Lead
- [ ] Team Lead
- [ ] Product Lead

---

## Changelog

| Date       | Author     | Change                                           |
| ---------- | ---------- | ------------------------------------------------ |
| 2025-12-26 | Joel Hooks | Initial proposal                                 |
| 2025-12-27 | Joel Hooks | Added service layer deep dive, SDK documentation |
