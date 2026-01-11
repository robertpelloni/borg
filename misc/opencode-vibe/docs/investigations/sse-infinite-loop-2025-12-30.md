# SSE Infinite Loop Investigation - 2025-12-30

## Problem
Session page loads initially, then freezes ("Page Unresponsive"). Console shows render count climbing rapidly.

## Root Cause Found
**Multiple cascading state updates** across hooks causing infinite re-renders.

### The Loop Pattern (from console logs)
```
[useFetch] render #1 through #10  <- 10 instances render
[useFetch] effect running (x10)   <- all effects fire
[useFetch] refetch called (x10)   <- all fetch
[useFetch] success (x3)           <- successes come back
[useFetch] render #11-20          <- state updates trigger re-renders
[useFetch] success (x2)           <- more successes
[useFetch] render #21-30          <- more re-renders
... continues forever
```

### Why It Looped
1. Multiple `useFetch` instances (useSession, useMessages, useSessionStatus, useCommands, etc.)
2. Each `useFetch` success calls `setState` to update data
3. `useSSEResource` wraps `useFetch` and has `onSuccess` callback that calls `setLocalData(data)`
4. State update in child triggers re-render of parent
5. Parent re-render triggers re-render of all children
6. Effects re-run, more fetches, more state updates
7. **Cascade effect**: 10 hooks × state updates = exponential re-renders

### Key Insight
Even with "stable" callbacks (empty deps, using refs), the **state updates themselves** cascade through the component tree. Each `setState` triggers a re-render, which triggers other components to re-render, which triggers their effects.

## Attempted Fixes (Partial Success)

### Fix 1: useFetch with refs and stable refetch
```typescript
const refetch = useCallback(() => { ... }, []) // Empty deps
useEffect(() => { refetch() }, [refetch])
```
**Result**: Still looping. The `setState` inside `refetch` still triggers cascades.

### Fix 2: Single state object in useFetch
```typescript
const [state, setState] = useState({ data, loading, error })
```
**Result**: Still looping. Fewer state calls but still cascades.

### Fix 3: Remove onSuccess callback from useSSEResource
```typescript
// Before: onSuccess triggers setLocalData
useFetch(fetcher, undefined, {
  onSuccess: (data) => {
    setLocalData(data)  // <-- THIS was a major culprit
  },
})

// After: No callback, just use fetchedData directly
useFetch(fetcher, undefined, { initialData, enabled })
```
**Result**: Testing...

### Fix 4: Simplified useSSEResource (SSE disabled)
Stripped `useSSEResource` down to just wrap `useFetch` with no SSE subscription.
**Result**: Testing...

## Current State
- `useFetch` rewritten with refs and single state object
- `useSSEResource` simplified to just wrap `useFetch` (SSE disabled)
- `OpencodeProvider` memoized
- Other hooks updated with stable callbacks

## Key Learnings

1. **Never set state in useEffect based on other state** - David K. Piano's rule
2. **Callback cascades are deadly** - `onSuccess` → `setState` → re-render → repeat
3. **Multiple hook instances multiply the problem** - 10 hooks = 10x the state updates
4. **Refs don't prevent state cascades** - they prevent effect re-runs, not re-renders from setState
5. **Debug with render counts** - `let count = 0; console.log(++count)` at top of hook
6. **Stub hooks to isolate** - replace hook body with `return { stubData }` to find culprit

## Files Changed
- `packages/react/src/hooks/use-fetch.ts` - refs, single state, stable refetch
- `packages/react/src/hooks/use-sse-resource.ts` - simplified, SSE disabled
- `packages/react/src/hooks/use-session-status.ts` - stable event handler
- `packages/react/src/hooks/use-subagent-sync.ts` - stable event handler
- `packages/react/src/providers/opencode-provider.tsx` - memoized context

## Next Steps If Still Broken
1. Stub out `useFetch` entirely - return static data
2. If that works, the issue is in `useFetch` state management
3. Consider using React Query or SWR which handle this properly
4. Or move to a single global store (Zustand) instead of per-hook state
