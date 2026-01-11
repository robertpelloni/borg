# ADR 010: Store-Based State Architecture

## Status

**Proposed** - 2025-12-30

## Relationship to ADR-009

This ADR implements **Phase 3** of ADR-009 (DX Overhaul). The store architecture is the foundation that:

1. **Fixes the infinite loop** (immediate blocker)
2. **Enables the facade hook** (ADR-009 Phase 2) to work without cascading re-renders
3. **Eliminates duplicate API calls** (3x → 1x)
4. **Reduces SSE subscriptions** (6 → 1)

**Dependency chain:**
```
ADR-010 (Store) → ADR-009 Phase 2 (Facade) → ADR-009 Phase 4 (Provider Removal)
```

We're doing ADR-010 first because the infinite loop is blocking all other work.

## Context

The current `packages/react` hooks architecture is fundamentally broken. The session page freezes due to infinite render loops caused by cascading state updates.

### The Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT (BROKEN) ARCHITECTURE                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SessionPage                                                    │
│    ├── useSession()      → useFetch() → useState() ─┐          │
│    ├── useMessages()     → useFetch() → useState() ─┤          │
│    ├── useSessionStatus()→ useFetch() → useState() ─┤          │
│    ├── useCommands()     → useFetch() → useState() ─┤ 10+ hooks│
│    ├── useProviders()    → useFetch() → useState() ─┤ each with│
│    ├── useContextUsage() → useFetch() → useState() ─┤ own state│
│    ├── useCompaction()   → useFetch() → useState() ─┤          │
│    └── ...more hooks     → useFetch() → useState() ─┘          │
│                                                                 │
│  Each useFetch success → setState() → parent re-renders        │
│  Parent re-render → all children re-render → effects re-run    │
│  Effects re-run → more fetches → more setState() → LOOP        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Root cause:** `useFetch` manages its own state. When 10 hooks each call `setState` after their fetches complete, you get cascading re-renders that spiral into an infinite loop.

### Evidence

Console logging shows:
```
[useFetch] render #1-10     ← 10 hook instances
[useFetch] effect running   ← 10 effects fire
[useFetch] refetch called   ← 10 fetches start
[useFetch] success          ← results arrive
[useFetch] render #11-20    ← setState triggers cascade
[useFetch] success          ← more results
[useFetch] render #21-56+   ← infinite loop, page freezes
```

### What Works

The `working-baseline` branch has a functioning implementation using:
- **One Zustand store** as single source of truth
- **SSE events** update the store directly
- **Hooks are pure selectors** - no local state, no fetching

## Decision

Replace the `useFetch`-based architecture with a **centralized Zustand store** pattern.

### New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW (STORE) ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Zustand Store                         │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │ directories: {                                      ││   │
│  │  │   "/path/to/project": {                             ││   │
│  │  │     sessions: Session[]        // sorted by ID      ││   │
│  │  │     messages: Record<sessionID, Message[]>          ││   │
│  │  │     parts: Record<messageID, Part[]>                ││   │
│  │  │     sessionStatus: Record<sessionID, Status>        ││   │
│  │  │     contextUsage: Record<sessionID, Usage>          ││   │
│  │  │     compaction: Record<sessionID, CompactionState>  ││   │
│  │  │     todos: Record<sessionID, Todo[]>                ││   │
│  │  │   }                                                 ││   │
│  │  │ }                                                   ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         │                    │                    │            │
│    SSE Events           Bootstrap            Mutations         │
│    (real-time)          (initial)            (user actions)    │
│         │                    │                    │            │
│  ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐      │
│  │ SSEProvider │     │  bootstrap  │     │ useSendMsg  │      │
│  │ handleEvent │     │  sessions   │     │ useCreate   │      │
│  └─────────────┘     │  statuses   │     │ Session     │      │
│                      └─────────────┘     └─────────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Selector Hooks                        │   │
│  │  (pure reads from store - NO local state)                │   │
│  │                                                          │   │
│  │  useSession(id)        → store.directories[dir].sessions │   │
│  │  useMessages(id)       → store.directories[dir].messages │   │
│  │  useSessionStatus(id)  → store.directories[dir].status   │   │
│  │  useContextUsage(id)   → store.directories[dir].usage    │   │
│  │  useCompaction(id)     → store.directories[dir].compact  │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Single Source of Truth**
   - All data lives in the Zustand store
   - No per-hook `useState` for fetched data
   - Directory-scoped state for multi-project support

2. **Three Data Flows**
   - **Bootstrap**: Initial load of sessions + statuses on mount
   - **SSE Events**: Real-time updates via `handleEvent()`
   - **Mutations**: User actions (send message, create session) update store directly

3. **Hooks Are Selectors**
   - `useMessages(sessionId)` → `store.directories[dir].messages[sessionId]`
   - No fetching logic in hooks
   - No local state in hooks
   - Zustand handles subscription and re-render optimization

4. **Binary Search for Updates**
   - Arrays sorted by ID (ULIDs are lexicographically sortable)
   - O(log n) insert/update/delete operations
   - Immer middleware for immutable updates

### Files to Create/Modify

#### New Files

| File | Purpose |
|------|---------|
| `packages/react/src/store/index.ts` | Main store export |
| `packages/react/src/store/store.ts` | Zustand store with Immer |
| `packages/react/src/store/types.ts` | Store types (Session, Message, Part, etc.) |
| `packages/react/src/store/selectors.ts` | Memoized selectors (usePartSummary, etc.) |
| `packages/react/src/lib/binary.ts` | Binary search utilities |

#### Modified Files

| File | Change |
|------|--------|
| `packages/react/src/providers/opencode-provider.tsx` | Add bootstrap + SSE → store wiring |
| `packages/react/src/providers/sse-provider.tsx` | Keep as-is (just SSE connection) |
| `packages/react/src/hooks/use-session.ts` | Rewrite as selector |
| `packages/react/src/hooks/use-messages.ts` | Rewrite as selector |
| `packages/react/src/hooks/use-parts.ts` | Rewrite as selector |
| `packages/react/src/hooks/use-session-status.ts` | Rewrite as selector |
| `packages/react/src/hooks/use-context-usage.ts` | Rewrite as selector |
| `packages/react/src/hooks/use-compaction-state.ts` | Rewrite as selector |
| `packages/react/src/hooks/use-session-list.ts` | Rewrite as selector |

#### Deleted Files

| File | Reason |
|------|--------|
| `packages/react/src/hooks/use-fetch.ts` | Root cause of infinite loops |
| `packages/react/src/hooks/use-sse-resource.ts` | Wrapper around useFetch |
| `packages/react/src/hooks/use-sse-state.ts` | Replaced by store |
| `packages/react/src/hooks/use-subscription.ts` | Replaced by store subscriptions |

### Store Shape

```typescript
interface OpencodeStore {
  directories: Record<string, DirectoryState>
  
  // Actions
  initDirectory: (directory: string) => void
  handleEvent: (directory: string, event: SSEEvent) => void
  handleSSEEvent: (event: GlobalEvent) => void
  
  // Setters (for bootstrap)
  setSessions: (directory: string, sessions: Session[]) => void
  setMessages: (directory: string, sessionID: string, messages: Message[]) => void
  setParts: (directory: string, messageID: string, parts: Part[]) => void
  
  // Convenience methods
  getSession: (directory: string, id: string) => Session | undefined
  addSession: (directory: string, session: Session) => void
  updateSession: (directory: string, id: string, updater: (draft: Session) => void) => void
  removeSession: (directory: string, id: string) => void
  // ... same pattern for messages, parts
}

interface DirectoryState {
  ready: boolean
  sessions: Session[]
  messages: Record<string, Message[]>
  parts: Record<string, Part[]>
  sessionStatus: Record<string, SessionStatus>
  sessionLastActivity: Record<string, number>
  sessionDiff: Record<string, FileDiff[]>
  todos: Record<string, Todo[]>
  contextUsage: Record<string, ContextUsage>
  compaction: Record<string, CompactionState>
  modelLimits: Record<string, { context: number; output: number }>
}
```

### Event Handling

The store's `handleEvent` method is a switch statement that routes SSE events:

```typescript
handleEvent: (directory, event) => {
  set((state) => {
    const dir = state.directories[directory]
    
    switch (event.type) {
      case "session.created":
      case "session.updated": {
        const session = event.properties.info
        const result = Binary.search(dir.sessions, session.id, s => s.id)
        if (result.found) {
          dir.sessions[result.index] = session
        } else {
          dir.sessions.splice(result.index, 0, session)
        }
        break
      }
      
      case "message.updated": {
        const message = event.properties.info
        const messages = dir.messages[message.sessionID] ??= []
        const result = Binary.search(messages, message.id, m => m.id)
        if (result.found) {
          messages[result.index] = message
        } else {
          messages.splice(result.index, 0, message)
        }
        break
      }
      
      // ... more event types
    }
  })
}
```

### Hook Examples

**Before (broken):**
```typescript
export function useMessages(sessionId: string) {
  const { data, loading, error } = useFetch(
    () => client.message.list({ sessionId }),
    sessionId
  )
  return { messages: data ?? [], loading, error }
}
```

**After (selector):**
```typescript
const EMPTY_MESSAGES: Message[] = []

export function useMessages(sessionId: string): Message[] {
  const { directory } = useOpenCode()
  
  return useOpencodeStore(
    (state) => state.directories[directory]?.messages[sessionId] ?? EMPTY_MESSAGES
  )
}
```

### Provider Wiring

```typescript
function OpenCodeProviderInner({ url, directory, children }) {
  const { subscribe } = useSSE()
  
  // Initialize directory on mount
  useEffect(() => {
    useOpencodeStore.getState().initDirectory(directory)
  }, [directory])
  
  // Bootstrap: load initial data
  useEffect(() => {
    async function bootstrap() {
      const sessions = await client.session.list()
      useOpencodeStore.getState().setSessions(directory, sessions)
      useOpencodeStore.getState().setSessionReady(directory, true)
    }
    bootstrap()
  }, [directory])
  
  // SSE: route events to store
  useEffect(() => {
    const unsubscribe = subscribe("*", (event) => {
      useOpencodeStore.getState().handleSSEEvent(event)
    })
    return unsubscribe
  }, [subscribe])
  
  return <OpenCodeContext.Provider value={...}>{children}</OpenCodeContext.Provider>
}
```

## Implementation Plan

### Phase 1: Core Store (Day 1)

1. Create `packages/react/src/store/` directory
2. Port `store.ts` from `working-baseline` with types
3. Port `binary.ts` utility
4. Add store to package exports
5. Write tests for store operations

### Phase 2: Provider Wiring (Day 1)

1. Update `opencode-provider.tsx` with bootstrap logic
2. Wire SSE events to `handleSSEEvent`
3. Test that store updates on SSE events

### Phase 3: Rewrite Hooks (Day 2)

1. Rewrite data hooks as selectors:
   - `useSession` → selector
   - `useMessages` → selector
   - `useParts` → selector
   - `useSessionStatus` → selector
   - `useSessionList` → selector
   - `useContextUsage` → selector
   - `useCompactionState` → selector

2. Keep action hooks (they don't cause loops):
   - `useSendMessage` - calls API, store updated via SSE
   - `useCreateSession` - calls API, store updated via SSE
   - `useCommands` - calls API, returns data

### Phase 4: Cleanup (Day 2)

1. Delete `useFetch.ts`
2. Delete `useSSEResource.ts`
3. Delete `useSSEState.ts`
4. Delete `useSubscription.ts`
5. Update exports in `index.ts`
6. Run full test suite

### Phase 5: Verification (Day 2)

1. Start dev server
2. Load session page
3. Verify no infinite loops (render count < 20)
4. Verify SSE updates work
5. Verify all features function

## Consequences

### Positive

- **No more infinite loops** - Hooks don't manage state, can't cascade
- **Single source of truth** - All data in one place
- **Predictable updates** - SSE → store → selectors → render
- **Better DevTools** - Zustand DevTools shows all state
- **Simpler hooks** - Pure selectors, easy to understand
- **Proven pattern** - Already working on `working-baseline`

### Negative

- **Migration effort** - Need to rewrite ~10 hooks
- **Store complexity** - One big store vs distributed state
- **Learning curve** - Team needs to understand Zustand patterns

### Neutral

- **Bundle size** - Zustand (~1KB) replaces custom useFetch logic
- **Testing** - Different patterns (store tests vs hook tests)

## TL;DR

**Problem:** `useFetch` in every hook → 10+ independent `useState` calls → cascading re-renders → infinite loop → page freezes.

**Solution:** One Zustand store. SSE updates it. Hooks are selectors. No local state in hooks.

**Why Zustand over XState:** This is a data cache, not a state machine. We're storing sessions/messages/parts, not modeling transitions. Zustand is 1KB, XState is 30KB+. The `working-baseline` branch already proves Zustand works.

**Effort:** 2 days to port from `working-baseline` and rewire hooks.

**Result:** 
- No more infinite loops
- 3x fewer API calls (store caches)
- 6x fewer SSE subscriptions (one in provider)
- Foundation for ADR-009 facade hook

---

## Synergy with ADR-009

### What ADR-010 Enables

| ADR-009 Goal | How ADR-010 Helps |
|--------------|-------------------|
| **1 hook instead of 11** | Store provides single source of truth; facade hook just selects from store |
| **No duplicate API calls** | Bootstrap loads once, store caches, SSE updates |
| **No duplicate SSE subscriptions** | One subscription in provider, routes to `handleEvent` |
| **Business logic extraction** | Store actions can call core utils (ADR-009 Track 1) |
| **Public API reduction** | Internal hooks become store selectors, not exported |

### Combined Implementation Order

```
1. ADR-010: Store + Provider wiring (fixes infinite loop)     ← WE ARE HERE
2. ADR-009 Track 1: Extract business logic to core
3. ADR-009 Track 2: Reduce public API (30+ → 9 exports)
4. ADR-009 Phase 1: Delete zombie re-export layer
5. ADR-009 Phase 2: Facade hook (useSession wraps store selectors)
6. ADR-009 Phase 4: Remove provider requirement
```

### Shared Patterns from uploadthing

Both ADRs adopt these uploadthing patterns:

1. **Single source of truth** - Zustand store (ADR-010) enables facade hook (ADR-009)
2. **Minimal public API** - Store is internal, only facade hook exported
3. **SSR plugin** - Store can be hydrated from `globalThis` (ADR-009 Phase 4)
4. **Progressive disclosure** - Simple API, power-user escape hatches

## References

- `working-baseline` branch - Proven implementation
- `docs/adr/009-dx-overhaul.md` - DX overhaul plan (this is Phase 3)
- `docs/investigations/sse-infinite-loop-2025-12-30.md` - Root cause analysis
- `docs/guides/SYNC_IMPLEMENTATION.md` - SSE event types and sync patterns
- Zustand docs: https://github.com/pmndrs/zustand
