# SSE Event Wiring Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ███████╗███████╗███████╗    ███████╗██╗   ██╗███████╗███╗   ██╗████████╗ │
│   ██╔════╝██╔════╝██╔════╝    ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝ │
│   ███████╗███████╗█████╗      █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║    │
│   ╚════██║╚════██║██╔══╝      ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║    │
│   ███████║███████║███████╗    ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║    │
│   ╚══════╝╚══════╝╚══════╝    ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝    │
│                                                                             │
│   How React hooks subscribe to real-time updates from OpenCode servers      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Overview

This document describes how SSE (Server-Sent Events) flow from OpenCode servers to React hooks in the opencode-vibe web app. Understanding this flow is critical when:

1. Debugging "messages not updating" issues
2. Adding new real-time features
3. Refactoring state management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SSE DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OpenCode Server (Bun)                                                      │
│  └─ GET /global/event                                                       │
│     └─ SSE stream with events like:                                         │
│        • message.updated                                                    │
│        • message.part.updated                                               │
│        • session.created / session.updated                                  │
│        • session.status                                                     │
│                                                                             │
│           ↓                                                                 │
│                                                                             │
│  MultiServerSSE Singleton (@opencode-vibe/core/sse)                         │
│  └─ Discovers servers via /api/opencode-servers                             │
│  └─ Maintains SSE connections to each server                                │
│  └─ Parses events, calls registered callbacks                               │
│                                                                             │
│           ↓                                                                 │
│                                                                             │
│  React Hooks (@opencode-vibe/react)                                         │
│  └─ useMessages() - subscribes to message.updated                           │
│  └─ useParts() - subscribes to message.part.updated                         │
│  └─ useSession() - subscribes to session.created/updated                    │
│  └─ useSessionStatus() - subscribes to session.status                       │
│                                                                             │
│           ↓                                                                 │
│                                                                             │
│  React Components                                                           │
│  └─ SessionMessages, PartRenderer, etc.                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Server Event Types

The OpenCode server emits these event types. **These are the actual types - don't guess!**

### Message Events

| Event Type | Properties | Description |
|------------|------------|-------------|
| `message.updated` | `{ info: Message }` | Message created or updated |
| `message.removed` | `{ sessionID, messageID }` | Message deleted |

**Note:** Server uses `message.updated` for both create and update operations.

### Part Events

| Event Type | Properties | Description |
|------------|------------|-------------|
| `message.part.updated` | `{ part: Part }` | Part created or updated (streaming content) |
| `message.part.removed` | `{ messageID, partID }` | Part deleted |

**Note:** Parts include `sessionID` in the part object for filtering.

### Session Events

| Event Type | Properties | Description |
|------------|------------|-------------|
| `session.created` | `{ info: Session }` | New session created |
| `session.updated` | `{ info: Session }` | Session metadata updated |
| `session.status` | `{ sessionID, status: { type: "busy" \| "idle" } }` | Running state changed |

### Other Events

| Event Type | Properties | Description |
|------------|------------|-------------|
| `server.connected` | `{}` | Initial connection established |
| `todo.updated` | `{ sessionID, todos: Todo[] }` | Todo list changed |
| `compaction.started` | `{ sessionID, automatic }` | Compaction began |
| `compaction.progress` | `{ sessionID, progress }` | Compaction stage update |
| `compaction.completed` | `{ sessionID }` | Compaction finished |

---

## Hook Implementation Pattern

Each hook follows this pattern for SSE subscription:

```typescript
export function useMessages(options: { sessionId: string }) {
  const [data, setData] = useState<Message[]>([])
  
  // Track sessionId in ref to avoid stale closures
  const sessionIdRef = useRef(options.sessionId)
  sessionIdRef.current = options.sessionId

  // Initial fetch
  useEffect(() => {
    messages.list(options.sessionId).then(setData)
  }, [options.sessionId])

  // SSE subscription for real-time updates
  useEffect(() => {
    const unsubscribe = multiServerSSE.onEvent((event) => {
      const { type, properties } = event.payload

      // 1. Filter by event type
      if (type !== "message.updated") return

      // 2. Extract data from correct property
      const messageData = properties.info as Message
      if (!messageData) return

      // 3. Filter by session
      if (messageData.sessionID !== sessionIdRef.current) return

      // 4. Update state with binary search for O(log n)
      setData((prev) => {
        const { found, index } = Binary.search(prev, messageData.id, (m) => m.id)
        if (found) {
          const updated = [...prev]
          updated[index] = messageData
          return updated
        }
        return Binary.insert(prev, messageData, (m) => m.id)
      })
    })

    return unsubscribe
  }, []) // Empty deps - callback uses refs

  return { messages: data }
}
```

### Key Points

1. **Use refs for values accessed in SSE callback** - Avoids stale closures
2. **Empty dependency array** - SSE subscription should only happen once
3. **Filter by event type first** - Most events won't match
4. **Extract from correct property** - `properties.info` vs `properties.part`
5. **Filter by session** - Don't update state for other sessions
6. **Binary search for updates** - O(log n) performance on sorted arrays

---

## Debugging SSE Issues

### Step 1: Verify Server is Emitting Events

```bash
# Sample raw SSE stream from server
timeout 5 curl -s -N "http://127.0.0.1:PORT/global/event"
```

Look for:
- Event format: `data: {"directory":"...","payload":{"type":"...","properties":{...}}}`
- Correct event types being emitted
- Data in expected properties

### Step 2: Verify Discovery is Working

Check browser Network tab for `/api/opencode-servers` response:
```json
[
  { "port": 62921, "directory": "/path/to/project" }
]
```

### Step 3: Verify MultiServerSSE is Connected

In the debug panel or console:
```javascript
// Check discovered servers
multiServerSSE.getPortsForDirectory("/path/to/project")

// Check if events are being received
multiServerSSE.onEvent((e) => console.log("SSE:", e.payload.type))
```

### Step 4: Verify Hook is Subscribing

Add logging to the hook:
```typescript
useEffect(() => {
  console.log("[useMessages] Subscribing to SSE")
  const unsubscribe = multiServerSSE.onEvent((event) => {
    console.log("[useMessages] Event:", event.payload.type)
    // ... rest of handler
  })
  return () => {
    console.log("[useMessages] Unsubscribing")
    unsubscribe()
  }
}, [])
```

---

## Common Mistakes

### 1. Wrong Event Type

```typescript
// ❌ WRONG - server doesn't emit "part.updated"
if (type === "part.updated") return

// ✅ CORRECT - server emits "message.part.updated"
if (type !== "message.part.updated") return
```

### 2. Wrong Property Path

```typescript
// ❌ WRONG - message is in properties.info, not properties.message
const message = properties.message

// ✅ CORRECT
const message = properties.info as Message
```

### 3. Stale Closure

```typescript
// ❌ WRONG - sessionId will be stale
useEffect(() => {
  multiServerSSE.onEvent((event) => {
    if (event.sessionID !== sessionId) return // stale!
  })
}, []) // sessionId not in deps, but can't add it or we'd resubscribe

// ✅ CORRECT - use ref
const sessionIdRef = useRef(sessionId)
sessionIdRef.current = sessionId

useEffect(() => {
  multiServerSSE.onEvent((event) => {
    if (event.sessionID !== sessionIdRef.current) return // fresh!
  })
}, [])
```

### 4. Missing Initial Fetch

```typescript
// ❌ WRONG - only subscribes to updates, misses existing data
useEffect(() => {
  multiServerSSE.onEvent(handleEvent)
}, [])

// ✅ CORRECT - fetch first, then subscribe
useEffect(() => {
  fetchData().then(setData) // Initial load
}, [sessionId])

useEffect(() => {
  multiServerSSE.onEvent(handleEvent) // Real-time updates
}, [])
```

---

## Historical Context

### The Zustand Store Era

Previously, the app used a centralized Zustand store (`useOpencodeStore`) that:
- Had a single `handleEvent` dispatcher
- Stored all state by directory
- Used Immer for immutable updates

The store was removed in the "nuclear migration" to simplify the architecture.

### The Migration

When the store was removed:
1. Hooks were updated to fetch data directly via Promise API
2. **SSE subscriptions were NOT added** - this broke real-time updates
3. The fix was to add `multiServerSSE.onEvent()` calls to each hook

### Lesson Learned

When refactoring state management, ensure real-time update paths are preserved. The initial fetch works without SSE, so the bug only manifests when expecting live updates.

---

## Files Reference

| File | Purpose |
|------|---------|
| `packages/core/src/sse/multi-server-sse.ts` | SSE connection manager singleton |
| `packages/react/src/hooks/use-messages.ts` | Message list with SSE updates |
| `packages/react/src/hooks/use-parts.ts` | Part list with SSE updates |
| `packages/react/src/hooks/use-session.ts` | Single session with SSE updates |
| `packages/react/src/hooks/use-session-status.ts` | Running/idle status via SSE |
| `packages/react/src/hooks/use-multi-server-sse.ts` | Hook wrapper for starting SSE |
| `apps/web/src/app/api/opencode-servers/route.ts` | Server discovery API |

---

## Testing SSE Integration

```typescript
// Mock multiServerSSE for testing
vi.mock("@opencode-vibe/core/sse", () => ({
  multiServerSSE: {
    start: vi.fn(),
    onEvent: vi.fn((callback) => {
      // Store callback for test to invoke
      mockEventCallback = callback
      return () => { mockEventCallback = null }
    }),
  },
}))

// In test: emit mock event
function emitMockEvent(event: GlobalEvent) {
  if (mockEventCallback) mockEventCallback(event)
}

it("updates when message.updated event received", async () => {
  const { result } = renderHook(() => useMessages({ sessionId: "test" }))
  
  await act(async () => {
    emitMockEvent({
      directory: "/test",
      payload: {
        type: "message.updated",
        properties: {
          info: { id: "msg-1", sessionID: "test", role: "user" }
        }
      }
    })
  })
  
  expect(result.current.messages).toHaveLength(1)
})
```

---

## Summary

1. **Server emits specific event types** - `message.updated`, `message.part.updated`, etc.
2. **MultiServerSSE singleton manages connections** - Discovers servers, maintains streams
3. **Hooks subscribe via `multiServerSSE.onEvent()`** - Filter by type, extract data, update state
4. **Use refs for session filtering** - Avoids stale closures in callbacks
5. **Always verify actual event format** - Don't assume, check the wire protocol
