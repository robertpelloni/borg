# React Hooks and Atoms Inventory

**Research Date:** 2025-12-29  
**Purpose:** Comprehensive audit of React layer to inform ADR 005 - @joelhooks/swarmtools-react package extraction

> **Historical Note (2026-01-01)**: This inventory describes the Zustand-based architecture.
> The store was removed in commit 8e40992. References to `useDeferredValue` are outdated.
> Current implementation uses jotai atoms with direct Core API calls.

---

## Executive Summary

The React layer consists of **3 architectural tiers**:

1. **React Hooks** (`src/react/`) - 20+ hooks consuming core router and Zustand store
2. **Atoms** (`src/atoms/`) - 9 atom modules wrapping Effect services (migration from direct SDK)
3. **Stores** (`src/stores/`) - 2 Zustand stores for client-only state (prompt UI, subagents - deprecated)

**Key Finding:** The React layer has **dual state management** - Zustand store for real-time SSE state + atoms for on-demand SDK fetches. Hooks bridge both worlds.

---

## 1. React Hooks (`src/react/`)

### 1.1 Core Provider Infrastructure

#### `provider.tsx` - OpencodeProvider

**Dependencies:**

- `@/core/client` (SDK factory)
- `@/core/router` (Effect router for calling routes)
- `./store` (Zustand store)
- `./use-sse` (SSE subscription)

**Responsibilities:**

- Bootstrap: Load initial sessions + statuses via SDK
- SSE Integration: Subscribe to 17 event types, route to store
- Sync: Per-session data fetch (messages, parts, todos, diffs)
- Context: Provides `{ url, directory, ready, sync, caller }`

**State Management:**

- Uses Zustand `useOpencodeStore` for all directory-scoped state
- Uses Effect `createCaller` to invoke routes with SDK context
- **CRITICAL:** Uses `getState()` pattern to avoid infinite loops in effects

**Pattern:**

```tsx
const getStoreActions = () => useOpencodeStore.getState();

useEffect(() => {
  getStoreActions().initDirectory(directory); // Stable ref
}, [directory]);
```

#### `store.ts` - Zustand Store with Immer

**Type:** Central state store, directory-scoped  
**Dependencies:** `@/lib/binary` for O(log n) operations, Zustand + Immer

**State Shape:**

```ts
directories: {
  [directory]: {
    ready: boolean
    sessions: Session[]              // Sorted by ID
    sessionStatus: Record<string, SessionStatus>
    sessionDiff: Record<string, FileDiff[]>
    todos: Record<string, Todo[]>
    messages: Record<string, Message[]>  // By session ID
    parts: Record<string, Part[]>        // By message ID
    contextUsage: Record<string, ContextUsage>
    compaction: Record<string, CompactionState>
    modelLimits: Record<string, { context, output }>
  }
}
```

**Core Methods:**

- `handleEvent(directory, event)` - Central SSE dispatcher (17 event types)
- `handleSSEEvent(globalEvent)` - Wrapper for SSE integration
- `setSessions/setMessages/setParts` - Bulk setters with sorting
- `addSession/updateSession/removeSession` - Binary search CRUD
- `hydrateMessages()` - RSC initial data (prevents "blink" on load)

**Side Effects:** None (pure state container)

**Binary Search Pattern:**

```ts
const result = Binary.search(dir.sessions, id, (s) => s.id);
if (result.found) {
  dir.sessions[result.index] = newSession;
} else {
  dir.sessions.splice(result.index, 0, newSession);
}
```

#### `use-sse.tsx` - SSE Connection Manager

**Type:** Context provider + hook  
**Dependencies:** `eventsource-parser/stream`, `@/atoms/sse` (atom integration flag)

**Responsibilities:**

- Fetch-based SSE connection with exponential backoff (3s → 30s cap)
- Heartbeat monitoring (60s timeout = 2x server heartbeat)
- Event batching (16ms = 1 frame @ 60fps) to reduce render thrashing
- Visibility API support (disconnect when backgrounded)

**Feature Flags:**

- `NEXT_PUBLIC_DEBUG_SSE=true` - Verbose logging with timing
- `NEXT_PUBLIC_USE_SSE_ATOM=true` - Use Effect.Stream atom (Phase 2b)

**Context API:**

```ts
const { subscribe, connected, reconnect } = useSSE();

subscribe("message.updated", (event: GlobalEvent) => {
  // Handle event
});
```

**Event Batching:**

- Batches rapid events (50-100ms intervals) to reduce re-renders
- Heartbeat events bypass batching (immediate)
- Diagnostic logging measures callback execution time (>5ms = slow)

---

### 1.2 Data Access Hooks (Zustand Selectors)

These hooks read from the Zustand store. Real-time updates happen automatically via OpencodeProvider's SSE subscription.

#### `use-session.ts`

**Dependencies:** `./store`, `./provider`  
**Pattern:** Binary search selector  
**Returns:** `Session | undefined`

```ts
export function useSession(sessionId: string): Session | undefined {
  const { directory } = useOpencode();
  return useOpencodeStore((state) => {
    const result = Binary.search(
      state.directories[directory].sessions,
      sessionId,
      (s) => s.id,
    );
    return result.found ? state.sessions[result.index] : undefined;
  });
}
```

**Also exports:** `useSessionList` from `@/atoms/sessions` (atoms pattern)

#### `use-messages.ts`

**Dependencies:** `./store`, `./provider`  
**Pattern:** Dictionary selector with empty fallback  
**Returns:** `Message[]`

```ts
const EMPTY_MESSAGES: Message[] = []; // Stable reference

export function useMessages(sessionId: string): Message[] {
  const { directory } = useOpencode();
  return useOpencodeStore(
    (state) =>
      state.directories[directory]?.messages[sessionId] || EMPTY_MESSAGES,
  );
}
```

**Why stable ref:** Prevents re-renders when no messages exist

#### `use-session-status.ts`

**Dependencies:** `./store`, `./provider`  
**Pattern:** Dictionary selector with default value  
**Returns:** `{ running: boolean, status: SessionStatus }`

```ts
export function useSessionStatus(sessionId: string) {
  const { directory } = useOpencode();
  const status = useOpencodeStore(
    (state) =>
      state.directories[directory]?.sessionStatus[sessionId] ?? "completed",
  );
  return { running: status === "running", status };
}
```

#### `use-compaction-state.ts`

**Dependencies:** `./store`, `./provider`, `zustand/react/shallow`  
**Pattern:** Nested object selector with `useShallow`  
**Returns:** `CompactionState`

```ts
export function useCompactionState(sessionId: string): CompactionState {
  const { directory } = useOpencode();
  return useOpencodeStore(
    useShallow((state) => {
      const compaction = state.directories[directory]?.compaction[sessionId];
      if (!compaction) return DEFAULT_STATE;
      return {
        isCompacting: compaction.isCompacting,
        isAutomatic: compaction.isAutomatic,
        progress: compaction.progress,
        startedAt: compaction.startedAt,
      };
    }),
  );
}
```

**Why useShallow:** Prevents re-renders when nested object values haven't changed

#### `use-context-usage.ts`

**Dependencies:** `./store`, `./provider`, `zustand/react/shallow`  
**Pattern:** Same as compaction (nested object with shallow comparison)  
**Returns:** `ContextUsageState` with `{ used, limit, percentage, isNearLimit, tokens }`

**Helper:** `formatTokens(n)` - Formats 156000 → "156.0k"

#### `use-messages-with-parts.ts`

**Dependencies:** `./store`, `./provider`, `useDeferredValue`  
**Pattern:** Derived state with intentional lag  
**Returns:** `{ id, role, parts }[]`

```ts
export function useMessagesWithParts(sessionId: string) {
  const { directory } = useOpencode();
  const messages = useOpencodeStore(
    (state) => state.directories[directory]?.messages[sessionId],
  );
  const deferredMessages = useDeferredValue(messages); // Intentional lag during rapid updates

  return useMemo(
    () =>
      deferredMessages.map((msg) => ({
        ...msg,
        parts: state.directories[directory]?.parts[msg.id] || [],
      })),
    [deferredMessages, directory],
  );
}
```

**Why defer:** Reduces UI blocking during rapid SSE part updates (100-500ms intervals)

---

### 1.3 Action Hooks (SDK Callers)

These hooks invoke Effect router routes. They use the `caller` from OpencodeProvider context.

#### `use-send-message.ts`

**Dependencies:** `./provider` (caller), `./use-session-status`, `./use-commands`, `@/lib/prompt-api`  
**Pattern:** FIFO queue with session status monitoring  
**Returns:** `{ sendMessage, isLoading, error, queueLength }`

**Behavior:**

- Client-side FIFO message queue
- First message sends immediately (fire-and-forget)
- Subsequent messages wait for session to become idle
- Session status tracked via SSE `session.status` events
- Slash command detection and routing

**Routes Invoked:**

- `session.promptAsync` - Regular prompts
- `session.command` - Custom slash commands (type: "custom")
- Builtin commands skipped (handled client-side)

**Queue Processing:**

```ts
// Auto-process when session becomes idle
useEffect(() => {
  if (!running && queueRef.current.length > 0 && !isProcessingRef.current) {
    processNext();
  }
}, [running, processNext]);
```

#### `use-create-session.ts`

**Dependencies:** `./provider` (caller)  
**Pattern:** Async action hook with loading/error states  
**Returns:** `{ createSession, isLoading, error }`

**Route:** `session.create`

#### `use-providers.ts`

**Dependencies:** `./provider` (caller)  
**Pattern:** Fetch on mount, transform response  
**Returns:** `{ providers: Provider[], isLoading, error }`

**Route:** `provider.list`

**Transformation:**

```ts
// API returns models as dictionary, we need array
const providers = response.all.map((p) => ({
  id: p.id,
  name: p.name,
  models: Object.entries(p.models).map(([id, model]) => ({
    id,
    name: model.name || id,
  })),
}));
```

#### `use-file-search.ts`

**Dependencies:** `./provider` (directory), `@/core/client`, `fuzzysort`  
**Pattern:** Debounced search with fuzzy filtering  
**Returns:** `{ files: string[], isLoading, error }`

**Route:** `find.files` (via SDK client, not caller)

**Debouncing:**

```ts
useEffect(() => {
  if (!query) return;
  const timeout = setTimeout(async () => {
    const client = createClient(directory);
    const response = await client.find.files({
      query: { query, dirs: "true" },
    });
    const fuzzyResults = fuzzysort.go(query, response.data ?? [], {
      limit: 10,
    });
    setFiles(fuzzyResults.map((r) => r.target));
  }, debounceMs);

  return () => clearTimeout(timeout);
}, [query, directory, debounceMs]);
```

#### `use-commands.ts`

**Dependencies:** `./provider` (caller)  
**Pattern:** Fetch custom commands, merge with builtins  
**Returns:** `{ commands, getSlashCommands, findCommand, loading, error }`

**Route:** `command.list`

**Builtin Commands:**

- `/new` - New session (mod+n)
- `/share` - Share session (mod+shift+s)
- `/compact` - Compact context

---

### 1.4 Multi-Server SSE

#### `use-multi-server-sse.ts`

**Dependencies:** `@/core/multi-server-sse`, `./store`  
**Pattern:** Singleton SSE subscription to ALL servers  
**Side Effect:** Discovers running OpenCode servers, subscribes to events

```ts
export function useMultiServerSSE() {
  useEffect(() => {
    multiServerSSE.start(); // Singleton - only starts once

    const unsubscribe = multiServerSSE.onEvent((event) => {
      const store = useOpencodeStore.getState();
      store.initDirectory(event.directory);
      store.handleEvent(event.directory, event.payload);
    });

    return unsubscribe; // Don't stop singleton, other components may need it
  }, []);
}
```

**Use Case:** Real-time updates from TUIs and other OpenCode processes

---

### 1.5 Subagent Hooks

#### `use-subagent.ts`

**Dependencies:** `@/stores/subagent-store`  
**Pattern:** Zustand store selector wrapper  
**Returns:** `{ subagent, isExpanded, toggleExpanded, hasSubagent, isRunning, isCompleted }`

**Note:** `subagent-store.ts` is deprecated in favor of `@/atoms/subagents.ts`

#### `use-subagent-sync.ts`

**Dependencies:** `@/atoms/subagents`, `./use-sse`, `./store`  
**Pattern:** SSE subscription for child session events  
**Side Effect:** Syncs subagent messages/parts from parent session SSE events

---

### 1.6 Utility Hooks

#### `use-live-time.ts`

**Pattern:** `setInterval` with cleanup  
**Returns:** `Date` that updates every second

#### `use-subscription.ts`

**Pattern:** Generic SSE subscription wrapper  
**Returns:** `void` (side-effect hook)

---

## 2. Atoms (`src/atoms/`)

**Migration Strategy:** Phase 1 = Wrap SDK in hooks, Phase 2 = Full effect-atom when @effect-atom ships

### 2.1 SSE Atom

#### `sse.ts` - Effect.Stream SSE Connection

**Type:** Atom with factory pattern  
**Dependencies:** Effect (`Stream`, `Schedule`, `Duration`)

**Exports:**

- `makeSSEAtom(config)` - Factory for injectable config (testing)
- `sseAtom` - Default instance (localhost:4056)
- `useSSEConnection(atom)` - Hook consuming atom

**Connection Lifecycle:**

```ts
makeEventSourceStream(url, createEventSource, heartbeatTimeout)
  → Stream.Stream<GlobalEvent, Error>
  → Stream.runForEach(stream, event => setState({ latestEvent: event }))
  → Auto-reconnect with exponential backoff (3s → 30s)
```

**State:**

```ts
interface SSEConnectionState {
  connected: boolean;
  latestEvent: GlobalEvent | null;
  error: Error | null;
  retryCount: number;
}
```

**Integration:** `use-sse.tsx` checks `NEXT_PUBLIC_USE_SSE_ATOM=true` to use atom vs fetch

---

### 2.2 Data Atoms (SDK Wrappers)

#### `sessions.ts`

**Pattern:** SDK fetch + SSE cache invalidation  
**Hook:** `useSessionList({ directory, sseEvent })`  
**Returns:** `{ sessions: Session[], loading, error }`

**Cache Invalidation:**

```ts
useEffect(() => {
  if (sseEvent?.payload.type.startsWith("session.")) {
    fetchSessions(); // Refetch when session.* events occur
  }
}, [sseEvent]);
```

#### `messages.ts`

**Pattern:** SDK fetch + binary search SSE updates  
**Hook:** `useMessages({ sessionId, directory, sseEvent })`  
**Returns:** `{ messages: Message[], loading, error }`

**Factory:** `makeMessagesAtom({ directory })` for testing

**SSE Handling:**

```ts
useEffect(() => {
  if (sseEvent?.payload.type === "message.updated") {
    const message = sseEvent.payload.properties.info;
    setMessages((prevMessages) => {
      const result = Binary.search(prevMessages, message.id, (m) => m.id);
      return result.found
        ? Binary.update(prevMessages, result.index, message)
        : Binary.insert(prevMessages, message, (m) => m.id);
    });
  }
}, [sseEvent]);
```

#### `parts.ts`

**Pattern:** Same as messages (binary search updates)  
**Hook:** `useMessageParts({ messageId, directory, sseEvent })`  
**Returns:** `{ parts: Part[], loading, error }`

**Factory:** `makePartsAtom({ directory })`

#### `providers.ts`

**Pattern:** SDK fetch on mount (no SSE)  
**Hook:** `useProviders({ directory })`  
**Returns:** `{ providers: Provider[], loading, error }`

#### `projects.ts`

**Pattern:** SDK fetch with current project selector  
**Hooks:**

- `useProjects({ directory })` → `{ projects, loading, error }`
- `useCurrentProject({ directory })` → `{ project, loading, error }`

---

### 2.3 Server Discovery Atom

#### `servers.ts`

**Pattern:** Multi-server discovery via mDNS/port scan  
**Hooks:**

- `useServers()` → `{ servers: ServerInfo[], loading, error }`
- `useCurrentServer()` → `{ server: ServerInfo, loading, error }`

**Integrates with:** `@/core/multi-server-sse`

---

### 2.4 Subagents Atom

#### `subagents.ts`

**Type:** Replacement for `stores/subagent-store.ts`  
**Pattern:** Plain React state (no Zustand)  
**Hook:** `useSubagents()`

**Returns:**

```ts
{
  sessions: Record<string, SubagentSession>
  partToSession: Record<string, string>
  registerSubagent(childSessionId, parentSessionId, parentPartId, agentName)
  updateParentPartId(childSessionId, parentPartId)
  addMessage(sessionId, message)
  updateMessage(sessionId, message)
  addPart(sessionId, messageId, part)
  updatePart(sessionId, messageId, part)
  setStatus(sessionId, status)
  toggleExpanded(partId)
  isExpanded(partId): boolean
  getByParentPart(partId): SubagentSession | undefined
}
```

**Auto-Expand:** Running subagents auto-expand in UI

---

## 3. Stores (`src/stores/`)

### 3.1 Prompt Store

#### `prompt-store.ts`

**Type:** Zustand store for prompt input UI state  
**Dependencies:** None (pure client state)

**State:**

```ts
{
  parts: Prompt                    // Rich text parts (text, file, image)
  cursor: number                   // Cursor position
  autocomplete: {
    visible: boolean
    type: "file" | "command" | null
    query: string
    items: string[] | SlashCommand[]
    selectedIndex: number
  }
}
```

**Actions:**

- `setParts(parts, cursor?)` - Set prompt content
- `insertFilePart(path, atPosition, replaceLength)` - Insert @file reference
- `showAutocomplete(type, query)` / `hideAutocomplete()`
- `setAutocompleteItems(items)` / `setAutocompleteIndex(index)`
- `navigateAutocomplete("up" | "down")`
- `reset()` - Clear all state

**Pattern:** Part splitting for file insertions

```ts
// Before: "Fix bug in auth.ts"
insertFilePart("src/auth.ts", 11, 7); // atPosition=11, replaceLength=7 ("auth.ts")
// After: "Fix bug in @src/auth.ts "
```

---

### 3.2 Subagent Store (Deprecated)

#### `subagent-store.ts`

**Status:** `@deprecated` - Use `@/atoms/subagents.ts` instead  
**Type:** Zustand store with Immer middleware  
**Dependencies:** `immer` with MapSet plugin (for Set support)

**State:** Same as `subagents.ts` atom, but with Immer

**Migration Path:**

```ts
// Old
import { useSubagentStore } from "@/stores/subagent-store";
const subagent = useSubagentStore((s) => s.getByParentPart(partId));

// New
import { useSubagents } from "@/atoms/subagents";
const { getByParentPart } = useSubagents();
const subagent = getByParentPart(partId);
```

---

## 4. Dependency Analysis

### 4.1 Core Router Dependencies

**Hooks requiring Effect router/caller:**

- ✅ `use-send-message.ts` - `caller("session.promptAsync", ...)`
- ✅ `use-create-session.ts` - `caller("session.create", ...)`
- ✅ `use-providers.ts` - `caller("provider.list", ...)`
- ✅ `use-commands.ts` - `caller("command.list", ...)`
- ✅ `provider.tsx` - `createCaller(router, { sdk: client })`

**Hooks using SDK directly (no router):**

- ✅ `use-file-search.ts` - `createClient(directory).find.files(...)`
- ✅ Atoms (sessions, messages, parts, providers, projects) - All use `createClient(directory)`

**Pure React hooks (no core dep):**

- ✅ `use-session.ts` - Zustand selector
- ✅ `use-messages.ts` - Zustand selector
- ✅ `use-session-status.ts` - Zustand selector
- ✅ `use-compaction-state.ts` - Zustand selector
- ✅ `use-context-usage.ts` - Zustand selector
- ✅ `use-messages-with-parts.ts` - Zustand selector + derived state
- ✅ `use-live-time.ts` - setInterval
- ✅ `use-subscription.ts` - SSE wrapper

---

### 4.2 Provider/Context Requirements

**All hooks require:**

- `OpencodeProvider` → provides `{ url, directory, ready, sync, caller }`
- `SSEProvider` → provides `{ subscribe, connected, reconnect }`

**Provider hierarchy:**

```tsx
<SSEProvider url={url}>
  <OpencodeProvider url={url} directory={directory}>
    {children}
  </OpencodeProvider>
</SSEProvider>
```

**Context usage:**

```ts
const { directory } = useOpencode(); // Directory scoping
const { caller } = useOpencode(); // Router invocation
const { sync } = useOpencode(); // Manual session sync
const { subscribe } = useSSE(); // SSE event subscription
```

---

### 4.3 Component Integration Points

**Root Layout** (`app/layout.tsx`):

```tsx
<SSEProvider url={env.OPENCODE_URL}>
  <OpencodeProvider url={env.OPENCODE_URL} directory={projectDir}>
    <App />
  </OpencodeProvider>
</SSEProvider>
```

**Session Page** (`app/session/[id]/page.tsx`):

```tsx
const session = useSession(sessionId);
const messages = useMessages(sessionId);
const { sendMessage } = useSendMessage({ sessionId });
const { running } = useSessionStatus(sessionId);
const { percentage } = useContextUsage(sessionId);
```

**No tight coupling** - Hooks are generic, components choose which to use

---

## 5. Patterns Used

### 5.1 Effect Service Wrapping (Atoms)

**Pattern:** Interim hooks wrapping SDK calls, evolve to effect-atom later

```ts
// Phase 1 (Current): Wrap SDK in hooks
export function useSessionList({ directory, sseEvent }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const client = createClient(directory);
    const response = await client.session.list();
    setSessions(response.data);
  }, [directory]);

  useEffect(() => {
    if (sseEvent?.type === "session.updated") fetchSessions();
  }, [sseEvent]);

  return { sessions, loading, error };
}

// Phase 2 (Future): effect-atom
export const sessionsAtom = effectAtom((directory) =>
  client.session
    .list()
    .pipe(
      Effect.retry(exponentialBackoff),
      Effect.timeout(Duration.seconds(5)),
    ),
);
```

---

### 5.2 Loading/Error State Handling

**Standard Pattern:**

```ts
const [data, setData] = useState<T[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

useEffect(() => {
  setLoading(true);
  setError(null);

  try {
    const result = await fetchData();
    setData(result);
  } catch (err) {
    setError(err instanceof Error ? err : new Error(String(err)));
    setData([]); // Fallback to empty array
  } finally {
    setLoading(false);
  }
}, [dependency]);
```

**Graceful Degradation:** Always fallback to empty array, never crash UI

---

### 5.3 SSE Subscription Pattern

**Event-Driven Cache Invalidation:**

```ts
// Fetch on mount
useEffect(() => {
  fetchData();
}, []);

// Refetch on SSE events
useEffect(() => {
  if (sseEvent?.payload.type === "data.updated") {
    fetchData();
  }
}, [sseEvent]);
```

**Optimistic Updates (Binary Search):**

```ts
useEffect(() => {
  if (sseEvent?.payload.type === "item.updated") {
    const item = sseEvent.payload.properties.info;
    setItems((prevItems) => {
      const result = Binary.search(prevItems, item.id, (i) => i.id);
      return result.found
        ? [
            ...prevItems.slice(0, result.index),
            item,
            ...prevItems.slice(result.index + 1),
          ]
        : Binary.insert(prevItems, item, (i) => i.id);
    });
  }
}, [sseEvent]);
```

---

### 5.4 Polling Pattern

**Not Used** - SSE preferred for real-time updates

**Exception:** Heartbeat timeout (60s) as fallback for dead connections

---

## 6. API Surface for @joelhooks/swarmtools-react

### 6.1 Must-Have Exports

**Providers:**

```ts
export { OpencodeProvider, SSEProvider };
export type { OpencodeContextValue, SSEContextValue };
```

**Context Hooks:**

```ts
export { useOpencode, useSSE };
```

**Data Hooks (Zustand):**

```ts
export { useSession, useMessages, useSessionStatus };
export { useCompactionState, useContextUsage };
export { useMessagesWithParts };
```

**Action Hooks:**

```ts
export { useSendMessage, useCreateSession };
export { useProviders, useFileSearch, useCommands };
```

**Multi-Server:**

```ts
export { useMultiServerSSE };
```

**Types:**

```ts
export type { Session, Message, Part, SessionStatus };
export type { UseSendMessageOptions, UseSendMessageReturn };
export type { UseProvidersReturn, Provider, Model };
```

---

### 6.2 Maybe-Have Exports (Atoms)

**Decision:** Include if atoms stabilize, otherwise keep internal

```ts
export { useSessionList, useMessages as useMessagesAtom };
export { useSSEConnection, sseAtom, makeSSEAtom };
export { useSubagents };
```

**Rationale:** Atoms are Phase 1 interim - may refactor to effect-atom in Phase 2

---

### 6.3 Internal-Only (Do Not Export)

**Stores:**

- `prompt-store.ts` - UI-specific, not library concern
- `subagent-store.ts` - Deprecated

**Binary Utilities:**

- `@/lib/binary.ts` - Internal optimization, not API

**Helper Functions:**

- `getStoreActions()` pattern - Internal to prevent infinite loops

---

## 7. Integration Requirements

### 7.1 Router Package Dependency

**@joelhooks/swarmtools-react** MUST depend on **@joelhooks/swarmtools-router**

**Why:**

- `useOpencode()` provides `caller` from `createCaller(router, { sdk })`
- `useSendMessage()` invokes `caller("session.promptAsync", ...)`
- `OpencodeProvider` creates router instance internally

**Import Example:**

```ts
import {
  createRouter,
  createCaller,
  createRoutes,
} from "@joelhooks/swarmtools-router";
import { createClient } from "@joelhooks/swarmtools-router/client"; // Or separate SDK package?
```

---

### 7.2 Zustand Store Extraction

**Decision:** Extract `store.ts` as part of React package

**Why:**

- React hooks read from store via `useOpencodeStore`
- Store is reactive state container, tightly coupled to React

**Alternative:** Publish as separate `@joelhooks/swarmtools-state` package if needed for non-React clients

---

### 7.3 Effect Integration

**Current State:** Effect used in atoms (`atoms/sse.ts`) and router

**Future State:** Full effect-atom migration when @effect-atom is stable

**Package Dependency:**

```json
{
  "dependencies": {
    "@joelhooks/swarmtools-router": "workspace:*",
    "effect": "^3.x",
    "zustand": "^5.x",
    "immer": "^10.x"
  }
}
```

---

## 8. Known Gotchas

### 8.1 Zustand Store Pattern (CRITICAL)

**Problem:** `useOpencodeStore()` returns new reference every render → infinite loops

**Solution:** Use `getState()` for actions inside effects

```ts
// ❌ BAD - Causes infinite network requests
const store = useOpencodeStore();
useEffect(() => {
  store.initDirectory(directory);
}, [directory, store]); // store changes every render

// ✅ GOOD - Use getState() for actions inside effects
useEffect(() => {
  useOpencodeStore.getState().initDirectory(directory);
}, [directory]);
```

**Files using pattern:**

- `provider.tsx` - `getStoreActions()` helper
- `use-multi-server-sse.ts` - `getStoreActions()` in callback

---

### 8.2 Immer Creates New References

**Problem:** Every store update creates new object refs, even if content unchanged

**Impact:** `React.memo` with shallow comparison always triggers re-renders

**Example:**

```ts
// Even if metadata.summary hasn't changed, this creates new references
set((state) => {
  const partIndex = state.parts.findIndex((p) => p.id === id);
  state.parts[partIndex].state.metadata.summary = newSummary; // New part object
});
```

**Solutions:**

1. **Content-aware React.memo:**

```ts
export const Task = React.memo(TaskComponent, (prev, next) => {
  return (
    prev.part.id === next.part.id &&
    prev.part.state?.metadata?.summary === next.part.state?.metadata?.summary
  );
});
```

2. **Zustand shallow selectors:**

```ts
import { shallow } from "zustand/shallow";

const messages = useOpencodeStore(
  (state) => state.messages.filter((m) => m.sessionId === id),
  shallow, // Compare array contents, not reference
);
```

---

### 8.3 useDeferredValue Intentional Lag

**Problem:** "Currently doing" status updates appear slow during rapid streaming

**Reality:** Expected behavior. `useDeferredValue` lags by 1-2 frames during rapid updates to prevent UI blocking

**When noticeable:** AI streaming with parts updating every 100-500ms

**Not a bug:** This is the intended tradeoff for non-blocking UI

---

### 8.4 Binary Search New Arrays

**Problem:** Binary search maintains sorted order but Immer creates new array ref on every insert

**Impact:** Components selecting `state.parts` get new reference on every SSE event

**Why we use it:** O(log n) lookups + sorted ULIDs enable efficient updates at scale

**Tradeoff:** Necessary for performance with large message/part arrays

---

## 9. Recommendations for ADR 005

### 9.1 Package Structure

```
@joelhooks/swarmtools-react/
├── providers/
│   ├── OpencodeProvider.tsx
│   └── SSEProvider.tsx
├── hooks/
│   ├── use-opencode.ts       # Context hook
│   ├── use-sse.ts             # SSE hook
│   ├── use-session.ts         # Data hooks
│   ├── use-messages.ts
│   ├── use-send-message.ts    # Action hooks
│   └── index.ts
├── store/
│   └── store.ts               # Zustand store
├── atoms/ (optional)
│   ├── sse.ts
│   ├── sessions.ts
│   └── index.ts
└── index.ts                   # Public API
```

---

### 9.2 TypeScript Exports

**Barrel Export Pattern:**

```ts
// index.ts
export * from "./providers";
export * from "./hooks";
export * from "./store";
export type * from "./types";
```

**Consumer Usage:**

```ts
import {
  OpencodeProvider,
  useSession,
  useSendMessage,
} from "@joelhooks/swarmtools-react";
```

---

### 9.3 Testing Strategy

**Unit Tests:** Hook logic with mocked store/router

```ts
describe("useSession", () => {
  it("returns session from store", () => {
    const { result } = renderHook(() => useSession("ses_123"), {
      wrapper: MockOpencodeProvider,
    });
    expect(result.current).toEqual(mockSession);
  });
});
```

**Integration Tests:** Provider + SSE + store interactions

```ts
describe("OpencodeProvider", () => {
  it("syncs messages on session.updated event", async () => {
    // Render provider, emit SSE event, assert store updated
  });
});
```

---

### 9.4 Documentation Priorities

1. **Provider Setup Guide** - How to wrap app
2. **Hook Reference** - API docs for each hook
3. **Zustand Pattern** - getState() anti-infinite-loop
4. **SSE Integration** - Event types and subscription
5. **Binary Search Pattern** - Why we use it, performance implications

---

## 10. Conclusion

The React layer is **well-structured** with clear separation:

- **Hooks** consume Zustand store (reactive selectors) or invoke router (actions)
- **Atoms** wrap SDK calls with SSE cache invalidation (interim, may evolve to effect-atom)
- **Stores** handle client-only UI state (prompt input, subagents)

**Key Dependencies:**

- Zustand + Immer for reactive state
- Effect router for action invocation
- SSE for real-time updates
- Binary search for O(log n) operations

**Ready for extraction** - Clear API surface, minimal coupling to app-specific logic.
