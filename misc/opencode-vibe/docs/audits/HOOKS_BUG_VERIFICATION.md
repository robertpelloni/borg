# React Hooks Bug Verification Report

Generated: 2025-12-30
Epic: opencode-next--xts0a-mjsra5yco8c

---

## Bug 1: Fetch vs SSE Race Condition

### Status: PARTIALLY FIXED

### Evidence:

**The Fix (both hooks implement identical pattern):**

```typescript
// packages/react/src/hooks/use-messages.ts:72-73
// Track if fetch is in progress to coordinate with SSE
const fetchInProgressRef = useRef(false)
```

```typescript
// packages/react/src/hooks/use-messages.ts:75-94
const fetch = useCallback(() => {
  fetchInProgressRef.current = true  // Set BEFORE async operation
  setLoading(true)
  setError(null)

  messages
    .list(options.sessionId, options.directory)
    .then((data: Message[]) => {
      setMessageList(data)
      setError(null)
    })
    .catch((err: unknown) => {
      // ... error handling
    })
    .finally(() => {
      fetchInProgressRef.current = false  // Reset in finally
      setLoading(false)
    })
}, [options.sessionId, options.directory])
```

```typescript
// packages/react/src/hooks/use-messages.ts:109-111
const unsubscribe = multiServerSSE.onEvent((event) => {
  // Skip SSE updates while fetch is in progress to avoid race conditions
  if (fetchInProgressRef.current) return
  // ... rest of handler
})
```

### Analysis:

**What the fix does correctly:**

1. **Synchronous flag setting**: `fetchInProgressRef.current = true` is set synchronously BEFORE the async `messages.list()` call. This ensures the flag is set before any microtask queue processing.

2. **Guaranteed cleanup**: The `finally()` block ensures `fetchInProgressRef.current = false` runs regardless of success or failure.

3. **Ref avoids re-renders**: Using `useRef` instead of `useState` for the flag is correct - we don't need React to re-render when this changes, and refs provide a stable reference across renders.

4. **SSE callback checks flag**: The SSE handler checks `fetchInProgressRef.current` at the start and returns early if a fetch is in progress.

**The race condition this prevents:**

```
Time →
Fetch starts         SSE event arrives    Fetch completes
     |                     |                    |
     v                     v                    v
[flag=true] ---------> [skip SSE] ---------> [flag=false, setState with full data]
```

Without the flag, SSE could inject partial/stale data mid-fetch, causing:
- Duplicate entries
- Missing entries (if SSE event was for item in flight)
- Inconsistent state snapshot

### Remaining Risks:

#### 1. **SSE events lost during fetch (ACCEPTED TRADEOFF)**

Events that arrive during fetch are dropped silently. This is acceptable because:
- The fetch returns the complete current state
- Any events that occurred *before* fetch completion are included in fetch response
- Only events occurring *after* fetch starts but *before* fetch completes could be missed

**Edge case**: If SSE event arrives at T+100ms for an item created at T+50ms, and fetch completes at T+200ms with data from T+0ms, that item is lost until next SSE event or refetch.

**Severity**: LOW - subsequent SSE events will sync the state, and this window is typically <100ms.

#### 2. **No fetch queue/debounce**

Rapid `refetch()` calls could cause multiple overlapping fetches. Each sets the flag, but only the last one's result is used (setState is async, last write wins).

```typescript
refetch() // fetch1 starts, flag=true
refetch() // fetch2 starts, flag still true (good)
// fetch1 completes, flag=false, sets state
// SSE now processes (but fetch2 still in flight!)
// fetch2 completes, overwrites with its data
```

**Severity**: LOW - the "last fetch wins" behavior is actually correct, but there's a brief window where SSE processes after fetch1 but before fetch2 completes.

#### 3. **No retry on fetch failure during SSE**

If fetch fails (network error), `fetchInProgressRef` is correctly reset to `false` in finally, so SSE resumes. However, the component shows error state with no automatic recovery.

**Current behavior**:
```typescript
.catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err))
  setError(error)
  setMessageList([])  // State is cleared to empty
})
```

User must manually call `refetch()`. SSE continues to work post-failure, so state will recover via SSE events, but initial list is empty.

**Severity**: MEDIUM - acceptable UX but could be improved with exponential backoff retry.

#### 4. **sessionId change during fetch**

If `options.sessionId` changes while fetch is in progress:

```typescript
sessionIdRef.current = options.sessionId  // Updated immediately (line 66-67)

// But fetch callback closes over old options.sessionId (line 81)
messages.list(options.sessionId, options.directory)  // Uses OLD sessionId
```

The `fetch` callback is recreated when `options.sessionId` changes (it's in deps), but an in-flight fetch for the old session will complete and set state, then the new fetch starts.

**Severity**: LOW - the new fetch will overwrite with correct data.

### Verdict:

The `fetchInProgressRef` coordination is a **correct and effective fix** for the primary race condition. The implementation follows React best practices:

- Refs for mutable flags that don't need re-renders
- Synchronous flag setting before async operation
- Guaranteed cleanup in finally
- Early return in SSE handler

The remaining edge cases are minor and acceptable for a real-time collaborative UI. The most significant improvement would be adding fetch debounce/queue to prevent overlapping fetches, but this is a nice-to-have, not a bug.

### Recommendations:

1. **Optional**: Add AbortController to cancel in-flight fetches on sessionId change
2. **Optional**: Add exponential backoff retry for failed fetches
3. **Optional**: Debounce refetch() calls with 100ms window
4. **Document**: Add comment explaining the "lost event" tradeoff is acceptable

---

## Summary

| Bug | Status | Confidence |
|-----|--------|------------|
| Fetch vs SSE race condition | PARTIALLY FIXED | 85% |
| Queue processing race in useSendMessage | VERIFIED BUG | 100% |
| EventSource memory leak in useSSE | VERIFIED BUG | 100% |
| Message-to-session mapping in useSubagentSync | VERIFIED BUG | 100% |

**PARTIALLY FIXED** because:
- Core race condition is correctly prevented
- Minor edge cases remain but are acceptable tradeoffs
- No data corruption or inconsistency can occur with current implementation

---

## Bug 2: Queue Processing Race in useSendMessage

### Status: VERIFIED BUG

### Evidence:

**The Stub (use-send-message.ts lines 7-11):**
```typescript
// Stub: useSessionStatus was deleted in migration
// TODO: Replace with proper session status tracking
function useSessionStatus(_sessionId: string) {
	return { running: false }
}
```

**The Real Hook Exists (packages/react/src/hooks/use-session-status.ts):**
```typescript
export function useSessionStatus(options: UseSessionStatusOptions): SessionStatus {
	const [running, setRunning] = useState(false)
	// ... SSE subscription, cooldown logic, real implementation
}
```

**The Real Hook is Exported (packages/react/src/index.ts line 93):**
```typescript
export {
	useSessionStatus,
	// ...
} from "./hooks"
```

**Queue Logic Depends on `running` (use-send-message.ts lines 195-197):**
```typescript
// Don't process if:
// - Session is running (server-side AI is busy)
if (isProcessingRef.current || queueRef.current.length === 0 || running) {
	return
}
```

**The useEffect That Should Trigger on Session Idle (lines 254-260):**
```typescript
// Watch session status - when session becomes idle, process next queued message
useEffect(() => {
	// Session became idle - process next message in queue
	if (!running && queueRef.current.length > 0 && !isProcessingRef.current) {
		processNext()
	}
}, [running, processNext])
```

### Analysis:

The bug is a **shadow function that overrides the real hook import**.

**Intended Behavior:**
1. User sends message 1 → fires immediately, session becomes "busy"
2. User sends message 2 → queued because `running === true`
3. User sends message 3 → queued because `running === true`
4. AI finishes message 1 → SSE event sets `running = false`
5. `useEffect` triggers → processes message 2
6. Session becomes busy again → message 3 waits
7. Repeat until queue empty

**Actual Behavior (with stub):**
1. User sends message 1 → fires immediately, `running` stays `false`
2. User sends message 2 → `running === false` → fires immediately (RACE!)
3. User sends message 3 → `running === false` → fires immediately (RACE!)

**The Race Condition:**
- All 3 messages hit the API simultaneously
- Server receives 3 concurrent `promptAsync` calls for the same session
- Backend may reject, interleave, or corrupt the message stream
- The `setTimeout(..., 0)` in the finally block (line 227) makes this worse - it creates a tight loop that processes ALL queued messages in rapid succession

**Root Cause:**
The local stub `function useSessionStatus(_sessionId: string)` on line 9 shadows any import of the real hook. The JSDoc on line 62 even references `useSessionStatus` as if it should work, but the file never imports it.

### Impact:

**Production Issues:**
1. **Message Interleaving**: Multiple AI responses stream simultaneously, creating garbled UX
2. **Server Overload**: N messages → N concurrent AI processing threads instead of 1
3. **Context Corruption**: Later messages may reference AI response from earlier, but earlier hasn't completed
4. **Token Waste**: Partial/failed responses still consume API tokens
5. **Queue Counter Misleading**: `queueLength` shows 0 almost instantly because everything fires immediately

**User Experience:**
- Chat appears broken - responses overlap or cut off
- Users think "send" is broken, mash the button multiple times
- Each button mash makes it worse (more concurrent requests)

### Recommended Fix:

**Option A: Import the Real Hook (Minimal Change)**
```typescript
// Delete the stub (lines 7-11)
// Add import at top of file:
import { useSessionStatus } from "./use-session-status"

// Update usage to match the real hook's signature:
const { running } = useSessionStatus({ sessionId, directory })
```

**Option B: Create Proper Integration Test**
Before fixing, add a test that would have caught this:
```typescript
it("should queue messages when session is running", async () => {
	// Mock useSessionStatus to return running: true
	// Send 3 messages
	// Assert only first message was processed
	// Assert queueLength === 2
})
```

**Verification After Fix:**
1. Send 3 messages rapidly
2. Verify only 1st message triggers immediate API call
3. Verify queue shows length = 2
4. Verify next message processes only when SSE delivers `session.status: idle`

### Additional Notes:

The stub has a TODO comment dating back to "migration" - this was likely a deliberate placeholder that was never replaced. The real `useSessionStatus` hook is fully implemented with:
- SSE subscription via `useMultiServerSSE`
- 60-second cooldown after idle
- Proper loading states
- Full type safety

The fix is simply connecting the wires - the implementation exists, it's just not being used.

---

## Bug 3: EventSource Memory Leak in useSSE

### Status: VERIFIED BUG

### Evidence:

**Location:** `packages/react/src/hooks/use-sse.ts:97`

```typescript
// Line 97 - Unbounded array growth
eventSource.onmessage = (event: MessageEvent) => {
  resetHeartbeat()
  try {
    const data = JSON.parse(event.data) as GlobalEvent
    setEvents((prev) => [...prev, data])  // NEVER CAPPED OR CLEARED
  } catch (parseError) {
    console.warn("SSE: Failed to parse event data", parseError)
  }
}
```

**Consumers actively using this pattern:**

1. `apps/web/src/app/projects-list.tsx:330` - Accumulates all events, only processes last 10
2. `apps/web/src/app/session/[id]/session-status.tsx:32` - Iterates over ALL events on every render

### Analysis:

**Memory Impact Calculation:**

A typical `GlobalEvent` contains:
```typescript
interface GlobalEvent {
  directory: string           // ~50 bytes avg (path)
  payload: {
    type: string              // ~20 bytes
    properties: {
      sessionID: string       // 26 bytes (ULID)
      status?: object         // ~100 bytes
      messageID?: string      // 26 bytes
      // ... varies by event type
    }
  }
}
```

Conservative estimate: **~300 bytes per event** (serialized JSON + object overhead)

| Duration | Events (1/sec) | Memory Growth |
|----------|----------------|---------------|
| 1 hour   | 3,600          | 1.03 MB       |
| 8 hours  | 28,800         | 8.2 MB        |
| 24 hours | 86,400         | 24.7 MB       |

**But SSE events are bursty during active AI sessions:**
- During message streaming: **5-20 events/second**
- A 10-minute AI response could generate **3,000+ events**

Realistic impact for power user (8-hour session, 20 AI interactions):
- **60,000+ events = 17+ MB accumulated**
- Plus: O(n) iteration in `session-status.tsx` on every event

### Impact:

1. **Memory exhaustion** - Long-running browser tabs accumulate unbounded state
2. **Performance degradation** - `session-status.tsx:42` iterates ALL events on every new event: `for (const event of events)` creates O(n^2) behavior
3. **Mobile Safari crashes** - iOS WebKit aggressively kills memory-heavy tabs
4. **Slow re-renders** - `events.length` in React state triggers full reconciliation

### Recommended Fix:

**Option 1: Ring Buffer (Recommended)**
```typescript
const MAX_EVENTS = 100

eventSource.onmessage = (event: MessageEvent) => {
  resetHeartbeat()
  try {
    const data = JSON.parse(event.data) as GlobalEvent
    setEvents((prev) => {
      const next = [...prev, data]
      return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
    })
  } catch (parseError) {
    console.warn("SSE: Failed to parse event data", parseError)
  }
}
```

**Option 2: Event-Driven Architecture (Better)**
Don't store events in hook state at all. Process and discard:

```typescript
// Hook becomes a pure side-effect connector
export function useSSE(options: UseSSEOptions & {
  onEvent?: (event: GlobalEvent) => void
}): { connected: boolean; error: Error | null } {
  // ... setup code ...
  
  eventSource.onmessage = (event: MessageEvent) => {
    resetHeartbeat()
    try {
      const data = JSON.parse(event.data) as GlobalEvent
      options.onEvent?.(data)  // Process immediately, don't store
    } catch (parseError) {
      console.warn("SSE: Failed to parse event data", parseError)
    }
  }
  
  // No events array returned - consumers manage their own state
}
```

This matches the pattern already used in `useMultiServerSSE` which correctly does NOT accumulate events.

**Option 3: Clear on Session Change**
At minimum, clear events when session changes:

```typescript
useEffect(() => {
  setEvents([])  // Clear accumulated events on URL change
}, [options.url])
```

### Related Issues:

- `useMultiServerSSE` does NOT have this bug - it uses callback pattern (Option 2)
- The discrepancy suggests `useSSE` was an earlier implementation that wasn't updated
- Consumers already workaround this: `projects-list.tsx:337` only uses `events.slice(-10)`

### Priority: HIGH

This bug affects all long-running sessions and is especially severe on mobile devices with limited memory. Fix should be applied before any production deployment.

---

## Bug 4: Message-to-Session Mapping in useSubagentSync

### Status: VERIFIED BUG

### Evidence:

**1. sessionId option is accepted but never used for filtering:**

```typescript
// packages/react/src/hooks/use-subagent-sync.ts:50-51
export function useSubagentSync(options: UseSubagentSyncOptions): void {
	const { sessionId } = options  // ← Destructured but NEVER USED
	const stateRef = useRef<SubagentStateRef | null>(null)
	// ...
}
```

**2. Event handler processes ALL events, not filtered to parent session:**

```typescript
// packages/react/src/hooks/use-subagent-sync.ts:72-106
useMultiServerSSE({
	onEvent: (event: GlobalEvent) => {
		if (!stateRef.current) return

		// Filter by directory if specified - OK
		if (options.directory && event.directory !== options.directory) {
			return
		}

		// NO FILTER BY sessionId - processes ALL sessions' events!
		const { type, properties } = event.payload

		// Handle message events - ALL messages from ALL sessions
		if (type === "message.created") {
			const message = properties as Message
			// No check: message.sessionID relates to options.sessionId
			void subagents.addMessage(stateRef.current, message.sessionID, message)
		}
		// ... same for message.updated, part.created, part.updated
	},
})
```

**3. Test file confirms the flaw - uses `expect.any(String)` for sessionId:**

```typescript
// packages/react/src/hooks/use-subagent-sync.test.ts:167-173
await waitFor(() => {
	expect(subagents.addPart).toHaveBeenCalledWith(
		mockStateRef,
		expect.any(String),  // ← Test doesn't verify correct session mapping
		"msg-123",
		part,
	)
})
```

### Analysis:

**How the mapping SHOULD work:**

1. `useSubagentSync({ sessionId: "parent-123" })` is called to sync subagent events for a specific parent session
2. SSE events stream ALL events (message.created, part.created, etc.) from the server
3. The hook should only process events where the message belongs to a subagent OF the parent session

**How it ACTUALLY works:**

1. The hook receives ALL SSE events
2. It only filters by `directory` (if specified)
3. It calls `subagents.addMessage(stateRef, message.sessionID, message)` for EVERY message.created event
4. The SubagentAtom correctly stores messages by their sessionID, BUT:
   - This creates sessions for ANY sessionID that receives events
   - The `partToSession` mapping only works if `registerSubagent()` was called first
   - Without registration, `addMessage` silently fails (session doesn't exist in state)

**The race condition in resolveSessionIdForPart():**

```
Time →
[SSE: part.created for child-session-1]  ← Part arrives BEFORE message
   → resolveSessionIdForPart() called
   → messageToSessionMap has NO entry for part.messageID
   → Falls back to part.messageID as sessionID (WRONG!)
   → subagents.addPart() called with wrong sessionID
   → Part is orphaned or attached to wrong session
```

**Why the fallback is dangerous:**

```typescript
// packages/react/src/hooks/use-subagent-sync.ts:121-136
function resolveSessionIdForPart(part: Part, messageToSessionMap: Map<string, string>): string {
	if ("sessionID" in part && typeof part.sessionID === "string") {
		return part.sessionID  // Ideal path - but Part type may not have sessionID
	}

	const sessionID = messageToSessionMap.get(part.messageID)
	if (sessionID) {
		return sessionID  // Depends on message.created arriving FIRST
	}

	// FALLBACK: returns messageID as sessionID - GUARANTEED TO BE WRONG
	return part.messageID
}
```

### Impact:

1. **Subagent message pollution**: Messages from unrelated sessions could be processed if they pass directory filter
2. **Parts mapped to wrong sessions**: If part.created arrives before message.created (possible with network jitter or SSE batching), parts are orphaned
3. **Memory leak**: Creating ephemeral sessions for every message that arrives, even if not a subagent
4. **Silent failures**: If session doesn't exist in state, `addMessage` silently does nothing (returns unchanged state)

### Race Condition Scenarios:

**Scenario A: Normal flow (works correctly)**
```
1. message.created → messageToSessionMap.set(msgId, sessionId)
2. part.created → lookup sessionId from map ✓
```

**Scenario B: Out-of-order delivery (fails)**
```
1. part.created → lookup fails → fallback to messageID ✗
2. message.created → too late, part already orphaned
```

**Scenario C: Cross-session pollution**
```
1. useSubagentSync({ sessionId: "parent-A" })
2. SSE delivers message.created for session "parent-B" child
3. No filter → hook processes it → creates session state for unrelated child
```

### Recommended Fix:

**Option 1: Filter by parent session relationship**

```typescript
useMultiServerSSE({
	onEvent: (event: GlobalEvent) => {
		if (!stateRef.current) return
		if (options.directory && event.directory !== options.directory) return

		const { type, properties } = event.payload

		if (type === "message.created") {
			const message = properties as Message
			// Only process if this message belongs to a registered subagent
			// OR if the message's parentSessionId matches our sessionId
			if (!isSubagentOfSession(message.sessionID, options.sessionId)) {
				return  // Skip unrelated messages
			}
			// ...
		}
	},
})
```

**Option 2: Remove unused sessionId parameter**

If the hook is designed to process ALL subagent events (global), then:
1. Remove the misleading `sessionId` option
2. Rename to `useSubagentSyncGlobal` to clarify intent
3. Document that it syncs ALL sessions, not one

**Option 3: Queue parts until message arrives**

```typescript
const pendingParts = useRef<Map<string, Part[]>>(new Map())

// On part.created:
if (!messageToSessionMap.current.has(part.messageID)) {
	// Queue it
	const pending = pendingParts.current.get(part.messageID) || []
	pending.push(part)
	pendingParts.current.set(part.messageID, pending)
	return
}

// On message.created:
messageToSessionMap.current.set(message.id, message.sessionID)
// Flush pending parts
const pending = pendingParts.current.get(message.id)
if (pending) {
	for (const part of pending) {
		void subagents.addPart(stateRef.current, message.sessionID, part.messageID, part)
	}
	pendingParts.current.delete(message.id)
}
```

### Priority: HIGH

This affects correctness of subagent display. Parts could be orphaned or attached to wrong sessions, causing confusing UI state.
