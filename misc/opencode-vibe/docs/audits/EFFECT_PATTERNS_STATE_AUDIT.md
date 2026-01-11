# Effect Patterns - State Management Audit

**Date:** 2026-01-02  
**Agent:** QuickHawk  
**Cell:** opencode-next--xts0a-mjx3stey6li  
**Epic:** opencode-next--xts0a-mjx3stek3wg  

## Executive Summary

Analyzed state management in `packages/core/src/world/`. Current implementation uses **effect-atom** for reactive UI state and **Effect services** for persistence. Ref pattern applicability is LIMITED - Ref requires Effect context (unsuitable for sync UI reactivity), but has specific use cases in services.

**Key Finding:** Current architecture already follows best practices - effect-atom for UI-bound reactive state, Effect services for backend integration. Ref pattern only applies to internal service state (counters, buffers, caches).

---

## 1. Current Implementation Analysis

### 1.1 State Management Layers

The codebase has **three distinct state management patterns**:

| Pattern | File | Purpose | Technology |
|---------|------|---------|-----------|
| **Legacy WorldStore** | `atoms.ts` (lines 35-295) | Transitional class-based store | Plain TS with notify pattern |
| **Reactive Atoms** | `atoms.ts` (lines 307-339), `derived.ts` | UI-bound reactive state | effect-atom |
| **Effect Services** | `cursor-store.ts` | Backend integration with lifecycle | Effect Layer + acquireRelease |

### 1.2 effect-atom Usage

**Base Atoms (atoms.ts:307-339):**

```typescript
// Map-based for O(1) SSE updates
export const sessionsAtom = Atom.make(new Map<string, Session>())
export const messagesAtom = Atom.make(new Map<string, Message[]>())
export const partsAtom = Atom.make(new Map<string, Part[]>())
export const statusAtom = Atom.make(new Map<string, SessionStatus>())
export const connectionStatusAtom = Atom.make<
  "connecting" | "connected" | "disconnected" | "error"
>("disconnected")

// Derived atom with dependency tracking
export const sessionCountAtom = Atom.make((get) => get(sessionsAtom).size)
```

**Derivation Logic (derived.ts:39-142):**

```typescript
// Array-based atoms for enrichment iteration
export const sessionsAtom = Atom.make<Session[]>([])
export const messagesAtom = Atom.make<Message[]>([])
export const partsAtom = Atom.make<Part[]>([])

// Auto-recomputes when dependencies change
export const worldAtom = Atom.make((get) => {
  const sessions = get(sessionsAtom)
  const messages = get(messagesAtom)
  const parts = get(partsAtom)
  const status = get(statusAtom)
  
  // Complex enrichment: join messages + parts, compute metrics
  // ... 100+ lines of pure derivation logic
  
  return enrichedWorldState
})
```

**Key Pattern:** Atom.make((get) => ...) for automatic dependency tracking. Recomputes only when dependencies change.

### 1.3 Effect Service Pattern

**CursorStore (cursor-store.ts):**

```typescript
export interface CursorStoreService {
  saveCursor: (cursor: StreamCursor) => Effect.Effect<void, Error, never>
  loadCursor: (projectKey: string) => Effect.Effect<StreamCursor | null, Error, never>
  deleteCursor: (projectKey: string) => Effect.Effect<void, Error, never>
}

export class CursorStore extends Context.Tag("CursorStore")<
  CursorStore, 
  CursorStoreService
>() {}

export const CursorStoreLive = (dbPath: string): Layer.Layer<CursorStore, Error, never> =>
  Layer.scoped(
    CursorStore,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const client = yield* Effect.sync(() => createClient({ url: `file:${dbPath}` }))
        yield* initSchema(client)
        return makeCursorStore(client)
      }),
      (service) => Effect.sync(() => {
        // Cleanup: close DB connection
      })
    )
  )
```

**Key Pattern:** Layer.scoped + acquireRelease for guaranteed cleanup. Database connection lifecycle is managed by Effect.

### 1.4 What State Is Managed

| State Type | Location | Mutability | Access Pattern |
|-----------|----------|------------|----------------|
| **Sessions** | atoms.ts, derived.ts | Updated via SSE | Read: frequent (UI), Write: SSE events |
| **Messages** | atoms.ts, derived.ts | Append-mostly | Read: frequent, Write: SSE stream |
| **Parts** | atoms.ts, derived.ts | Append-mostly | Read: UI render, Write: SSE chunks |
| **Status** | atoms.ts, derived.ts | Updated via SSE | Read: UI status badges, Write: SSE state transitions |
| **Connection Status** | atoms.ts, derived.ts | Infrequent updates | Read: UI indicators, Write: SSE lifecycle |
| **Stream Cursor** | cursor-store.ts | Write-after-batch | Read: on reconnect, Write: after N events |

**Access Patterns:**
- **Reactive atoms:** High-frequency reads (React renders), moderate writes (SSE events)
- **CursorStore:** Low-frequency reads (reconnect only), batched writes (every N events)

---

## 2. Ref Pattern Applicability

### 2.1 What Ref Provides

From Hivemind (mem-9c2c3b68c15025e3):

> **Ref is Effect's atomic reference for safe concurrent state.** Like Atom but with Effect integration.
>
> **Core API:**
> - Ref.make(initial) - create ref
> - Ref.get(ref) - read atomically
> - Ref.set(ref, value) - write atomically
> - Ref.update(ref, fn) - transform atomically (CAS)
> - Ref.modify(ref, fn) - transform + return value
>
> **Guarantees:**
> - Compare-and-swap (no race conditions)
> - Lock-free concurrency
> - Works in Effect.gen control flow
>
> **Use Cases:**
> - Counters, accumulators in Effect workflows
> - Shared state across Fibers
> - Caching computed values in services
> - Coordinating parallel streams

### 2.2 Where Ref Could Apply

**CANDIDATE 1: Event Batch Counter (cursor-store.ts)**

If we implemented batched cursor saves (e.g., "save every 100 events"):

```typescript
// BEFORE (hypothetical - not in code)
let eventsSinceLastSave = 0
const threshold = 100

// Race condition: multiple Fibers could read/increment simultaneously
eventsSinceLastSave++
if (eventsSinceLastSave >= threshold) {
  saveCursor()
  eventsSinceLastSave = 0
}

// AFTER (with Ref)
export const CursorStoreLive = (dbPath: string, batchSize = 100) =>
  Layer.scoped(
    CursorStore,
    Effect.gen(function* () {
      const client = yield* Effect.sync(() => createClient({ url: `file:${dbPath}` }))
      yield* initSchema(client)
      
      // Ref for atomic counter
      const eventCounter = yield* Ref.make(0)
      
      const service = {
        saveCursor: (cursor: StreamCursor) =>
          Effect.gen(function* () {
            const count = yield* Ref.updateAndGet(eventCounter, (n) => n + 1)
            
            // Save every N events
            if (count % batchSize === 0) {
              yield* Effect.tryPromise({
                try: async () => { /* upsert to DB */ },
                catch: (error) => new Error(`Failed to save cursor: ${error}`)
              })
            }
          })
      }
      
      return Effect.acquireRelease(
        Effect.succeed(service),
        () => Effect.gen(function* () {
          // On shutdown, flush any pending cursor
          const finalCount = yield* Ref.get(eventCounter)
          if (finalCount % batchSize !== 0) {
            yield* service.saveCursor(/* last cursor */)
          }
        })
      )
    })
  )
```

**Benefit:** Atomic counter prevents race conditions when multiple Fibers process events concurrently.

**CANDIDATE 2: SSE Reconnection Backoff State**

If SSE service tracked retry attempts:

```typescript
export const SSEServiceLive = Layer.scoped(
  SSEService,
  Effect.gen(function* () {
    // Ref for retry state
    const retryCount = yield* Ref.make(0)
    const lastAttempt = yield* Ref.make(0)
    
    const connect = Effect.gen(function* () {
      const attempts = yield* Ref.updateAndGet(retryCount, (n) => n + 1)
      const backoffMs = Math.min(1000 * 2 ** attempts, 30000) // Exponential with cap
      
      yield* Effect.sync(() => console.log(`Retry attempt ${attempts}, backoff ${backoffMs}ms`))
      yield* Effect.sleep(backoffMs)
      
      // On success, reset counter
      yield* establishConnection()
      yield* Ref.set(retryCount, 0)
    })
    
    return { connect }
  })
)
```

**Benefit:** Safe concurrent access to retry state across Fibers.

**CANDIDATE 3: Message Buffer Cache**

If we cached enriched messages in a service:

```typescript
export const MessageCacheLive = Layer.scoped(
  MessageCache,
  Effect.gen(function* () {
    // Ref for LRU cache
    const cache = yield* Ref.make(new Map<string, EnrichedMessage[]>())
    const maxSize = 100
    
    return {
      get: (sessionId: string) =>
        Effect.gen(function* () {
          const currentCache = yield* Ref.get(cache)
          return currentCache.get(sessionId) ?? null
        }),
      
      set: (sessionId: string, messages: EnrichedMessage[]) =>
        Ref.update(cache, (current) => {
          const updated = new Map(current)
          updated.set(sessionId, messages)
          
          // LRU eviction if over size
          if (updated.size > maxSize) {
            const firstKey = updated.keys().next().value
            updated.delete(firstKey)
          }
          
          return updated
        })
    }
  })
)
```

**Benefit:** Atomic cache updates prevent corruption during concurrent access.

### 2.3 Where Ref DOES NOT Apply

**❌ UI Reactive State (atoms.ts, derived.ts)**

```typescript
// WRONG: Ref requires Effect context, atoms are sync
export const sessionsAtom = Atom.make(new Map<string, Session>())

// Can't do this - React components don't run in Effect.gen
function SessionList() {
  const sessions = useAtom(sessionsAtom) // ✅ Sync access
  
  // ❌ Can't yield in React component
  const sessions = yield* Ref.get(sessionsRef) // Compilation error
}
```

**Why Atoms, Not Refs:**
- React components need **synchronous access** to state
- effect-atom provides fine-grained reactivity (re-render only when deps change)
- Ref.get() returns Effect<A, never, never> - requires Effect runtime to execute

**❌ Pure Derivation Logic (derived.ts:39-142)**

```typescript
// WRONG: worldAtom enrichment is pure computation
export const worldAtom = Atom.make((get) => {
  const sessions = get(sessionsAtom)
  // ... 100+ lines of pure joins/maps/filters
  return enrichedWorldState
})

// Ref would add unnecessary Effect context for pure transformation
```

**Why Atoms, Not Refs:**
- Enrichment is **pure computation** (no side effects)
- Atom.make((get) => ...) automatically tracks dependencies
- No concurrency concerns - derivation runs synchronously on atom updates

---

## 3. Tradeoffs: Ref vs Atom

| Dimension | effect-atom Atom | Effect Ref |
|-----------|------------------|------------|
| **Context** | No Effect context needed | Requires Effect.gen |
| **Access** | Synchronous (get/set) | Asynchronous (yields Effect) |
| **Reactivity** | Built-in (Registry.subscribe) | Manual (must emit events) |
| **Concurrency** | Not atomic (single-threaded JS) | Atomic CAS (safe for Fibers) |
| **Use Case** | UI state, derived computations | Service counters, caches, buffers |
| **Integration** | React hooks (useAtom) | Effect services only |
| **Performance** | Fast (sync access) | Slower (Effect overhead) |

**Decision Matrix:**

```
┌────────────────────────────────────────┐
│  Is state accessed from React/UI?     │
│         ↓ YES              ↓ NO        │
│     USE ATOM           Is concurrent?  │
│                       ↓ YES    ↓ NO    │
│                    USE REF   USE ATOM  │
└────────────────────────────────────────┘
```

**Key Insight:** Atom is more ergonomic for most cases. Only use Ref when you have **concurrent Effect workflows** that need **atomic updates** to shared state.

---

## 4. Recommendations

### 4.1 Keep Current Atoms (No Migration)

**Verdict:** Current effect-atom usage is CORRECT. No migration needed.

**Rationale:**
1. **UI reactivity requires sync access** - Ref can't integrate with React hooks
2. **Derivation logic is pure** - No concurrency, no need for atomic ops
3. **SSE updates are serialized** - Single event stream, no race conditions

**Architecture already follows best practices:**
- Atom for UI-bound reactive state ✅
- Effect services for backend integration ✅
- Clear separation of concerns ✅

### 4.2 Add Ref to Services (Specific Use Cases)

**RECOMMENDATION 1: Batched Cursor Saves**

If cursor-store.ts implements batching (save every N events):

```typescript
// packages/core/src/world/cursor-store.ts

export const CursorStoreLive = (
  dbPath: string, 
  batchSize = 100 // NEW: configurable batch size
): Layer.Layer<CursorStore, Error, never> =>
  Layer.scoped(
    CursorStore,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const client = yield* Effect.sync(() => createClient({ url: `file:${dbPath}` }))
        yield* initSchema(client)
        
        // NEW: Ref for atomic event counter
        const eventCounter = yield* Ref.make(0)
        let pendingCursor: StreamCursor | null = null
        
        const service: CursorStoreService = {
          saveCursor: (cursor: StreamCursor) =>
            Effect.gen(function* () {
              pendingCursor = cursor
              const count = yield* Ref.updateAndGet(eventCounter, (n) => n + 1)
              
              // Only write to DB every N events
              if (count % batchSize === 0) {
                yield* Effect.tryPromise({
                  try: async () => {
                    await client.execute({
                      sql: `INSERT INTO cursors ... ON CONFLICT ... UPDATE ...`,
                      args: [cursor.projectKey, cursor.offset, cursor.timestamp]
                    })
                  },
                  catch: (error) => new Error(`Failed to save cursor: ${error}`)
                })
              }
            }),
          
          loadCursor: (projectKey: string) => /* unchanged */,
          deleteCursor: (projectKey: string) => /* unchanged */
        }
        
        return service
      }),
      (service) =>
        Effect.gen(function* () {
          // CLEANUP: Flush pending cursor on shutdown
          const count = yield* Ref.get(eventCounter)
          if (count % batchSize !== 0 && pendingCursor) {
            yield* service.saveCursor(pendingCursor)
          }
        })
    )
  )
```

**Benefit:** Reduces DB writes by 100x (save every 100 events instead of every event).  
**Risk:** Cursor may be slightly stale (up to 99 events behind) on crash.  
**Mitigation:** Configurable batch size. Use 1 for critical applications, 100+ for high-throughput.

**RECOMMENDATION 2: SSE Reconnection State**

If SSE service implements exponential backoff:

```typescript
// packages/core/src/sse/multi-server-sse.ts (hypothetical)

export const SSEServiceLive = Layer.scoped(
  SSEService,
  Effect.gen(function* () {
    // Ref for retry state (shared across reconnect Fibers)
    const retryAttempts = yield* Ref.make(0)
    const connectionState = yield* Ref.make<"idle" | "connecting" | "connected">("idle")
    
    const connect = (url: string) =>
      Effect.gen(function* () {
        // Prevent concurrent connection attempts
        const currentState = yield* Ref.get(connectionState)
        if (currentState === "connecting" || currentState === "connected") {
          return // Already connecting/connected
        }
        
        yield* Ref.set(connectionState, "connecting")
        const attempts = yield* Ref.updateAndGet(retryAttempts, (n) => n + 1)
        
        // Exponential backoff with jitter
        const baseDelayMs = 1000
        const maxDelayMs = 30000
        const backoff = Math.min(baseDelayMs * 2 ** attempts, maxDelayMs)
        const jitter = Math.random() * 1000
        
        yield* Effect.sleep(backoff + jitter)
        
        // Attempt connection
        yield* Effect.tryPromise({
          try: async () => { /* establish SSE connection */ },
          catch: (error) => {
            yield* Ref.set(connectionState, "idle")
            throw error
          }
        })
        
        // Success - reset retry counter
        yield* Ref.set(retryAttempts, 0)
        yield* Ref.set(connectionState, "connected")
      })
    
    return { connect }
  })
)
```

**Benefit:** Safe concurrent reconnection logic. Prevents "thundering herd" if multiple Fibers trigger reconnect.  
**Risk:** Added complexity. Effect.retry with Schedule might be simpler.  
**Alternative:** Use Effect.retry + Schedule.exponential instead of manual Ref state.

**RECOMMENDATION 3: DON'T Use Ref for UI State**

**AVOID THIS:**

```typescript
// ❌ WRONG: Ref in UI layer
export const SessionServiceLive = Layer.scoped(
  SessionService,
  Effect.gen(function* () {
    const sessions = yield* Ref.make(new Map<string, Session>())
    
    return {
      getSessions: () => Ref.get(sessions), // Returns Effect<Map<...>>
      updateSession: (id, session) => Ref.update(sessions, (map) => {
        map.set(id, session)
        return map
      })
    }
  })
)

// React component can't use this
function SessionList() {
  const sessionService = useService(SessionService) // How to get sessions?
  const sessions = sessionService.getSessions() // Returns Effect, not Map
  // Need Effect.runPromise every render - terrible UX
}
```

**Why This Fails:**
1. React components need sync access - can't `yield*` in render
2. Effect.runPromise on every render = performance death
3. No automatic reactivity - manual subscription hell

**Correct Pattern (Current):**

```typescript
// ✅ CORRECT: Atom for UI state
export const sessionsAtom = Atom.make(new Map<string, Session>())

// React hook
function SessionList() {
  const sessions = useAtom(sessionsAtom) // Sync access, auto-reactive
  return <>{Array.from(sessions.values()).map(/* ... */)}</>
}

// Effect service updates atoms as side effect
const updateSessionsFromSSE = Effect.gen(function* () {
  const event = yield* sseStream
  const registry = yield* Registry
  registry.set(sessionsAtom, event.sessions)
})
```

### 4.3 Address Atom Duplication

**ISSUE:** `atoms.ts` and `derived.ts` both define sessionsAtom/messagesAtom/partsAtom.

**Code Comment (derived.ts:16-24):**

```typescript
/**
 * Array-based atoms for enrichment logic
 *
 * These use arrays for simpler iteration during enrichment.
 * The Map-based atoms in atoms.ts are for O(1) SSE updates.
 *
 * TODO: Reconcile these two approaches - either:
 * 1. Convert Map atoms to arrays in worldAtom derivation
 * 2. Use a single atom design throughout
 */
```

**RECOMMENDATION:** Unify on Map-based atoms, convert to arrays in derivation.

**Before (Current):**

```typescript
// atoms.ts - Map for SSE updates
export const sessionsAtom = Atom.make(new Map<string, Session>())

// derived.ts - Array for iteration (DUPLICATE)
export const sessionsAtom = Atom.make<Session[]>([])
```

**After (Proposed):**

```typescript
// atoms.ts - Single source of truth (Map)
export const sessionsAtom = Atom.make(new Map<string, Session>())

// derived.ts - Convert Map → Array for derivation
export const worldAtom = Atom.make((get) => {
  const sessionsMap = get(sessionsAtom)
  const sessions = Array.from(sessionsMap.values()) // Convert to array
  
  // ... rest of enrichment logic
})
```

**Benefits:**
- Eliminates duplicate atom definitions
- Single source of truth for base state
- Map maintains O(1) SSE updates
- Array conversion is O(n) but only on derivation (acceptable)

**Effort:** 1-2 hours. Low-risk refactor.

---

## 5. Risk & Effort Assessment

### 5.1 Migration Complexity

| Change | Effort | Risk | Benefit |
|--------|--------|------|---------|
| **Keep current atoms** | 0 hours | None | Correct architecture |
| **Add Ref to cursor batching** | 2-3 hours | Low | 100x fewer DB writes |
| **Add Ref to SSE reconnect** | 3-4 hours | Medium | Safer concurrent reconnect |
| **Unify atom definitions** | 1-2 hours | Low | Eliminate duplication |
| **Migrate atoms → Refs (UI)** | N/A | **BREAKING** | None (wrong pattern) |

### 5.2 Recommended Action Plan

**Phase 1: Documentation (DONE)**
- [x] Audit current state management
- [x] Document Ref vs Atom tradeoffs
- [x] Identify specific use cases

**Phase 2: Low-Risk Improvements (Optional)**
- [ ] Unify atom definitions (atoms.ts + derived.ts)
- [ ] Add Ref-based cursor batching (if high event volume)

**Phase 3: Service State (Future)**
- [ ] Evaluate SSE reconnect pattern (Effect.retry vs Ref state)
- [ ] Add Ref to message cache (if caching implemented)

### 5.3 When to Use Ref (Decision Tree)

```
Is state accessed from React/UI?
  ├─ YES → USE ATOM (effect-atom)
  └─ NO → Is state shared across concurrent Effect Fibers?
           ├─ YES → Does it need atomic updates (counter, cache, accumulator)?
           │        ├─ YES → USE REF
           │        └─ NO → USE ATOM (simpler)
           └─ NO → USE ATOM (no concurrency = no need for CAS)
```

**Examples:**
- UI session list → ATOM (React access)
- Message enrichment → ATOM (pure derivation, no concurrency)
- Event batch counter → REF (concurrent Fibers, atomic increment)
- SSE connection state → REF or Schedule.retry (atomic state updates)
- LRU message cache → REF (atomic eviction logic)

---

## 6. Conclusion

**Current architecture is SOUND.** No migration needed.

**Key Takeaways:**

1. **effect-atom is correct for UI state** - Sync access, automatic reactivity, React integration
2. **Effect services are correct for backend** - acquireRelease lifecycle, error handling, structured concurrency
3. **Ref pattern is NARROW** - Only for atomic updates in concurrent Effect workflows (counters, caches, buffers)

**Actionable Next Steps:**

1. ✅ **Keep atoms for UI state** (sessionsAtom, messagesAtom, worldAtom)
2. ✅ **Keep Effect services for persistence** (CursorStore)
3. 🟡 **Consider Ref for batching** (if high event volume → cursor-store.ts batching)
4. 🟡 **Unify atom definitions** (eliminate atoms.ts/derived.ts duplication)
5. ❌ **DO NOT migrate atoms → Refs** (breaks React integration)

**Final Verdict:** **NO MAJOR CHANGES REQUIRED.** Current patterns align with Effect-TS best practices and project requirements.

---

## Appendix A: Related Hivemind Memories

- **mem-9c2c3b68c15025e3** - Effect Ref Pattern (concurrent state, atomic CAS, service usage)
- **mem-0c0d32c38ad7bb96** - effect-atom TDD pattern (Registry, derived atoms)
- **mem-55f8be5aeb3f7798** - effect-atom async iterator (Symbol.asyncIterator for streams)
- **mem-5bef20787787b69d** - Effect Service Factory Patterns (sync/scoped/effect factories)
- **mem-fa2e52bd6e3f080b** - Effect acquireRelease pattern (guaranteed cleanup, scope)

## Appendix B: Code References

- `packages/core/src/world/atoms.ts` - WorldStore (legacy) + base atoms (Map-based)
- `packages/core/src/world/derived.ts` - Derived worldAtom (array-based, TDD migration)
- `packages/core/src/world/cursor.ts` - Schema definitions (EventOffset, StreamCursor)
- `packages/core/src/world/cursor-store.ts` - Effect Layer with acquireRelease (libSQL)
- ADR-018 - Reactive World Stream architecture rationale

---

**Generated:** 2026-01-02 by QuickHawk (opencode-next--xts0a-mjx3stey6li)
