# @opencode-vibe/react API Design

**Date**: 2025-12-29  
**Status**: Draft (HISTORICAL - Zustand store was removed)  
**Cell**: opencode-next--xts0a-mjrn4xxpf95  
**Epic**: opencode-next--xts0a-mjrn4xx251c

> **Historical Note (2026-01-01)**: This design doc describes the Zustand-based architecture.
> The store was removed in commit 8e40992. References to `useDeferredValue` are outdated.
> Current implementation uses jotai atoms with direct Core API calls.

---

## Executive Summary

This document defines the public API surface for `@opencode-vibe/react`, a React bindings package for the OpenCode router. It provides:

- **Providers** for SSE connections and router context
- **Hooks** for data access (Zustand selectors) and actions (router callers)
- **Store** for real-time state management
- **Types** for full TypeScript integration

**Key Design Decisions:**

1. **Zustand store is internal** - Exposed only via hooks, not directly
2. **Binary search utilities are internal** - Performance optimization, not API
3. **Atoms are excluded** - Phase 1 interim pattern, may change with effect-atom
4. **Router dependency is explicit** - Requires `@opencode-vibe/router`

---

## 1. Package Structure

### Directory Layout

```
packages/react/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── providers/
│   │   ├── index.ts                # Provider exports
│   │   ├── opencode-provider.tsx   # OpencodeProvider
│   │   └── sse-provider.tsx        # SSEProvider
│   ├── hooks/
│   │   ├── index.ts                # Hook exports
│   │   ├── use-opencode.ts         # Context hook
│   │   ├── use-sse.ts              # SSE context hook
│   │   ├── use-session.ts          # Session selector
│   │   ├── use-messages.ts         # Messages selector
│   │   ├── use-session-status.ts   # Status selector
│   │   ├── use-compaction-state.ts # Compaction selector
│   │   ├── use-context-usage.ts    # Context usage selector
│   │   ├── use-messages-with-parts.ts # Derived messages+parts
│   │   ├── use-send-message.ts     # Send message action
│   │   ├── use-create-session.ts   # Create session action
│   │   ├── use-providers.ts        # Provider list action
│   │   ├── use-file-search.ts      # File search action
│   │   ├── use-commands.ts         # Commands list action
│   │   └── use-multi-server-sse.ts # Multi-server SSE
│   ├── store/
│   │   ├── index.ts                # Store exports (internal)
│   │   ├── store.ts                # Zustand store
│   │   └── binary.ts               # Binary search utilities
│   └── types/
│       ├── index.ts                # Type exports
│       ├── session.ts              # Session types
│       ├── message.ts              # Message types
│       ├── provider.ts             # Provider types
│       └── events.ts               # SSE event types
├── package.json
├── tsconfig.json
└── README.md
```

### Entry Points

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./providers": {
      "types": "./dist/providers/index.d.mts",
      "import": "./dist/providers/index.mjs"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.mts",
      "import": "./dist/hooks/index.mjs"
    },
    "./types": {
      "types": "./dist/types/index.d.mts",
      "import": "./dist/types/index.mjs"
    }
  }
}
```

### Module Responsibilities

| Module       | Responsibility                             |
| ------------ | ------------------------------------------ |
| `providers/` | React context providers for SSE and router |
| `hooks/`     | All public hooks (selectors + actions)     |
| `store/`     | Internal Zustand store (not exported)      |
| `types/`     | TypeScript interfaces and types            |

---

## 2. Provider API

### OpencodeProvider

**Purpose**: Bootstrap OpenCode connection, provide router caller, manage SSE subscriptions

```tsx
import { OpencodeProvider } from "@opencode-vibe/react";

interface OpencodeProviderProps {
  /** Base URL of OpenCode server (e.g., "http://localhost:4056") */
  url: string;

  /** Project directory for scoping (e.g., "/Users/joel/Code/project") */
  directory: string;

  /** Optional: Pre-hydrated sessions for RSC (prevents flash) */
  initialSessions?: Session[];

  /** Optional: Pre-hydrated messages for RSC */
  initialMessages?: Record<string, Message[]>;

  /** Children components */
  children: React.ReactNode;
}

// Usage
<OpencodeProvider url="http://localhost:4056" directory="/path/to/project">
  <App />
</OpencodeProvider>;
```

**Context Value**:

```ts
interface OpencodeContextValue {
  /** Base URL of connected server */
  url: string;

  /** Current project directory */
  directory: string;

  /** Whether initial data has loaded */
  ready: boolean;

  /** Manual sync trigger for a session */
  sync: (sessionId: string) => Promise<void>;

  /** Router caller for invoking routes */
  caller: Caller;
}
```

**Internal Behavior**:

1. Creates SDK client via `createClient(directory)`
2. Creates router caller via `createCaller(router, { sdk })`
3. Subscribes to SSE events via `useSSE()`
4. Routes events to Zustand store via `store.handleSSEEvent()`
5. Loads initial sessions on mount
6. Syncs session data (messages, parts, todos) on session events

### SSEProvider

**Purpose**: Manage SSE connection lifecycle, provide subscription API

```tsx
import { SSEProvider } from "@opencode-vibe/react";

interface SSEProviderProps {
  /** SSE endpoint URL */
  url: string;

  /** Optional: Reconnection config */
  reconnect?: {
    /** Initial delay in ms (default: 3000) */
    initialDelay?: number;
    /** Max delay in ms (default: 30000) */
    maxDelay?: number;
    /** Backoff multiplier (default: 2) */
    backoff?: number;
  };

  /** Optional: Heartbeat timeout in ms (default: 60000) */
  heartbeatTimeout?: number;

  /** Children components */
  children: React.ReactNode;
}

// Usage
<SSEProvider url="http://localhost:4056">
  <OpencodeProvider url="http://localhost:4056" directory="/path">
    <App />
  </OpencodeProvider>
</SSEProvider>;
```

**Context Value**:

```ts
interface SSEContextValue {
  /** Whether SSE is connected */
  connected: boolean;

  /** Subscribe to SSE events */
  subscribe: (
    eventType: string | "*",
    callback: (event: GlobalEvent) => void,
  ) => () => void; // Returns unsubscribe function

  /** Force reconnection */
  reconnect: () => void;

  /** Last error (if any) */
  error: Error | null;
}
```

**Internal Behavior**:

1. Fetch-based SSE connection (not EventSource - better control)
2. Exponential backoff reconnection (3s → 30s cap)
3. Heartbeat monitoring (60s timeout = 2x server heartbeat)
4. Event batching (16ms = 1 frame @ 60fps)
5. Visibility API support (pause when backgrounded)

### Provider Composition

**Recommended hierarchy**:

```tsx
// app/layout.tsx
import { SSEProvider, OpencodeProvider } from "@opencode-vibe/react";

export default function RootLayout({ children }) {
  return (
    <SSEProvider url={process.env.OPENCODE_URL}>
      <OpencodeProvider
        url={process.env.OPENCODE_URL}
        directory={process.env.PROJECT_DIR}
      >
        {children}
      </OpencodeProvider>
    </SSEProvider>
  );
}
```

**Why nested?**

- SSEProvider manages connection lifecycle (singleton)
- OpencodeProvider consumes SSE and routes to store
- Multiple OpencodeProviders can share one SSEProvider (multi-project)

---

## 3. Hook API

### Context Hooks

#### useOpencode

**Purpose**: Access OpenCode context (directory, caller, sync)

```ts
import { useOpencode } from '@opencode-vibe/react'

function useOpencode(): OpencodeContextValue

// Usage
function MyComponent() {
  const { directory, caller, ready, sync } = useOpencode()

  if (!ready) return <Loading />

  return <div>Project: {directory}</div>
}
```

#### useSSE

**Purpose**: Access SSE context (connection status, subscribe)

```ts
import { useSSE } from '@opencode-vibe/react'

function useSSE(): SSEContextValue

// Usage
function MyComponent() {
  const { connected, subscribe, error } = useSSE()

  useEffect(() => {
    const unsubscribe = subscribe('message.updated', (event) => {
      console.log('Message updated:', event)
    })
    return unsubscribe
  }, [subscribe])

  return <div>SSE: {connected ? 'Connected' : 'Disconnected'}</div>
}
```

### Data Hooks (Zustand Selectors)

These hooks read from the internal Zustand store. Updates happen automatically via SSE.

#### useSession

**Purpose**: Get a single session by ID

```ts
import { useSession } from '@opencode-vibe/react'

function useSession(sessionId: string): Session | undefined

// Usage
function SessionHeader({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId)

  if (!session) return null
  return <h1>{session.title || 'Untitled'}</h1>
}
```

#### useSessions

**Purpose**: Get all sessions for current directory

```ts
import { useSessions } from '@opencode-vibe/react'

function useSessions(): Session[]

// Usage
function SessionList() {
  const sessions = useSessions()

  return (
    <ul>
      {sessions.map(s => <li key={s.id}>{s.title}</li>)}
    </ul>
  )
}
```

#### useMessages

**Purpose**: Get messages for a session

```ts
import { useMessages } from '@opencode-vibe/react'

function useMessages(sessionId: string): Message[]

// Usage
function MessageList({ sessionId }: { sessionId: string }) {
  const messages = useMessages(sessionId)

  return (
    <div>
      {messages.map(m => <MessageItem key={m.id} message={m} />)}
    </div>
  )
}
```

#### useMessagesWithParts

**Purpose**: Get messages with their parts (derived state)

```ts
import { useMessagesWithParts } from '@opencode-vibe/react'

interface MessageWithParts {
  id: string
  role: 'user' | 'assistant'
  parts: Part[]
  // ... other message fields
}

function useMessagesWithParts(sessionId: string): MessageWithParts[]

// Usage
function ChatView({ sessionId }: { sessionId: string }) {
  const messages = useMessagesWithParts(sessionId)

  return (
    <div>
      {messages.map(m => (
        <Message key={m.id} role={m.role}>
          {m.parts.map(p => <Part key={p.id} part={p} />)}
        </Message>
      ))}
    </div>
  )
}
```

**Note**: Uses `useDeferredValue` internally for performance during rapid SSE updates.

#### useSessionStatus

**Purpose**: Get session running status

```ts
import { useSessionStatus } from '@opencode-vibe/react'

interface SessionStatusResult {
  /** Whether session is currently running */
  running: boolean
  /** Raw status value */
  status: 'running' | 'completed' | 'error' | 'cancelled'
}

function useSessionStatus(sessionId: string): SessionStatusResult

// Usage
function SessionIndicator({ sessionId }: { sessionId: string }) {
  const { running, status } = useSessionStatus(sessionId)

  return (
    <span className={running ? 'animate-pulse' : ''}>
      {status}
    </span>
  )
}
```

#### useCompactionState

**Purpose**: Get context compaction state

```ts
import { useCompactionState } from '@opencode-vibe/react'

interface CompactionState {
  isCompacting: boolean
  isAutomatic: boolean
  progress: number  // 0-100
  startedAt: number | null
}

function useCompactionState(sessionId: string): CompactionState

// Usage
function CompactionIndicator({ sessionId }: { sessionId: string }) {
  const { isCompacting, progress } = useCompactionState(sessionId)

  if (!isCompacting) return null
  return <ProgressBar value={progress} />
}
```

#### useContextUsage

**Purpose**: Get context window usage

```ts
import { useContextUsage } from '@opencode-vibe/react'

interface ContextUsageState {
  /** Tokens used */
  used: number
  /** Token limit */
  limit: number
  /** Usage percentage (0-100) */
  percentage: number
  /** Whether near limit (>80%) */
  isNearLimit: boolean
  /** Formatted token count (e.g., "156.0k") */
  tokens: string
}

function useContextUsage(sessionId: string): ContextUsageState

// Usage
function ContextMeter({ sessionId }: { sessionId: string }) {
  const { percentage, tokens, isNearLimit } = useContextUsage(sessionId)

  return (
    <div className={isNearLimit ? 'text-red-500' : ''}>
      {tokens} ({percentage}%)
    </div>
  )
}
```

### Action Hooks (Router Callers)

These hooks invoke routes via the router caller.

#### useSendMessage

**Purpose**: Send messages to a session with FIFO queuing

```ts
import { useSendMessage } from '@opencode-vibe/react'

interface UseSendMessageOptions {
  sessionId: string
}

interface UseSendMessageReturn {
  /** Send a message (queued if session is busy) */
  sendMessage: (parts: PromptPart[]) => Promise<void>
  /** Whether currently sending */
  isLoading: boolean
  /** Last error (if any) */
  error: Error | null
  /** Number of queued messages */
  queueLength: number
}

function useSendMessage(options: UseSendMessageOptions): UseSendMessageReturn

// Usage
function PromptInput({ sessionId }: { sessionId: string }) {
  const { sendMessage, isLoading, queueLength } = useSendMessage({ sessionId })

  const handleSubmit = async (text: string) => {
    await sendMessage([{ type: 'text', text }])
  }

  return (
    <form onSubmit={handleSubmit}>
      <input disabled={isLoading} />
      {queueLength > 0 && <span>{queueLength} queued</span>}
    </form>
  )
}
```

**Behavior**:

- First message sends immediately (fire-and-forget)
- Subsequent messages queue until session becomes idle
- Detects slash commands and routes to `session.command`
- Monitors session status via SSE

#### useCreateSession

**Purpose**: Create a new session

```ts
import { useCreateSession } from '@opencode-vibe/react'

interface UseCreateSessionReturn {
  /** Create a new session */
  createSession: (title?: string) => Promise<Session>
  /** Whether currently creating */
  isLoading: boolean
  /** Last error (if any) */
  error: Error | null
}

function useCreateSession(): UseCreateSessionReturn

// Usage
function NewSessionButton() {
  const { createSession, isLoading } = useCreateSession()

  const handleClick = async () => {
    const session = await createSession('My Session')
    router.push(`/session/${session.id}`)
  }

  return (
    <button onClick={handleClick} disabled={isLoading}>
      New Session
    </button>
  )
}
```

#### useProviders

**Purpose**: Get available AI providers

```ts
import { useProviders } from '@opencode-vibe/react'

interface Provider {
  id: string
  name: string
  models: Model[]
}

interface Model {
  id: string
  name: string
}

interface UseProvidersReturn {
  providers: Provider[]
  isLoading: boolean
  error: Error | null
}

function useProviders(): UseProvidersReturn

// Usage
function ProviderSelector() {
  const { providers, isLoading } = useProviders()

  if (isLoading) return <Loading />

  return (
    <select>
      {providers.map(p => (
        <optgroup key={p.id} label={p.name}>
          {p.models.map(m => (
            <option key={m.id} value={`${p.id}/${m.id}`}>
              {m.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
```

#### useFileSearch

**Purpose**: Search files in project directory

```ts
import { useFileSearch } from '@opencode-vibe/react'

interface UseFileSearchOptions {
  /** Search query */
  query: string
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number
}

interface UseFileSearchReturn {
  /** Matching file paths */
  files: string[]
  /** Whether searching */
  isLoading: boolean
  /** Last error (if any) */
  error: Error | null
}

function useFileSearch(options: UseFileSearchOptions): UseFileSearchReturn

// Usage
function FileAutocomplete({ query }: { query: string }) {
  const { files, isLoading } = useFileSearch({ query, debounceMs: 200 })

  return (
    <ul>
      {files.map(f => <li key={f}>{f}</li>)}
    </ul>
  )
}
```

**Behavior**:

- Debounced search (default 300ms)
- Fuzzy matching via `fuzzysort`
- Returns top 10 matches

#### useCommands

**Purpose**: Get available slash commands

```ts
import { useCommands } from '@opencode-vibe/react'

interface SlashCommand {
  name: string
  description: string
  type: 'builtin' | 'custom'
}

interface UseCommandsReturn {
  /** All commands (builtin + custom) */
  commands: SlashCommand[]
  /** Get commands matching prefix */
  getSlashCommands: (prefix: string) => SlashCommand[]
  /** Find command by name */
  findCommand: (name: string) => SlashCommand | undefined
  /** Whether loading */
  isLoading: boolean
  /** Last error */
  error: Error | null
}

function useCommands(): UseCommandsReturn

// Usage
function CommandAutocomplete({ prefix }: { prefix: string }) {
  const { getSlashCommands } = useCommands()
  const matches = getSlashCommands(prefix)

  return (
    <ul>
      {matches.map(c => (
        <li key={c.name}>/{c.name} - {c.description}</li>
      ))}
    </ul>
  )
}
```

**Builtin Commands**:

- `/new` - New session
- `/share` - Share session
- `/compact` - Compact context

### Multi-Server Hook

#### useMultiServerSSE

**Purpose**: Subscribe to SSE from all running OpenCode servers

```ts
import { useMultiServerSSE } from '@opencode-vibe/react'

function useMultiServerSSE(): void

// Usage (typically in root layout)
function RootLayout({ children }) {
  useMultiServerSSE()  // Side-effect only
  return <>{children}</>
}
```

**Behavior**:

- Discovers running OpenCode servers via `/api/opencode-servers`
- Maintains SSE connections to all servers
- Routes events to store based on directory
- Singleton pattern (only one instance runs)

---

## 4. Store API

### Design Decision: Internal Store

**The Zustand store is NOT exported.** Consumers interact via hooks only.

**Rationale**:

1. **Encapsulation** - Store shape can change without breaking API
2. **Gotcha prevention** - Avoids `useOpencodeStore()` infinite loop pattern
3. **Consistency** - All access goes through hooks with proper selectors

### Internal Store Shape

```ts
// NOT EXPORTED - internal only
interface OpencodeStore {
  directories: {
    [directory: string]: {
      ready: boolean;
      sessions: Session[];
      sessionStatus: Record<string, SessionStatus>;
      sessionDiff: Record<string, FileDiff[]>;
      todos: Record<string, Todo[]>;
      messages: Record<string, Message[]>;
      parts: Record<string, Part[]>;
      contextUsage: Record<string, ContextUsage>;
      compaction: Record<string, CompactionState>;
      modelLimits: Record<string, { context: number; output: number }>;
    };
  };

  // Actions
  initDirectory: (directory: string) => void;
  handleSSEEvent: (event: GlobalEvent) => void;
  handleEvent: (directory: string, event: EventPayload) => void;
  setSessions: (directory: string, sessions: Session[]) => void;
  setMessages: (
    directory: string,
    sessionId: string,
    messages: Message[],
  ) => void;
  setParts: (directory: string, messageId: string, parts: Part[]) => void;
  hydrateMessages: (
    directory: string,
    sessionId: string,
    messages: Message[],
  ) => void;
  // ... more actions
}
```

### Binary Search Utilities

**Internal only** - Used for O(log n) operations on sorted arrays.

```ts
// NOT EXPORTED - internal only
namespace Binary {
  function search<T>(
    arr: T[],
    id: string,
    getId: (item: T) => string,
  ): SearchResult;
  function insert<T>(arr: T[], item: T, getId: (item: T) => string): T[];
  function update<T>(arr: T[], index: number, item: T): T[];
  function remove<T>(arr: T[], index: number): T[];
}
```

**Why internal?**

- Performance optimization detail
- Assumes ULID-sorted arrays
- Not useful outside store context

---

## 5. Atoms API

### Design Decision: Exclude Atoms

**Atoms are NOT included in the public API.**

**Rationale**:

1. **Phase 1 interim** - Current atoms wrap SDK calls, may change with effect-atom
2. **Dual state management** - Atoms + Zustand is confusing for consumers
3. **SSE integration** - Atoms require SSE event prop, awkward API
4. **Future migration** - effect-atom will have different API

**What stays in app**:

- `atoms/sse.ts` - Effect.Stream SSE (experimental)
- `atoms/sessions.ts` - SDK wrapper with SSE invalidation
- `atoms/messages.ts` - SDK wrapper with binary search updates
- `atoms/parts.ts` - SDK wrapper
- `atoms/providers.ts` - SDK wrapper
- `atoms/projects.ts` - SDK wrapper
- `atoms/servers.ts` - Multi-server discovery
- `atoms/subagents.ts` - Subagent state

**Future**: When effect-atom stabilizes, consider `@opencode-vibe/react/atoms` subpath.

---

## 6. Router Integration

### Dependency on Router Package

```json
{
  "dependencies": {
    "@opencode-vibe/router": "workspace:*"
  }
}
```

### Caller Creation Pattern

**Inside OpencodeProvider**:

```ts
import { createRouter, createCaller } from '@opencode-vibe/router'
import { createRoutes } from '@opencode-vibe/router/routes'

function OpencodeProvider({ url, directory, children }) {
  const callerRef = useRef<Caller | null>(null)

  // Create caller once
  if (!callerRef.current) {
    const routes = createRoutes()
    const router = createRouter(routes)
    const sdk = createClient(url, directory)
    callerRef.current = createCaller(router, { sdk })
  }

  return (
    <OpencodeContext.Provider value={{ caller: callerRef.current, ... }}>
      {children}
    </OpencodeContext.Provider>
  )
}
```

### Route Invocation from Hooks

**Action hooks use caller from context**:

```ts
function useSendMessage({ sessionId }) {
  const { caller } = useOpencode()

  const sendMessage = useCallback(async (parts: PromptPart[]) => {
    await caller('session.promptAsync', {
      sessionId,
      parts,
    })
  }, [caller, sessionId])

  return { sendMessage, ... }
}
```

### SDK Client Creation

**SDK client is created internally, not exposed**:

```ts
// Internal to OpencodeProvider
import { createOpencodeClient } from "@opencode-ai/sdk/client";

function createClient(url: string, directory: string) {
  return createOpencodeClient({
    baseUrl: url,
    headers: {
      "x-opencode-directory": directory,
    },
  });
}
```

**Why not expose?**

- SDK is OpenCode-specific
- Router abstracts SDK calls
- Consumers use hooks, not SDK directly

---

## 7. package.json

```json
{
  "name": "@opencode-vibe/react",
  "version": "0.1.0",
  "type": "module",
  "description": "React bindings for OpenCode router",
  "author": "Joel Hooks",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/joelhooks/swarmtools.git",
    "directory": "packages/react"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./providers": {
      "types": "./dist/providers/index.d.mts",
      "import": "./dist/providers/index.mjs"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.mts",
      "import": "./dist/hooks/index.mjs"
    },
    "./types": {
      "types": "./dist/types/index.d.mts",
      "import": "./dist/types/index.mjs"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --no-splitting",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opencode-vibe/router": "workspace:*",
    "zustand": "^5.0.0",
    "immer": "^10.0.0",
    "eventsource-parser": "^3.0.0",
    "fuzzysort": "^3.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "tsup": "^8.0.0"
  }
}
```

### Dependency Rationale

| Dependency                     | Why                        |
| ------------------------------ | -------------------------- |
| `@opencode-vibe/router` | Router caller, route types |
| `zustand`                      | Reactive state management  |
| `immer`                        | Immutable updates in store |
| `eventsource-parser`           | SSE parsing                |
| `fuzzysort`                    | File search fuzzy matching |
| `react` (peer)                 | React 18+ or 19+           |

### Why NOT Dependencies

| Package            | Why Excluded                          |
| ------------------ | ------------------------------------- |
| `effect`           | Transitive via router, not direct dep |
| `@opencode-ai/sdk` | Internal to router, not exposed       |

---

## 8. TypeScript Config

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

### Key Settings

| Setting                    | Value       | Why                       |
| -------------------------- | ----------- | ------------------------- |
| `jsx`                      | `react-jsx` | React 17+ JSX transform   |
| `moduleResolution`         | `bundler`   | Modern resolution for ESM |
| `verbatimModuleSyntax`     | `true`      | Explicit type imports     |
| `noUncheckedIndexedAccess` | `true`      | Safer array access        |

---

## 9. Public API Summary

### Main Entry (`@opencode-vibe/react`)

```ts
// Providers
export { OpencodeProvider, SSEProvider } from "./providers";
export type { OpencodeProviderProps, SSEProviderProps } from "./providers";
export type { OpencodeContextValue, SSEContextValue } from "./providers";

// Context Hooks
export { useOpencode, useSSE } from "./hooks";

// Data Hooks (Selectors)
export { useSession, useSessions } from "./hooks";
export { useMessages, useMessagesWithParts } from "./hooks";
export { useSessionStatus } from "./hooks";
export { useCompactionState } from "./hooks";
export { useContextUsage } from "./hooks";

// Action Hooks
export { useSendMessage } from "./hooks";
export { useCreateSession } from "./hooks";
export { useProviders } from "./hooks";
export { useFileSearch } from "./hooks";
export { useCommands } from "./hooks";

// Multi-Server
export { useMultiServerSSE } from "./hooks";

// Types
export type { Session, Message, Part } from "./types";
export type {
  SessionStatus,
  CompactionState,
  ContextUsageState,
} from "./types";
export type { Provider, Model, SlashCommand } from "./types";
export type { UseSendMessageOptions, UseSendMessageReturn } from "./types";
export type { UseCreateSessionReturn, UseProvidersReturn } from "./types";
export type { UseFileSearchOptions, UseFileSearchReturn } from "./types";
export type { UseCommandsReturn } from "./types";
export type { GlobalEvent, EventPayload } from "./types";
```

### Subpath Exports

**`@opencode-vibe/react/providers`**:

```ts
export { OpencodeProvider, SSEProvider };
export type { OpencodeProviderProps, SSEProviderProps };
export type { OpencodeContextValue, SSEContextValue };
```

**`@opencode-vibe/react/hooks`**:

```ts
// All hooks
export { useOpencode, useSSE };
export { useSession, useSessions, useMessages, useMessagesWithParts };
export { useSessionStatus, useCompactionState, useContextUsage };
export { useSendMessage, useCreateSession, useProviders };
export { useFileSearch, useCommands };
export { useMultiServerSSE };
```

**`@opencode-vibe/react/types`**:

```ts
// All types (no runtime exports)
export type { Session, Message, Part, ... }
```

---

## 10. Usage Examples

### Basic Setup

```tsx
// app/layout.tsx
import { SSEProvider, OpencodeProvider } from "@opencode-vibe/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SSEProvider url="http://localhost:4056">
          <OpencodeProvider
            url="http://localhost:4056"
            directory="/Users/joel/Code/project"
          >
            {children}
          </OpencodeProvider>
        </SSEProvider>
      </body>
    </html>
  );
}
```

### Session Page

```tsx
// app/session/[id]/page.tsx
import {
  useSession,
  useMessagesWithParts,
  useSendMessage,
  useSessionStatus,
  useContextUsage,
} from "@opencode-vibe/react";

export default function SessionPage({ params }) {
  const session = useSession(params.id);
  const messages = useMessagesWithParts(params.id);
  const { sendMessage, isLoading } = useSendMessage({ sessionId: params.id });
  const { running } = useSessionStatus(params.id);
  const { percentage, tokens } = useContextUsage(params.id);

  if (!session) return <NotFound />;

  return (
    <div>
      <header>
        <h1>{session.title}</h1>
        <span>{running ? "Running..." : "Idle"}</span>
        <span>
          {tokens} ({percentage}%)
        </span>
      </header>

      <main>
        {messages.map((m) => (
          <Message key={m.id} role={m.role}>
            {m.parts.map((p) => (
              <Part key={p.id} part={p} />
            ))}
          </Message>
        ))}
      </main>

      <footer>
        <PromptInput
          onSubmit={(text) => sendMessage([{ type: "text", text }])}
          disabled={isLoading}
        />
      </footer>
    </div>
  );
}
```

### Multi-Server Discovery

```tsx
// app/layout.tsx
import { useMultiServerSSE } from '@opencode-vibe/react'

function MultiServerSync() {
  useMultiServerSSE()  // Side-effect: discovers and connects to all servers
  return null
}

export default function RootLayout({ children }) {
  return (
    <SSEProvider url="http://localhost:4056">
      <OpencodeProvider ...>
        <MultiServerSync />
        {children}
      </OpencodeProvider>
    </SSEProvider>
  )
}
```

---

## 11. Testing Strategy

### Hook Testing

```ts
// use-session.test.ts
import { renderHook } from '@testing-library/react'
import { useSession } from '@opencode-vibe/react'
import { MockOpencodeProvider } from './test-utils'

describe('useSession', () => {
  it('returns session from store', () => {
    const mockSession = { id: 'ses_123', title: 'Test' }

    const { result } = renderHook(
      () => useSession('ses_123'),
      { wrapper: ({ children }) => (
        <MockOpencodeProvider sessions={[mockSession]}>
          {children}
        </MockOpencodeProvider>
      )}
    )

    expect(result.current).toEqual(mockSession)
  })

  it('returns undefined for missing session', () => {
    const { result } = renderHook(
      () => useSession('nonexistent'),
      { wrapper: MockOpencodeProvider }
    )

    expect(result.current).toBeUndefined()
  })
})
```

### Provider Testing

```ts
// opencode-provider.test.tsx
import { render, waitFor } from '@testing-library/react'
import { OpencodeProvider, useOpencode } from '@opencode-vibe/react'
import { mockSSEProvider, mockRouter } from './test-utils'

describe('OpencodeProvider', () => {
  it('provides caller to children', async () => {
    let contextValue: OpencodeContextValue | null = null

    function Consumer() {
      contextValue = useOpencode()
      return null
    }

    render(
      <mockSSEProvider>
        <OpencodeProvider url="http://test" directory="/test">
          <Consumer />
        </OpencodeProvider>
      </mockSSEProvider>
    )

    await waitFor(() => {
      expect(contextValue?.caller).toBeDefined()
      expect(contextValue?.directory).toBe('/test')
    })
  })
})
```

### Test Utilities

```ts
// test-utils.tsx
export function MockOpencodeProvider({
  children,
  sessions = [],
  messages = {},
}) {
  // Pre-populate store with test data
  return (
    <OpencodeContext.Provider value={mockContextValue}>
      {children}
    </OpencodeContext.Provider>
  )
}

export function MockSSEProvider({ children }) {
  return (
    <SSEContext.Provider value={mockSSEContextValue}>
      {children}
    </SSEContext.Provider>
  )
}
```

---

## 12. Known Gotchas

### 1. Zustand Store Reference Pattern

**Problem**: `useOpencodeStore()` returns new reference every render

**Solution**: Store is internal, hooks use `getState()` pattern

```ts
// Internal to hooks - consumers don't see this
const getStoreActions = () => useOpencodeStore.getState();

useEffect(() => {
  getStoreActions().initDirectory(directory);
}, [directory]);
```

### 2. useDeferredValue Lag

**Problem**: `useMessagesWithParts` lags during rapid SSE updates

**Reality**: Expected behavior - prevents UI blocking

**Documentation**: Note in hook JSDoc that updates may lag 1-2 frames

### 3. Immer New References

**Problem**: Every store update creates new object references

**Mitigation**: Hooks use `useShallow` where appropriate

```ts
// Internal to hooks
const compaction = useOpencodeStore(
  useShallow((state) => state.directories[directory]?.compaction[sessionId]),
);
```

### 4. SSE Connection Singleton

**Problem**: Multiple SSEProviders would create multiple connections

**Solution**: SSEProvider is designed for single instance at root

**Documentation**: Note in README that only one SSEProvider should exist

---

## 13. Migration Path

### From Current App

**Before** (in `apps/web/`):

```ts
import { useSession } from "@/react/use-session";
import { OpencodeProvider } from "@/react/provider";
import { useOpencodeStore } from "@/react/store";
```

**After** (with extracted package):

```ts
import { useSession, OpencodeProvider } from "@opencode-vibe/react";
// useOpencodeStore is NOT exported - use hooks instead
```

### Breaking Changes

1. **Store not exported** - Use hooks instead of direct store access
2. **Binary utilities not exported** - Internal optimization
3. **Atoms not included** - Stay in app for now

### Gradual Migration

1. Install `@opencode-vibe/react`
2. Update imports one file at a time
3. Replace direct store access with hooks
4. Remove old `src/react/` files when done

---

## 14. Future Considerations

### effect-atom Integration

When `@effect-atom` stabilizes:

```ts
// Future: @opencode-vibe/react/atoms
export { sessionsAtom, messagesAtom, partsAtom };
export { useAtom, useAtomValue } from "@effect-atom/react";
```

### Server Components Support

For RSC data fetching:

```ts
// Future: Server-side data fetching
export async function getSession(id: string): Promise<Session>;
export async function getMessages(sessionId: string): Promise<Message[]>;
```

### Subagent Hooks

If subagent pattern stabilizes:

```ts
// Future: Subagent support
export { useSubagent, useSubagentSync };
export type { SubagentSession };
```

---

## Conclusion

`@opencode-vibe/react` provides a clean, hook-based API for React applications consuming the OpenCode router. Key design decisions:

1. **Hooks over store** - Encapsulates Zustand, prevents gotchas
2. **Providers for context** - SSE + router in composable hierarchy
3. **Types for safety** - Full TypeScript coverage
4. **Internal optimizations** - Binary search, batching hidden from consumers

**Ready for implementation** - Clear API surface, minimal breaking changes from current app.
