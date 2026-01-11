# @opencode-vibe/core

```
                            ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ███████╗
                           ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝
                    ████╗  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║   ██║██║  ██║█████╗
                    ╚═══╝  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║   ██║██║  ██║██╔══╝
                           ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗╚██████╔╝██████╔╝███████╗
                            ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝

                           ██╗   ██╗██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ███████╗
                           ██║   ██║██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
                    ████╗  ██║   ██║██║██████╔╝█████╗      ██║     ██║   ██║██████╔╝█████╗
                    ╚═══╝  ╚██╗ ██╔╝██║██╔══██╗██╔══╝      ██║     ██║   ██║██╔══██╗██╔══╝
                            ╚████╔╝ ██║██████╔╝███████╗    ╚██████╗╚██████╔╝██║  ██║███████╗
                             ╚═══╝  ╚═╝╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝

                                    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                                    ┃     T H E   E N G I N E   C O R E     ┃
                                    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

The OpenCode engine. **Core owns computation, React binds UI.**

Everything you need to integrate OpenCode—from push-based reactive streams to simple Promise APIs.

---

## Architecture: World Stream (ADR-018)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONSUMER APIs (No Effect Required)                                         │
│  ├── subscribe(callback) → unsubscribe                                      │
│  ├── getSnapshot() → Promise<WorldState>                                    │
│  └── [Symbol.asyncIterator] → for await...of                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  WORLD STORE (effect-atom)                                                  │
│  ├── sessionsAtom, messagesAtom, partsAtom, statusAtom                      │
│  └── worldAtom (derived, always consistent)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  UNIFIED STREAMING LAYER (merged-stream.ts)                                 │
│  ├── SSE events (WorldSSE)                                                  │
│  ├── Pluggable event sources (SwarmDb, Git, etc.)                           │
│  └── Stream.mergeAll combines sources → atoms update → subscribers notified │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The Pattern:** Events from multiple sources flow in, atoms update, subscribers get notified. No polling. No stale data. Push-based reactivity with pluggable sources.

---

## Quick Start

### Install

```bash
bun add @opencode-vibe/core @opencode-ai/sdk
```

---

## Three APIs: Pick Your Style

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                       │
│   WORLD STREAM             PROMISE API                   EFFECT API                   │
│   ────────────             ───────────                   ──────────                   │
│                                                                                       │
│   stream.subscribe(...)    await sessions.list()         SessionAtom.list().pipe(...) │
│                                                                                       │
│   ✓ Real-time              ✓ Simple                      ✓ Composable                 │
│   ✓ Push-based             ✓ Familiar                    ✓ Type-safe errors           │
│   ✓ Reactive apps          ✓ One-shot queries            ✓ Testable                   │
│                                                                                       │
│   Web/CLI real-time  ────► Quick scripts  ────────────►  Power users                  │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## World Stream API (Primary)

**The recommended API for real-time applications.** Push-based reactive state via SSE.

```typescript
import { createWorldStream } from "@opencode-vibe/core/world"

const stream = createWorldStream({
  baseUrl: "http://localhost:1999",
})

// Subscribe to world updates (React, callbacks)
const unsubscribe = stream.subscribe((world) => {
  console.log(`${world.sessions.length} sessions`)
  console.log(`${world.activeSessionCount} active`)
  console.log(`Connection: ${world.connectionStatus}`)
})

// Or use async iterator (CLI/TUI)
for await (const world of stream) {
  render(world)
}

// Or get one-shot snapshot
const world = await stream.getSnapshot()

// Cleanup
await stream.dispose()
```

### WorldState Type

```typescript
interface WorldState {
  sessions: EnrichedSession[]      // Sessions with embedded messages, parts, status
  activeSessionCount: number       // Count of running sessions
  activeSession: EnrichedSession | null
  connectionStatus: "connecting" | "connected" | "disconnected" | "error"
  lastUpdated: number
}

interface EnrichedSession extends Session {
  status: SessionStatus
  isActive: boolean
  messages: EnrichedMessage[]
  unreadCount: number
  contextUsagePercent: number
  lastActivityAt: number
}

interface EnrichedMessage extends Message {
  parts: Part[]
  isStreaming: boolean
}
```

### CLI/TUI Usage (Direct Server Connection)

For CLI tools that need direct server connections (no proxy):

```typescript
import { resumeEventsDirect, type DiscoverServers } from "@opencode-vibe/core/world"
import { Stream, Effect } from "effect"

// Inject your own server discovery (e.g., lsof-based)
const discoverServers: DiscoverServers = async () => [
  { port: 4056, directory: "/path/to/project" }
]

// Durable streaming: catch-up + live events
const eventStream = resumeEventsDirect(discoverServers)

await Effect.runPromise(
  Stream.runForEach(eventStream, (event) =>
    Effect.sync(() => {
      if (event.upToDate) console.log("Caught up! Now live...")
      console.log(event.type, event.offset)
    })
  )
)
```

---

## Promise API (Simple)

For one-shot queries and quick scripts. No Effect knowledge required.

```typescript
import { sessions, messages, parts, providers, projects } from "@opencode-vibe/core"

// Sessions
const allSessions = await sessions.list("/path/to/project")
const session = await sessions.get("ses_123")

// Messages
const msgs = await messages.list("ses_123")
const msg = await messages.get("ses_123", "msg_456")

// Parts (tool calls, results, etc)
const partsList = await parts.list("ses_123", "msg_456")
const part = await parts.get("ses_123", "msg_456", "part_789")

// Providers (AI models)
const providersList = await providers.list()

// Projects
const projectsList = await projects.list()
const current = await projects.current()

// Servers (discovery)
const serversList = await servers.list()
```

All functions return `Promise<T>`. Use this for scripts, tests, and simple integrations.

---

## Effect API (Power Users)

Composable, testable, error handling built-in. For complex workflows and power users.

```typescript
import { SessionAtom, MessageAtom } from "@opencode-vibe/core/atoms"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const sessions = yield* SessionAtom.list("/path/to/project")
  const messages = yield* MessageAtom.list(sessions[0].id)
  return { session: sessions[0], messageCount: messages.length }
})

const result = await Effect.runPromise(program)
```

Effect gives you composability, typed errors, testability, and concurrency. See `@opencode-vibe/core/atoms` for the full Effect API.

---

## Data Model

```
                        ╭──────────────────────────────────────────────────────────╮
                        │                    DATA HIERARCHY                        │
                        ╰──────────────────────────────────────────────────────────╯

                                    ┌─────────────┐
                                    │   PROJECT   │
                                    │  /my/app    │
                                    └──────┬──────┘
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                   ┌────────────┐   ┌────────────┐   ┌────────────┐
                   │  SESSION   │   │  SESSION   │   │  SESSION   │
                   │  ses_001   │   │  ses_002   │   │  ses_003   │
                   └─────┬──────┘   └────────────┘   └────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │ MESSAGE  │ │ MESSAGE  │ │ MESSAGE  │
      │  user    │ │assistant │ │  user    │
      └────┬─────┘ └────┬─────┘ └──────────┘
           │            │
           ▼            ▼
      ┌─────────┐  ┌─────────┐
      │  PART   │  │  PART   │
      │  text   │  │  tool   │
      └─────────┘  └─────────┘
```

---

## Event Flow (Unified Streaming)

```
      ╔══════════════════════════════════════════════════════════════════════════╗
      ║                     UNIFIED EVENT SOURCES (Real-Time)                    ║
      ╠══════════════════════════════════════════════════════════════════════════╣
      ║                                                                          ║
      ║    ┌──────────┐                                   ┌──────────────┐       ║
      ║    │ OpenCode │         SSE Stream                │  Your App    │       ║
      ║    │  Server  │  ═══════════════════════════▶     │              │       ║
      ║    │  :1999   │    session.created                │  WorldState  │       ║
      ║    │          │    message.created               │  updates in  │       ║
      ║    └──────────┘    part.updated                   │  real-time!  │       ║
      ║                    session.status                 └──────────────┘       ║
      ║                                                                          ║
      ║    ┌──────────┐                                                          ║
      ║    │ SwarmDb  │         Event Stream                                      ║
      ║    │  (opt.)  │  ═══════════════════════════▶  (merged via Stream.mergeAll)
      ║    └──────────┘                                                          ║
      ║                                                                          ║
      ╚══════════════════════════════════════════════════════════════════════════╝
```

Events automatically flow to `worldAtom` via `merged-stream.ts`. Multiple sources are combined with `Stream.mergeAll`. No manual polling or refetching needed.

---

## Configuration

### Server URL

Connects to `http://localhost:1999` by default. Override with:

```typescript
// World Stream
const stream = createWorldStream({ baseUrl: "http://my-server:1999" })

// Environment variable (Promise/Effect APIs)
process.env.NEXT_PUBLIC_OPENCODE_URL = "http://my-server:1999"
```

### Directory Scoping

```typescript
// All sessions across all projects
const all = await sessions.list()

// Sessions for a specific project
const project = await sessions.list("/Users/joel/projects/myapp")
```

---

## Exports

```typescript
// World Stream (primary) - unified streaming with pluggable sources
import {
  createWorldStream,
  resumeEventsDirect,
  catchUpEventsDirect,
  tailEventsDirect,
  type WorldState,
  type EnrichedSession,
  type EnrichedMessage,
  type WorldStreamHandle,
  type MergedStreamConfig,
} from "@opencode-vibe/core/world"

// Atoms (effect-atom based state)
import {
  sessionsAtom,
  messagesAtom,
  partsAtom,
  statusAtom,
  worldAtom,
} from "@opencode-vibe/core/world"

// Event sources (for custom integrations)
import type {
  EventSource,
  SourceEvent,
} from "@opencode-vibe/core/world"

// Domain types
import type {
  Session,
  Message,
  Part,
  Provider,
  Project,
  GlobalEvent,
} from "@opencode-vibe/core"
```

---

## Architecture Notes (ADR-016/018)

**Core owns computation, React binds UI.** This is the smart boundary pattern.

- **Core Layer:** Fetching, caching, unified streaming (SSE + pluggable sources), state computation
- **React Layer:** Subscribes to `WorldState`, renders UI, handles interactions

The World Stream is THE API. React hooks in `@opencode-vibe/react` subscribe to the stream and expose it via idiomatic React patterns. CLI tools use the async iterator directly. The unified streaming layer (`merged-stream.ts`) combines multiple event sources (SSE, SwarmDb, etc.) into a single consistent world state.

```
┌─────────────────────────────────────────────┐
│  React Layer (@opencode-vibe/react)         │
│  └── useWorldStream() → WorldState          │
├─────────────────────────────────────────────┤
│  Core Layer (@opencode-vibe/core)           │  ◄── You are here
│  └── createWorldStream() → WorldStreamHandle │
├─────────────────────────────────────────────┤
│  SDK Layer (@opencode-ai/sdk)               │
│  └── HTTP client, type-safe API calls       │
└─────────────────────────────────────────────┘
```

---

## License

```
  ███╗   ███╗██╗████████╗
  ████╗ ████║██║╚══██╔══╝
  ██╔████╔██║██║   ██║
  ██║╚██╔╝██║██║   ██║
  ██║ ╚═╝ ██║██║   ██║
  ╚═╝     ╚═╝╚═╝   ╚═╝
```
