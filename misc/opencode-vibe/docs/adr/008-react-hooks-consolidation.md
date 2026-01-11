# ADR 008: React Hooks Consolidation Plan

**Status:** Proposed  
**Date:** 2025-12-30  
**Deciders:** Architecture Team  
**Affected Components:** `packages/react/src/hooks/`

---

## Context

The `@opencode-vibe/react` hooks library contains **23 hooks** across ~2,800 lines of code. Following the nuclear migration (ADR 007) that deleted the Zustand store and 14 hooks, we now have an opportunity to consolidate the remaining hooks around generic, reusable patterns.

### Current State

**Hooks Inventory:**
- 23 total hooks (as of 2025-12-30)
- ~2,800 total lines of code
- ~350 LOC of duplicated fetch+state patterns
- 3 different SSE integration approaches
- 43% of hooks lacking test coverage
- 6 hooks not exported from public API (discoverability problem)

### Architecture Issues Identified

#### 1. Pattern Duplication (~350 LOC)

**10 hooks share identical fetch+state pattern:**

| Hook | Entity | Pattern | LOC |
|------|--------|---------|-----|
| `useSessionList` | Session[] | Fetch + State | 88 |
| `useSession` | Session | Fetch + SSE | 117 |
| `useMessages` | Message[] | Fetch + SSE | 146 |
| `useParts` | Part[] | Fetch + SSE | 148 |
| `useProjects` | Project[] | Fetch + State | 147 |
| `useProviders` | Provider[] | Fetch + State | 91 |
| `useServers` | ServerInfo[] | Fetch + State | 163 |
| `useCommands` | SlashCommand[] | Fetch + State | 130 |

**Canonical pattern (repeated in each):**

```typescript
export function useSessionList(options = {}): UseSessionListReturn {
  const [sessionList, setSessionList] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(() => {
    setLoading(true)
    setError(null)
    
    sessions.list(options.directory)
      .then((data) => { setSessionList(data); setError(null) })
      .catch((err) => { setError(err); setSessionList([]) })
      .finally(() => setLoading(false))
  }, [options.directory])

  useEffect(() => { fetch() }, [fetch])

  return { sessions: sessionList, loading, error, refetch: fetch }
}
```

**Duplication breakdown:**
- State setup: 3 lines × 10 = 30 lines
- Fetch callback: 15 lines × 10 = 150 lines
- useEffect trigger: 3 lines × 10 = 30 lines
- **Total waste: ~220 lines** (excluding SSE variants)

#### 2. Three Different SSE Patterns

**Pattern A: Fetch + SSE with Binary Search** (3 hooks)
- `useSession`, `useMessages`, `useParts`
- Features: initial fetch, SSE subscription, binary search updates
- Complexity: `sessionIdRef`, `hydratedRef`, `fetchInProgressRef` to avoid races

**Pattern B: SSE-Only with State Reduction** (4 hooks)
- `useMultiServerSSE`, `useContextUsage`, `useCompactionState`, `useSessionStatus`
- Features: subscribe to events, reduce state from event stream
- No initial fetch, event-driven only

**Pattern C: Native EventSource** (1 hook)
- `useSSE` - raw EventSource wrapper
- Not used in `apps/web`, different from `useMultiServerSSE`

**Problem:** Three approaches to SSE integration create confusion. New hooks must choose which pattern to follow.

#### 3. Missing Abstractions

**No generic `useFetch<T>`:**
- Every hook reimplements loading/error/data state
- Fetch callbacks are nearly identical
- Error normalization repeated

**No generic `useSSEResource<T>`:**
- Fetch + SSE pattern repeated in 3 hooks
- Binary search update logic duplicated
- Race condition handling (`fetchInProgressRef`) duplicated

**No generic `useSSEState<T>`:**
- Event subscription + state reduction pattern repeated in 4 hooks
- Each hook manually filters events by type
- No shared logic for sessionId filtering

### Impact

| Issue | LOC Impact | Maintenance Impact |
|-------|------------|-------------------|
| Duplicated fetch pattern | ~220 lines wasted | Bug fixes must be applied to 10 hooks |
| Duplicated fetch+SSE pattern | ~130 lines wasted | Binary search bugs affect 3 hooks |
| 3 SSE patterns | ~400 lines total | Inconsistent patterns, confusion |
| No tests for 10 hooks | 0 coverage | Regression risk on refactor |
| **Total** | **~350 lines** | **High - single bug requires multiple fixes** |

---

## Decision

**We will extract 3 generic hooks that encapsulate the repeated patterns:**

1. **`useFetch<T>`** - Generic fetch + state management
2. **`useSSEResource<T>`** - Fetch + SSE + binary search pattern
3. **`useSSEState<T>`** - SSE-only state reduction pattern

These generic hooks will:
- Eliminate ~220 LOC of duplicated state/error handling
- Standardize SSE integration to a single pattern
- Reduce maintenance surface by ~60%
- Make testing easier (test generic once, not each hook)
- Provide clear templates for future hooks

---

## Proposed Abstractions

### 1. `useFetch<T, P>` - Generic Fetch Hook

**Purpose:** Eliminate duplicated fetch+state pattern across 7+ hooks.

**Signature:**

```typescript
interface UseFetchOptions<T> {
  initialData?: T
  enabled?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseFetchReturn<T> {
  data: T
  loading: boolean
  error: Error | null
  refetch: () => void
}

function useFetch<T, P = void>(
  fetcher: (params: P) => Promise<T>,
  params: P,
  options?: UseFetchOptions<T>
): UseFetchReturn<T>
```

**Implementation (~50 LOC):**

```typescript
export function useFetch<T, P = void>(
  fetcher: (params: P) => Promise<T>,
  params: P,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const { initialData, enabled = true, onSuccess, onError } = options
  
  const [data, setData] = useState<T>(initialData as T)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    if (!enabled) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await fetcher(params)
      setData(result)
      onSuccess?.(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [fetcher, params, enabled, onSuccess, onError])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

**Hooks That Would Use This (7 hooks):**

```typescript
// Before: 88 LOC
export function useSessionList(options = {}) {
  const [sessionList, setSessionList] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  // ... 80 more lines
}

// After: ~15 LOC
export function useSessionList(options = {}) {
  return useFetch(
    (dir) => sessions.list(dir),
    options.directory,
    { initialData: [] }
  )
}
```

**Affected Hooks:**
- `useSessionList` (88 → 15 LOC)
- `useProjects` (147 → 20 LOC)
- `useProviders` (91 → 15 LOC)
- `useServers` (163 → 25 LOC)
- `useCommands` (130 → 20 LOC)
- `useCreateSession` (action hook, partial usage)
- `useSendMessage` (action hook, partial usage)

**Net Reduction:** ~400 LOC → ~150 LOC = **250 LOC saved**

---

### 2. `useSSEResource<T>` - Fetch + SSE + Binary Search

**Purpose:** Encapsulate the fetch + SSE subscription + binary search pattern used in `useMessages`, `useParts`, `useSession`.

**Signature:**

```typescript
interface UseSSEResourceOptions<T> {
  fetcher: () => Promise<T[]>
  eventType: string | string[]
  sessionIdFilter?: string
  getId: (item: T) => string
  initialData?: T[]
  enabled?: boolean
}

interface UseSSEResourceReturn<T> {
  data: T[]
  loading: boolean
  error: Error | null
  refetch: () => void
  hydratedRef: React.MutableRefObject<boolean>
}

function useSSEResource<T>(
  options: UseSSEResourceOptions<T>
): UseSSEResourceReturn<T>
```

**Implementation (~100 LOC):**

```typescript
import { Binary } from '@opencode-vibe/core/utils/binary'
import { useMultiServerSSE } from './use-multi-server-sse'

export function useSSEResource<T>(
  options: UseSSEResourceOptions<T>
): UseSSEResourceReturn<T> {
  const { fetcher, eventType, sessionIdFilter, getId, initialData = [], enabled = true } = options
  
  const [data, setData] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(!initialData.length && enabled)
  const [error, setError] = useState<Error | null>(null)
  
  const hydratedRef = useRef(!!initialData.length)
  const fetchInProgressRef = useRef(false)
  const sessionIdRef = useRef(sessionIdFilter)

  // Update sessionId filter when it changes
  useEffect(() => {
    sessionIdRef.current = sessionIdFilter
  }, [sessionIdFilter])

  // Initial fetch
  const fetch = useCallback(async () => {
    if (!enabled || hydratedRef.current) return
    
    fetchInProgressRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const result = await fetcher()
      setData(result)
      hydratedRef.current = true
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }, [fetcher, enabled])

  useEffect(() => {
    fetch()
  }, [fetch])

  // SSE updates
  useMultiServerSSE({
    onEvent: (event) => {
      // Skip if fetch in progress
      if (fetchInProgressRef.current) return
      
      // Filter by event type
      const types = Array.isArray(eventType) ? eventType : [eventType]
      if (!types.includes(event.payload.type)) return
      
      // Filter by sessionId if provided
      if (sessionIdFilter) {
        const eventSessionId = (event.payload.properties as any).sessionID
        if (eventSessionId !== sessionIdRef.current) return
      }
      
      // Extract item from event
      const item = extractItem(event.payload)
      if (!item) return
      
      // Binary search insert/update
      setData((prev) => {
        const id = getId(item)
        const { found, index } = Binary.search(prev, id, getId)
        
        if (found) {
          // Update existing
          const updated = [...prev]
          updated[index] = item
          return updated
        }
        
        // Insert new
        return Binary.insert(prev, item, getId)
      })
    }
  })

  return { data, loading, error, refetch: fetch, hydratedRef }
}

function extractItem(payload: any): any {
  // Handle different event shapes
  if (payload.properties?.info) return payload.properties.info
  if (payload.properties?.part) return payload.properties.part
  return payload.properties
}
```

**Hooks That Would Use This (3 hooks):**

```typescript
// Before: 146 LOC
export function useMessages({ sessionId, directory, initialData }) {
  const [messageList, setMessageList] = useState(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<Error | null>(null)
  
  const sessionIdRef = useRef(sessionId)
  const hydratedRef = useRef(!!initialData)
  const fetchInProgressRef = useRef(false)
  
  // ... 130 more lines of fetch + SSE logic
}

// After: ~25 LOC
export function useMessages({ sessionId, directory, initialData }) {
  return useSSEResource({
    fetcher: () => messages.list(sessionId, directory),
    eventType: ['message.updated', 'message.removed'],
    sessionIdFilter: sessionId,
    getId: (msg) => msg.id,
    initialData,
  })
}
```

**Affected Hooks:**
- `useMessages` (146 → 25 LOC)
- `useParts` (148 → 25 LOC)
- `useSession` (117 → 20 LOC)

**Net Reduction:** ~411 LOC → ~70 LOC = **341 LOC saved**

---

### 3. `useSSEState<T>` - SSE-Only State Reduction

**Purpose:** Standardize SSE-only hooks that reduce state from event streams.

**Signature:**

```typescript
interface UseSSEStateOptions<T> {
  eventType: string | ((type: string) => boolean)
  sessionIdFilter?: string
  reducer: (state: T, event: GlobalEvent) => T
  initialState: T
  enabled?: boolean
}

function useSSEState<T>(
  options: UseSSEStateOptions<T>
): T
```

**Implementation (~60 LOC):**

```typescript
import { useMultiServerSSE } from './use-multi-server-sse'

export function useSSEState<T>(
  options: UseSSEStateOptions<T>
): T {
  const { eventType, sessionIdFilter, reducer, initialState, enabled = true } = options
  
  const [state, setState] = useState<T>(initialState)
  const sessionIdRef = useRef(sessionIdFilter)

  useEffect(() => {
    sessionIdRef.current = sessionIdFilter
  }, [sessionIdFilter])

  useMultiServerSSE({
    onEvent: (event) => {
      if (!enabled) return
      
      // Filter by event type
      const matches = typeof eventType === 'function'
        ? eventType(event.payload.type)
        : event.payload.type === eventType
      
      if (!matches) return
      
      // Filter by sessionId if provided
      if (sessionIdFilter) {
        const eventSessionId = (event.payload.properties as any).sessionID
        if (eventSessionId !== sessionIdRef.current) return
      }
      
      // Reduce state
      setState((prev) => reducer(prev, event))
    }
  })

  return state
}
```

**Hooks That Would Use This (3 hooks):**

```typescript
// Before: 147 LOC
export function useContextUsage({ sessionId, directory }) {
  const [usage, setUsage] = useState({
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0
  })
  
  useMultiServerSSE({
    onEvent: (event) => {
      if (event.payload.type !== 'context.usage.updated') return
      if (event.payload.properties.sessionID !== sessionId) return
      
      const { inputTokens, outputTokens, reasoningTokens } = event.payload.properties
      setUsage({ inputTokens, outputTokens, reasoningTokens })
    }
  })
  
  return usage
}

// After: ~20 LOC
export function useContextUsage({ sessionId, directory }) {
  return useSSEState({
    eventType: 'context.usage.updated',
    sessionIdFilter: sessionId,
    reducer: (state, event) => {
      const { inputTokens, outputTokens, reasoningTokens } = event.payload.properties
      return { inputTokens, outputTokens, reasoningTokens }
    },
    initialState: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }
  })
}
```

**Affected Hooks:**
- `useContextUsage` (147 → 20 LOC)
- `useCompactionState` (102 → 20 LOC)
- `useSessionStatus` (154 → 25 LOC)

**Net Reduction:** ~403 LOC → ~65 LOC = **338 LOC saved**

---

## Consolidation Summary

### LOC Reduction

| Pattern | Before | After | Saved |
|---------|--------|-------|-------|
| Fetch-only hooks (7) | ~400 LOC | ~150 LOC | 250 LOC |
| Fetch+SSE hooks (3) | ~411 LOC | ~70 LOC | 341 LOC |
| SSE-only hooks (3) | ~403 LOC | ~65 LOC | 338 LOC |
| **Total** | **~1,214 LOC** | **~285 LOC** | **~929 LOC (76% reduction)** |

### Generic Hooks Implementation

| Hook | LOC | Purpose |
|------|-----|---------|
| `useFetch<T, P>` | ~50 | Generic fetch + state |
| `useSSEResource<T>` | ~100 | Fetch + SSE + binary search |
| `useSSEState<T>` | ~60 | SSE-only state reduction |
| **Total Generic** | **~210 LOC** | **Reusable primitives** |

**Net Change:** -929 LOC (deleted) + 210 LOC (new generics) = **-719 LOC saved**

### Maintenance Surface Reduction

**Before consolidation:**
- 13 hooks with duplicated patterns
- 3 different SSE approaches
- Bug fixes require changes to multiple hooks
- No shared test suite for common patterns

**After consolidation:**
- 3 generic hooks (well-tested)
- 13 thin wrappers (~15-25 LOC each)
- Single source of truth for each pattern
- Bug fixes in one place
- Shared test suite for generics

---

## Implementation Plan

### Phase 1: Create Generic Hooks (Week 1)

**Priority: Foundation**

1. **Create `useFetch<T, P>`** (2h)
   - File: `packages/react/src/hooks/use-fetch.ts`
   - Tests: `packages/react/src/hooks/use-fetch.test.ts`
   - Test with mock fetcher, loading/error states
   - Test enabled/disabled behavior
   - Test refetch functionality

2. **Create `useSSEResource<T>`** (3h)
   - File: `packages/react/src/hooks/use-sse-resource.ts`
   - Tests: `packages/react/src/hooks/use-sse-resource.test.ts`
   - Test fetch + SSE coordination
   - Test binary search insert/update
   - Test sessionId filtering
   - Test fetchInProgressRef race condition handling

3. **Create `useSSEState<T>`** (2h)
   - File: `packages/react/src/hooks/use-sse-state.ts`
   - Tests: `packages/react/src/hooks/use-sse-state.test.ts`
   - Test event filtering
   - Test sessionId filtering
   - Test state reduction

**Deliverable:** 3 generic hooks with 90%+ test coverage

---

### Phase 2: Migrate Fetch-Only Hooks (Week 2)

**Priority: Quick wins, high impact**

1. **Migrate simple hooks** (1 day)
   - `useSessionList` - lists sessions
   - `useProviders` - lists providers
   - `useCommands` - lists slash commands

2. **Migrate complex hooks** (1 day)
   - `useProjects` - has current project selection
   - `useServers` - has current server selection
   - Update tests to use generic hook patterns

3. **Verify behavior** (0.5 day)
   - Manual testing in `apps/web`
   - Verify loading states
   - Verify error handling
   - Verify refetch behavior

**Deliverable:** 7 hooks migrated to `useFetch<T>`, all passing tests

---

### Phase 3: Migrate Fetch+SSE Hooks (Week 2-3)

**Priority: High complexity, high value**

1. **Migrate `useMessages`** (1 day)
   - Update to `useSSEResource`
   - Verify binary search updates
   - Test SSE event handling
   - Verify message.updated and message.removed events

2. **Migrate `useParts`** (1 day)
   - Update to `useSSEResource`
   - Verify part updates during streaming
   - Test race condition handling with `fetchInProgressRef`

3. **Migrate `useSession`** (0.5 day)
   - Update to `useSSEResource` (single item, not array)
   - Verify session status updates

**Deliverable:** 3 hooks migrated to `useSSEResource<T>`, streaming verified

---

### Phase 4: Migrate SSE-Only Hooks (Week 3)

**Priority: Medium complexity**

1. **Migrate `useContextUsage`** (0.5 day)
   - Update to `useSSEState`
   - Verify token tracking
   - Test event reduction

2. **Migrate `useCompactionState`** (0.5 day)
   - Update to `useSSEState`
   - Verify compaction progress updates
   - Test event filtering

3. **Migrate `useSessionStatus`** (0.5 day)
   - Update to `useSSEState`
   - Verify running/idle status tracking

**Deliverable:** 3 hooks migrated to `useSSEState<T>`, real-time sync verified

---

### Phase 5: Documentation & Cleanup (Week 3)

**Priority: DX polish**

1. **Add JSDoc examples** (1 day)
   - Document `useFetch<T>` with examples
   - Document `useSSEResource<T>` with examples
   - Document `useSSEState<T>` with examples
   - Add migration guide for future hooks

2. **Update packages/react/README.md** (0.5 day)
   - Architecture section: Core → React → Web
   - Generic hooks documentation
   - Pattern decision tree (when to use which generic)

3. **Export missing hooks** (0.5 day)
   - Add category comments to index.ts
   - Export 6 previously hidden hooks
   - Group exports by pattern (fetch, fetch+SSE, SSE-only, action, utility)

4. **Delete deprecated patterns** (0.5 day)
   - Remove old stub implementations
   - Delete orphaned code
   - Clean up imports

**Deliverable:** Complete documentation, public API polished

---

## Migration Strategy

### Decision Tree for Future Hooks

```
Need to fetch data from API?
├─ YES → Need real-time updates via SSE?
│  ├─ YES → Use useSSEResource<T>
│  │        (fetch + SSE + binary search)
│  └─ NO  → Use useFetch<T, P>
│           (fetch + state only)
└─ NO  → Just SSE events?
   └─ YES → Use useSSEState<T>
            (SSE-only state reduction)
```

### Example Migrations

**Before (Fetch-only):**
```typescript
export function useSessionList(options = {}) {
  const [sessionList, setSessionList] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const fetch = useCallback(() => {
    setLoading(true)
    setError(null)
    sessions.list(options.directory)
      .then(setSessionList)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [options.directory])
  
  useEffect(() => { fetch() }, [fetch])
  
  return { sessions: sessionList, loading, error, refetch: fetch }
}
```

**After:**
```typescript
export function useSessionList(options = {}) {
  return useFetch(
    (dir) => sessions.list(dir),
    options.directory,
    { initialData: [] }
  )
}
```

---

**Before (Fetch+SSE):**
```typescript
export function useMessages({ sessionId, directory, initialData }) {
  const [messages, setMessages] = useState(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const sessionIdRef = useRef(sessionId)
  const fetchInProgressRef = useRef(false)
  
  // Fetch logic
  const fetch = useCallback(async () => {
    fetchInProgressRef.current = true
    setLoading(true)
    try {
      const data = await messages.list(sessionId, directory)
      setMessages(data)
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }, [sessionId, directory])
  
  useEffect(() => { fetch() }, [fetch])
  
  // SSE logic
  useMultiServerSSE({
    onEvent: (event) => {
      if (fetchInProgressRef.current) return
      if (event.payload.type !== 'message.updated') return
      if (event.payload.properties.sessionID !== sessionIdRef.current) return
      
      const msg = event.payload.properties.info
      setMessages((prev) => {
        const { found, index } = Binary.search(prev, msg.id, (m) => m.id)
        if (found) {
          const updated = [...prev]
          updated[index] = msg
          return updated
        }
        return Binary.insert(prev, msg, (m) => m.id)
      })
    }
  })
  
  return { messages, loading, refetch: fetch }
}
```

**After:**
```typescript
export function useMessages({ sessionId, directory, initialData }) {
  return useSSEResource({
    fetcher: () => messages.list(sessionId, directory),
    eventType: ['message.updated', 'message.removed'],
    sessionIdFilter: sessionId,
    getId: (msg) => msg.id,
    initialData,
  })
}
```

---

**Before (SSE-only):**
```typescript
export function useContextUsage({ sessionId }) {
  const [usage, setUsage] = useState({
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0
  })
  
  useMultiServerSSE({
    onEvent: (event) => {
      if (event.payload.type !== 'context.usage.updated') return
      if (event.payload.properties.sessionID !== sessionId) return
      
      const { inputTokens, outputTokens, reasoningTokens } = event.payload.properties
      setUsage({ inputTokens, outputTokens, reasoningTokens })
    }
  })
  
  return usage
}
```

**After:**
```typescript
export function useContextUsage({ sessionId }) {
  return useSSEState({
    eventType: 'context.usage.updated',
    sessionIdFilter: sessionId,
    reducer: (_, event) => {
      const { inputTokens, outputTokens, reasoningTokens } = event.payload.properties
      return { inputTokens, outputTokens, reasoningTokens }
    },
    initialState: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }
  })
}
```

---

## Risks & Mitigations

### Risk 1: Breaking Changes to Hook APIs

**Probability:** Medium  
**Impact:** High - affects `apps/web` consumers

**Mitigation:**
- Keep existing hook signatures unchanged (internal implementation only)
- Add deprecation warnings for any API changes
- Provide codemods for consumers if needed
- Test `apps/web` manually after each migration

---

### Risk 2: SSE Race Conditions

**Probability:** Medium  
**Impact:** High - messages/parts arrive out of order

**Mitigation:**
- Preserve `fetchInProgressRef` pattern in `useSSEResource`
- Add comprehensive tests for race conditions
- Test with rapid SSE events in development
- Monitor production for SSE timing issues

---

### Risk 3: Performance Regression

**Probability:** Low  
**Impact:** Medium - generic hooks add abstraction overhead

**Mitigation:**
- Benchmark before/after with React DevTools Profiler
- Measure render counts during SSE streaming
- Optimize hot paths if needed
- Accept slight overhead for maintainability gain

---

### Risk 4: Binary Search Edge Cases

**Probability:** Low  
**Impact:** Medium - incorrect insert/update breaks message ordering

**Mitigation:**
- Port existing binary search tests to generic hook
- Test edge cases: empty array, single item, duplicates
- Verify ULID sorting assumptions hold
- Add assertions for sorted array invariant

---

## Testing Requirements

### Generic Hook Tests (MANDATORY)

Each generic hook MUST have:

1. **Happy path tests**
   - Initial fetch succeeds
   - Loading state transitions correctly
   - Data updates on refetch
   - SSE events update state (for SSE hooks)

2. **Error handling tests**
   - Fetch error sets error state
   - Error cleared on retry
   - SSE errors don't crash hook

3. **Edge case tests**
   - Empty data arrays
   - Null/undefined initial data
   - Rapid refetch calls
   - SSE events during fetch (race condition)

4. **Performance tests**
   - No unnecessary re-renders
   - useCallback/useMemo used correctly
   - Binary search O(log n) verified

**Target:** 90%+ test coverage for all generic hooks before migration

---

### Integration Tests (apps/web)

After migration, verify in production-like environment:

1. **Session list loads** - `useSessionList` with real API
2. **Messages stream** - `useMessages` + `useParts` during AI response
3. **Token counter updates** - `useContextUsage` tracks tokens
4. **Status indicator works** - `useSessionStatus` shows running/idle
5. **Compaction progress** - `useCompactionState` updates during compaction

**Test in:** Chrome DevTools with Network tab throttled to "Slow 3G"

---

## Success Criteria

**The consolidation is COMPLETE when:**

1. ✅ All 3 generic hooks implemented with 90%+ test coverage
2. ✅ 13 hooks migrated to use generics (7 fetch, 3 fetch+SSE, 3 SSE-only)
3. ✅ All tests passing (`bun test`)
4. ✅ TypeScript builds without errors (`bun run typecheck`)
5. ✅ `apps/web` runs without regression
6. ✅ Documentation updated (README, JSDoc examples)
7. ✅ 6 missing hooks exported from index.ts
8. ✅ Net LOC reduction ≥ 600 lines

**Metrics:**

| Metric | Before | Target After | Actual After |
|--------|--------|--------------|--------------|
| Total hooks LOC | ~2,800 | ~2,100 | TBD |
| Duplicated LOC | ~350 | <50 | TBD |
| SSE patterns | 3 | 1 | TBD |
| Test coverage | 57% | 85%+ | TBD |
| Public hooks exported | 17 | 23 | TBD |

---

## Consequences

### Positive

1. **Maintenance Burden Reduced 60%**
   - Single source of truth for each pattern
   - Bug fixes in one place, not 13 hooks
   - Easier to reason about SSE integration

2. **Testing Becomes Trivial**
   - Test generics once, get coverage for all consumers
   - New hooks automatically inherit tested patterns
   - No more duplicated test logic

3. **DX Improved Dramatically**
   - Clear decision tree for future hooks
   - Examples in JSDoc for every pattern
   - Onboarding new contributors easier

4. **Code Size Reduced ~600+ LOC**
   - Less code to read, maintain, debug
   - Faster builds, smaller bundle (minimal impact)

5. **Consistent Patterns**
   - All fetch hooks behave identically
   - All SSE hooks use same filtering logic
   - No surprises when switching between hooks

### Negative

1. **Abstraction Overhead**
   - Generic hooks add indirection
   - Debugging stack traces slightly deeper
   - Learning curve for TypeScript generics

2. **Migration Effort**
   - ~3-5 days of work
   - Risk of regressions during migration
   - Requires comprehensive testing

3. **Breaking Changes (Minimal)**
   - Internal implementation changes
   - Possible signature tweaks (mitigated by keeping external API stable)

### Neutral

1. **No API Changes for Consumers**
   - `apps/web` uses hooks same way as before
   - Migration is transparent to end users
   - Only internal implementation changes

---

## Alternatives Considered

### Alternative 1: Keep Current Duplication

**Pros:**
- No migration effort
- No risk of regression
- Known behavior

**Cons:**
- Maintenance burden continues
- Bug fixes require changes to 13 hooks
- New hooks will duplicate patterns
- Test coverage remains low

**Verdict:** ❌ Rejected - technical debt compounds over time

---

### Alternative 2: Use React Query Instead of Custom Hooks

**Pros:**
- Industry standard
- Built-in caching, refetch, mutations
- Excellent DevTools

**Cons:**
- Overkill for our use case (we have custom SSE integration)
- Doesn't solve SSE+fetch coordination
- Large dependency (~40kb gzipped)
- Learning curve for team

**Verdict:** ❌ Rejected - doesn't address SSE patterns, over-engineered

---

### Alternative 3: Zustand Store (Previous Architecture)

**Pros:**
- Centralized state
- Single source of truth
- Already built (before ADR 007)

**Cons:**
- God object anti-pattern (874 lines)
- Immer creates new references → React.memo useless
- Deleted in ADR 007 for good reasons
- Doesn't reduce duplication in hooks

**Verdict:** ❌ Rejected - already migrated away (ADR 007)

---

### Alternative 4: Extract to React Query-Like Wrapper

**Pros:**
- Could build minimal wrapper around our SSE needs
- Full control over implementation
- Optimized for OpenCode patterns

**Cons:**
- Reinventing React Query
- Maintenance burden of custom framework
- Not addressing the immediate duplication problem

**Verdict:** ⏸️ Deferred - consider for future if patterns stabilize further

---

## References

### Audit Documents

- [HOOKS_RECOMMENDATIONS.md](../audits/HOOKS_RECOMMENDATIONS.md) - Phase 3 consolidation plan
- [HOOKS_ARCHITECTURE_AUDIT.md](../audits/HOOKS_ARCHITECTURE_AUDIT.md) - Pattern analysis, duplication metrics

### Related ADRs

- [ADR 001: Next.js Rebuild](./001-nextjs-rebuild.md) - Original architecture vision
- [ADR 002: Effect Migration](./002-effect-migration.md) - Effect integration in core
- [ADR 007: Nuclear Migration Plan](./007-nuclear-migration-plan.md) - Zustand store deletion

### Code Files

| File | Purpose |
|------|---------|
| `packages/react/src/hooks/use-session-list.ts` | Example of fetch pattern (88 LOC) |
| `packages/react/src/hooks/use-messages.ts` | Example of fetch+SSE pattern (146 LOC) |
| `packages/react/src/hooks/use-context-usage.ts` | Example of SSE-only pattern (147 LOC) |
| `packages/react/src/hooks/use-multi-server-sse.ts` | Current SSE subscription primitive (66 LOC) |

---

## Approval Checklist

- [ ] Architecture Lead Review
- [ ] Team Lead Approval
- [ ] Estimated Timeline Agreed (3-5 days)
- [ ] Risk Assessment Reviewed
- [ ] Test Coverage Requirements Agreed (90%+)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-30 | SwarmWorker | Initial proposal - consolidation plan for React hooks |

