# SSE Stub Fix Plan

**Status:** IN PROGRESS  
**Created:** 2025-12-30  
**Epic:** Fix all SSE stub hooks from ADR 007 nuclear migration

---

## Problem Statement

During the ADR 007 nuclear migration (Zustand store deletion), 5 React hooks were left as **stubs** - they have the correct signatures but don't actually work. This breaks real-time SSE streaming after initial page load.

### Root Cause

The `useMultiServerSSE` hook is the **foundation** - it's supposed to:
1. Discover all OpenCode servers
2. Connect to each server's SSE endpoint
3. Forward events to other hooks

But it's a stub that just logs "Would connect to..." and does nothing.

### Impact

| Feature | Status | User Experience |
|---------|--------|-----------------|
| Session status indicator | ❌ Broken | Always shows "idle" even when running |
| Context usage bar | ❌ Broken | Always shows 0% |
| Compaction indicator | ❌ Broken | Never shows compaction progress |
| Subagent display | ❌ Broken | Subagent sessions don't update |
| Message streaming | ⚠️ Partial | Initial load works, updates don't |

---

## Stub Inventory

### 1. `useMultiServerSSE` (CRITICAL - Foundation)

**File:** `packages/react/src/hooks/use-multi-server-sse.ts`

**Current State:** Logs "Would connect to..." but doesn't connect

**What it should do:**
1. Use `useServers()` to discover servers
2. Use core `MultiServerSSE` class from `@opencode-vibe/core/sse`
3. Start SSE connections on mount
4. Forward events via `onEvent` callback
5. Clean up on unmount

**Core class available:** `packages/core/src/sse/multi-server-sse.ts` - fully implemented!

**Fix approach:** Wire up the React hook to use the existing core class.

---

### 2. `useSessionStatus` (HIGH - User-facing)

**File:** `packages/react/src/hooks/use-session-status.ts`

**Current State:** Fetches once on mount, always returns `running: false`

**What it should do:**
1. Fetch initial status from `sessions.get()`
2. Subscribe to SSE events for `session.status` type
3. Update `running` state when status changes
4. Derive status from SSE event payload

**Fix approach:** Add SSE subscription using `useMultiServerSSE` callback.

---

### 3. `useContextUsage` (MEDIUM - User-facing)

**File:** `packages/react/src/hooks/use-context-usage.ts`

**Current State:** Returns hardcoded defaults

**What it should do:**
1. Subscribe to SSE events for `context.usage` type
2. Update state with token counts from event payload
3. Calculate derived values (percentage, isNearLimit)

**Fix approach:** Add SSE subscription, parse event payload.

---

### 4. `useCompactionState` (MEDIUM - User-facing)

**File:** `packages/react/src/hooks/use-compaction-state.ts`

**Current State:** Returns hardcoded defaults

**What it should do:**
1. Subscribe to SSE events for `compaction.*` types
2. Track compaction progress: pending → generating → complete
3. Update `isCompacting` flag

**Fix approach:** Add SSE subscription, track state machine.

---

### 5. `useSubagentSync` (MEDIUM - Feature)

**File:** `packages/react/src/hooks/use-subagent-sync.ts`

**Current State:** Complete no-op (empty function)

**What it should do:**
1. Subscribe to SSE events for subagent-related types
2. Call `subagents.*` API to register/update subagent state
3. Handle: registerSubagent, addMessage, updateMessage, addPart, updatePart, setStatus

**Fix approach:** Add SSE subscription, dispatch to subagents API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    useMultiServerSSE                         │
│  - Discovers servers via useServers()                        │
│  - Uses core MultiServerSSE class                            │
│  - Forwards events via onEvent callback                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSE Events
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Event Distribution                         │
│  - Each hook filters events by type + sessionId              │
│  - Updates local state based on event payload                │
└──────────────────────────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┬───────────────┐
       ▼               ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│useSession   │ │useContext   │ │useCompaction│ │useSubagent  │
│Status       │ │Usage        │ │State        │ │Sync         │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Implementation Order

**Sequential dependencies:**
1. `useMultiServerSSE` MUST be fixed first (foundation)
2. Other hooks can be fixed in parallel after that

**Priority order:**
1. **useMultiServerSSE** - Unblocks everything else
2. **useSessionStatus** - Most visible to users (status indicator)
3. **useContextUsage** - User-facing (context bar)
4. **useCompactionState** - User-facing (compaction indicator)
5. **useSubagentSync** - Feature (subagent display)

---

## Subtasks

### Subtask 1: Fix useMultiServerSSE (BLOCKING)
- [ ] Import `multiServerSSE` singleton from `@opencode-vibe/core/sse`
- [ ] Call `multiServerSSE.start()` on mount
- [ ] Call `multiServerSSE.onEvent()` to subscribe
- [ ] Forward events to `options.onEvent` callback
- [ ] Call cleanup on unmount
- [ ] Write tests

### Subtask 2: Fix useSessionStatus
- [ ] Add SSE event subscription
- [ ] Filter for `session.status` events matching sessionId
- [ ] Parse status from `event.payload.properties.status.type`
- [ ] Update `running` state based on "busy" vs "idle"
- [ ] Write tests

### Subtask 3: Fix useContextUsage
- [ ] Add SSE event subscription
- [ ] Filter for `context.usage` events matching sessionId
- [ ] Parse token counts from event payload
- [ ] Calculate percentage, remaining, isNearLimit
- [ ] Write tests

### Subtask 4: Fix useCompactionState
- [ ] Add SSE event subscription
- [ ] Filter for `compaction.*` events matching sessionId
- [ ] Track state machine: pending → generating → complete
- [ ] Update isCompacting, progress, startedAt
- [ ] Write tests

### Subtask 5: Fix useSubagentSync
- [ ] Add SSE event subscription
- [ ] Filter for subagent-related events
- [ ] Dispatch to subagents API based on event type
- [ ] Handle all subagent lifecycle events
- [ ] Write tests

### Subtask 6: Verification
- [ ] Run `bun run typecheck` - must exit 0
- [ ] Run `bun test` - all tests pass
- [ ] Manual test: session status indicator updates
- [ ] Manual test: context usage bar updates
- [ ] Manual test: compaction indicator shows progress

---

## SSE Event Types Reference

From `packages/core/src/sse/multi-server-sse.ts`:

```typescript
interface SSEEvent {
  directory: string
  payload: { 
    type: string
    properties: Record<string, unknown> 
  }
}
```

**Event types to handle:**

| Event Type | Hook | Payload Properties |
|------------|------|-------------------|
| `session.status` | useSessionStatus | `sessionID`, `status: { type: "busy" \| "idle" }` |
| `context.usage` | useContextUsage | `sessionID`, `used`, `limit`, `tokens` |
| `compaction.started` | useCompactionState | `sessionID`, `automatic` |
| `compaction.progress` | useCompactionState | `sessionID`, `stage` |
| `compaction.completed` | useCompactionState | `sessionID` |
| `message.created` | useSubagentSync | `sessionID`, `message` |
| `message.updated` | useSubagentSync | `sessionID`, `message` |
| `part.created` | useSubagentSync | `sessionID`, `part` |
| `part.updated` | useSubagentSync | `sessionID`, `part` |

---

## Success Criteria

1. **Typecheck passes:** `bun run typecheck` exits 0
2. **Tests pass:** `bun test` exits 0
3. **Session status updates:** Green dot pulses when session is running
4. **Context bar updates:** Shows token usage during conversation
5. **Compaction shows:** Indicator appears during compaction
6. **No console errors:** No "Would connect to..." logs

---

## Progress Log

| Date | Subtask | Status | Notes |
|------|---------|--------|-------|
| 2025-12-30 | Plan created | ✅ | Identified 5 stubs |
| | Subtask 1 | ⏳ | In progress |
| | Subtask 2 | ⏳ | Pending |
| | Subtask 3 | ⏳ | Pending |
| | Subtask 4 | ⏳ | Pending |
| | Subtask 5 | ⏳ | Pending |
| | Subtask 6 | ⏳ | Pending |

---

## Files to Modify

```
packages/react/src/hooks/
├── use-multi-server-sse.ts    # CRITICAL - fix first
├── use-session-status.ts      # HIGH
├── use-context-usage.ts       # MEDIUM
├── use-compaction-state.ts    # MEDIUM
└── use-subagent-sync.ts       # MEDIUM
```

## Core Dependencies (Already Implemented)

```
packages/core/src/sse/
└── multi-server-sse.ts        # MultiServerSSE class - USE THIS

packages/core/src/api/
├── sessions.ts                # sessions.get()
└── subagents.ts               # subagents.* API
```
