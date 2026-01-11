# React Hooks Audit: Executive Summary & Recommendations

Generated: 2024-12-30
Epic: opencode-next--xts0a-mjsra5yco8c

---

## Executive Summary

The `@opencode-vibe/react` hooks library contains **23 hooks** providing data fetching, real-time SSE sync, and state management for the OpenCode web application. The library demonstrates **solid foundational architecture** with consistent patterns, excellent JSDoc coverage (95%), and strong TypeScript usage. However, the audit reveals **4 verified bugs** (2 critical), **significant code duplication** (~350 LOC), and **43% of hooks lacking test coverage**.

The most severe issues are active production bugs: a **stubbed useSessionStatus** in `useSendMessage` that breaks message queuing (causing race conditions), and an **unbounded event accumulator** in `useSSE` that causes memory leaks on long-running sessions. These must be fixed before any production deployment.

Architecturally, the library would benefit from consolidation - 10 hooks share identical fetch+state patterns that could be extracted into 2-3 generic hooks, reducing maintenance surface by ~60%. Additionally, 6 production-ready hooks exist but aren't exported from the public API, creating discoverability blind spots for consumers.

---

## Critical Issues (Fix Before Deploy)

| Issue | Severity | Effort | File(s) | Description |
|-------|----------|--------|---------|-------------|
| Stubbed `useSessionStatus` breaks message queue | P0 | 30min | `use-send-message.ts:7-11` | Local stub returns `{running: false}` always, causing all messages to fire simultaneously instead of queuing |
| EventSource memory leak | P0 | 1h | `use-sse.ts:97` | `setEvents((prev) => [...prev, data])` accumulates unbounded - 17+ MB after 8-hour session |
| Message-to-session mapping race | P0 | 2h | `use-subagent-sync.ts` | Parts arriving before messages get mapped to wrong sessions; `sessionId` option is accepted but never used for filtering |

---

## High Priority Issues

| Issue | Severity | Effort | File(s) | Description |
|-------|----------|--------|---------|-------------|
| 6 hooks not exported | P1 | 15min | `index.ts` | `useProviders`, `useSendMessage`, `useCreateSession`, `useCommands`, `useSubscription`, `useLiveTime`, `useFileSearch` exist but aren't in public API |
| Dead code in `useProvider` | P1 | 30min | `use-provider.ts` | Has local `globalClient` and `useSSE` stubs that should use real implementations |
| `useFileSearch` uses old client stub | P1 | 30min | `use-file-search.ts` | Uses deprecated `createClient` pattern instead of `@opencode-vibe/core/api` |
| No tests for 10 core hooks | P1 | 4h | Multiple | `useMessages`, `useParts`, `useSendMessage`, `useSubagents`, `useCommands`, etc. lack tests |

---

## Medium Priority Issues

| Issue | Severity | Effort | File(s) | Description |
|-------|----------|--------|---------|-------------|
| ~350 LOC duplicated | P2 | 4-6h | 10 hooks | Fetch+state pattern repeated across hooks; should extract `useFetch<T>` |
| 3 different SSE patterns | P2 | 2h | Multiple | Should standardize on `useMultiServerSSE` callback pattern |
| No category grouping in index.ts | P2 | 15min | `index.ts` | Flat export dump; add category comments |
| Missing `@example` in JSDoc | P2 | 30min | `use-context-usage.ts`, `use-send-message.ts` | Critical hooks missing usage examples |
| No README in hooks package | P2 | 1h | `packages/react/` | No entry point documentation |
| `useSubagents` re-render issue | P2 | 1h | `use-subagents.ts` | Creates new action objects on every state change; needs `useCallback` optimization |
| Missing hydration examples | P2 | 30min | Multiple | Hooks support `initialData` but examples don't show SSR usage |

---

## Recommended Refactoring Roadmap

### Phase 1: Critical Bug Fixes (1-2 days)

**Priority: BLOCKING - Must complete before any production use**

1. **Fix `useSendMessage` stub** (30min)
   - Delete stub function at lines 7-11
   - Import real `useSessionStatus` from `./use-session-status`
   - Update usage to match signature: `useSessionStatus({ sessionId, directory })`
   - Verify queue behavior with manual test: send 3 messages rapidly, confirm only 1st fires immediately

2. **Fix `useSSE` memory leak** (1h)
   - Option A (quick): Add ring buffer cap
     ```typescript
     const MAX_EVENTS = 100
     setEvents((prev) => {
       const next = [...prev, data]
       return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
     })
     ```
   - Option B (better): Migrate to callback pattern like `useMultiServerSSE` - don't store events, process and discard

3. **Fix `useSubagentSync` mapping** (2h)
   - Add sessionId filtering in event handler
   - Implement pending parts queue for out-of-order delivery
   - Or: Remove misleading `sessionId` option if hook is intentionally global

4. **Delete `useProvider` stubs** (30min)
   - Remove local `globalClient` stub
   - Remove local `useSSE` stub function
   - Either integrate with real SSE or remove SSE subscription entirely

### Phase 2: DX Improvements (1 day)

**Priority: Important for adoption**

1. **Export missing hooks from index.ts** (15min)
   ```typescript
   export { useProviders } from "./use-providers"
   export { useSendMessage } from "./use-send-message"
   export { useCreateSession } from "./use-create-session"
   export { useCommands } from "./use-commands"
   export { useSubscription } from "./use-subscription"
   export { useLiveTime } from "./use-live-time"
   export { useFileSearch } from "./use-file-search"
   ```

2. **Add category comments to index.ts** (15min)
   ```typescript
   // === Data Fetching ===
   export { useSessionList } from "./use-session-list"
   // ...
   
   // === Real-time (SSE) ===
   export { useSSE } from "./use-sse"
   // ...
   ```

3. **Add missing JSDoc examples** (30min)
   - `useContextUsage` - show token tracking UI pattern
   - `useSendMessage` - show queue length indicator + error handling

4. **Create packages/react/README.md** (1h)
   - Installation
   - Quick start with `useSession` + `useMessages`
   - Hook categories overview
   - Architecture diagram showing SSE flow

5. **Migrate `useFileSearch` to core API** (30min)
   - Replace `createClient` with `@opencode-vibe/core/api` imports

### Phase 3: Architecture Consolidation (3-5 days)

**Priority: Reduces maintenance burden**

1. **Create `useFetch<T>` generic hook** (2h)
   ```typescript
   function useFetch<T, P = void>(
     fetcher: (params: P) => Promise<T>,
     params: P,
     options?: { initialData?: T }
   ): UseFetchReturn<T>
   ```
   - Eliminates ~220 LOC of duplicated state/error handling

2. **Create `useSSEResource<T>` generic hook** (2h)
   ```typescript
   function useSSEResource<T>(options: {
     fetcher: () => Promise<T[]>
     eventType: string
     sessionIdFilter?: string
     getId: (item: T) => string
   }): UseSSEResourceReturn<T>
   ```
   - Encapsulates fetch + SSE + binary search pattern
   - Replaces `useMessages`, `useParts`, `useSession` implementations

3. **Create `useSSEState<T>` generic hook** (1h)
   ```typescript
   function useSSEState<T>(options: {
     eventType: string | ((type: string) => boolean)
     reducer: (state: T, event: GlobalEvent) => T
     initialState: T
   }): T
   ```
   - Replaces `useContextUsage`, `useCompactionState`, `useSessionStatus` patterns

4. **Standardize SSE integration** (2h)
   - All hooks should use `useMultiServerSSE` for event subscription
   - Remove direct `multiServerSSE.onEvent` calls
   - Deprecate `useSSE` in favor of callback pattern

5. **Optimize `useSubagents` re-renders** (1h)
   - Extract action creators with `useCallback`
   - Remove `state` from dependency array of `useMemo`
   - Consider `useReducer` pattern for complex state

### Phase 4: Test Coverage (ongoing)

**Priority: Prevents regressions**

1. **Add tests for untested hooks** - Priority order:
   - `useSendMessage` - Complex queue logic, slash command parsing (HIGH)
   - `useMessages` / `useParts` - Core data with SSE integration (HIGH)
   - `useSubagents` - Complex state management (MEDIUM)
   - `useCommands` - API fetch + builtin merging (MEDIUM)
   - `useProjects` / `useServers` - Standard fetch patterns (LOW)

2. **Add runtime validation for SSE events**
   ```typescript
   // Replace type assertions with Zod validation
   const message = MessageSchema.parse(properties)
   ```

3. **Add integration tests for race conditions**
   - Test fetch + SSE coordination
   - Test message queue behavior under rapid sends
   - Test part-to-session mapping with out-of-order events

---

## Quick Wins (< 1 hour each)

| Task | Effort | Impact | Details |
|------|--------|--------|---------|
| Export 6 hidden hooks | 15min | High | Single index.ts edit unlocks 8 production-ready hooks |
| Add category comments | 15min | Medium | Improves discoverability dramatically |
| Fix `useSendMessage` stub | 30min | Critical | Delete 5 lines, add 1 import - fixes production bug |
| Add ring buffer to useSSE | 30min | Critical | 3-line change prevents memory leak |
| Add `@example` to useContextUsage | 15min | Medium | Most-used hook missing usage docs |
| Delete useProvider stubs | 30min | Medium | Remove 30 lines of dead code |

---

## Metrics Summary

| Metric | Current | After Phase 1 | After All Phases |
|--------|---------|---------------|------------------|
| Critical bugs | 3 | 0 | 0 |
| Test coverage | 57% | 57% | 85%+ |
| Public hooks | 17 | 24 | 24 |
| Duplicated LOC | ~350 | ~350 | ~50 |
| SSE patterns | 3 | 3 | 1 |

---

## Appendix: Full Audit Links

- [DX Audit](./HOOKS_DX_AUDIT.md) - Discoverability, JSDoc coverage, naming conventions
- [Architecture Audit](./HOOKS_ARCHITECTURE_AUDIT.md) - Patterns, duplication, dependency analysis
- [Implementation Audit](./HOOKS_IMPLEMENTATION_AUDIT.md) - Test coverage, error handling, TypeScript strictness
- [Bug Verification](./HOOKS_BUG_VERIFICATION.md) - Detailed analysis of 4 verified bugs with fix recommendations

---

## Bug Reference Summary

| Bug | Location | Root Cause | Fix |
|-----|----------|------------|-----|
| Message queue race | `use-send-message.ts:7-11` | Stub function shadows real hook | Import `useSessionStatus` from `./use-session-status` |
| Memory leak | `use-sse.ts:97` | Unbounded array growth in `setEvents` | Add ring buffer or migrate to callback pattern |
| Session mapping | `use-subagent-sync.ts` | `sessionId` option ignored; fallback uses `messageID` as session | Add sessionId filter; queue pending parts |
| Fetch/SSE race | `use-messages.ts`, `use-parts.ts` | N/A - Already fixed | `fetchInProgressRef` coordination pattern is correct |

---

*Synthesis completed: 2024-12-30*
*Epic: opencode-next--xts0a-mjsra5yco8c*
