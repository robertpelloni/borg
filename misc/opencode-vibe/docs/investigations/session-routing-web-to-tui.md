# Session Routing Issue: Web → TUI Message Not Appearing

**Date:** 2025-12-31  
**Status:** Root cause identified, fix needed  
**Priority:** High - breaks multi-TUI workflows

## Problem Statement

User sent a message from the web client in session `ses_48abc2c5dffe8ure7kdKibQ3xM`. The web client showed the response, but the TUI (terminal) didn't see the message.

**Symptom:** Messages flow correctly TUI→web, but NOT web→TUI for this session.

## Debug Info from Web Client

```json
{
  "directory": "/Users/joel/Code/joelhooks/opencode-next",
  "sessionId": "ses_48abc2c5dffe8ure7kdKibQ3xM",
  "routing": {
    "multiServerSSE": "/api/opencode/53306",
    "sessionBased": "/api/opencode/53306"
  },
  "sseConnected": true,
  "sseConnectionCount": 5,
  "storeMessages": 2
}
```

**Key observation:** Web client is routing to port 53306.

## Root Cause Analysis

### How Session Routing SHOULD Work

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION ROUTING FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. DISCOVERY                                               │
│     GET /api/opencode/servers                               │
│     → [{port: 53306, directory: "/path"}, ...]              │
│                                                             │
│  2. SSE CONNECTION                                          │
│     MultiServerSSE connects to each discovered server       │
│     Listens for events on /api/sse/{port}                   │
│                                                             │
│  3. SESSION CACHE POPULATION (CRITICAL)                     │
│     When SSE event arrives with sessionID:                  │
│     sessionToPort.set(sessionID, port)                      │
│                                                             │
│  4. MESSAGE SEND ROUTING                                    │
│     createClient(directory, sessionId)                      │
│     → multiServerSSE.getBaseUrlForSession(sessionId, dir)   │
│     → Check sessionToPort.get(sessionId) FIRST              │
│     → Fallback to directory-based routing if not cached     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### What's Actually Happening

**The session cache is EMPTY for this session on the web client.**

**Why?**
- Web client loads session page
- No SSE events for this session have arrived yet (cold start)
- `sessionToPort` cache is empty
- Fallback to directory-based routing kicks in
- Directory-based routing picks **first server** for the directory
- That server is port 53306
- **BUT THE SESSION ACTUALLY LIVES ON A DIFFERENT SERVER**

### Evidence

1. **TUI→web works:** TUI sends message → SSE event with sessionID → web receives event → cache populated → subsequent web sends route correctly
2. **Web→TUI fails on first send:** Web loads session → no events yet → cache empty → routes to wrong server (53306) → TUI never sees message

### Code References

**Session cache population (multi-server-sse.ts:528-536):**
```typescript
// Track which port owns which session based on events we receive
const sessionID =
  (props.sessionID as string) ??
  (props.info as { sessionID?: string })?.sessionID ??
  (props.part as { sessionID?: string })?.sessionID

if (sessionID) {
  this.sessionToPort.set(sessionID, port)
}
```

**Message send routing (client.ts:104-106):**
```typescript
if (sessionId && directory) {
  discoveredUrl = multiServerSSE.getBaseUrlForSession(sessionId, directory)
}
```

**Routing priority (multi-server-sse.ts:128-138):**
```typescript
getBaseUrlForSession(sessionId: string, directory: string): string | undefined {
  // First, check if we know which server owns this session
  const sessionPort = this.sessionToPort.get(sessionId)
  if (sessionPort) {
    return `/api/opencode/${sessionPort}`
  }

  // Fallback to first port for directory
  const ports = this.directoryToPorts.get(directory)
  return ports?.[0] ? `/api/opencode/${ports[0]}` : undefined
}
```

## The Gap

**Session ownership is tracked PASSIVELY** (via SSE events received), not ACTIVELY queried.

If the web client has NOT received any SSE events for a session, it has NO WAY to know which server owns it.

## Proposed Fixes

### Option A: Session List Includes Owner Port ✅ Recommended

**Modify backend `/session/list` endpoint to return:**
```typescript
{
  id: "ses_123",
  title: "My Session",
  ownerPort: 53307,  // NEW FIELD
  // ... other fields
}
```

**Advantages:**
- Simple backend change (single endpoint)
- Web client can pre-populate cache on session list load
- No additional network requests

**Implementation:**
1. Backend: Add `ownerPort` field to session serialization
2. Discovery: When fetching sessions, populate `sessionToPort` cache
3. Works for both session list page and direct session navigation

### Option B: Discovery Endpoint Returns Session Mappings ✅ Most Robust

**Modify `/api/opencode/servers` to return:**
```typescript
[
  {
    port: 53306,
    pid: 12345,
    directory: "/path",
    sessions: ["ses_abc", "ses_def"]  // NEW FIELD
  },
  {
    port: 53307,
    pid: 12346,
    directory: "/path",
    sessions: ["ses_48abc2c5dffe8ure7kdKibQ3xM"]  // SESSION FROM ISSUE
  }
]
```

**Advantages:**
- Discovery endpoint already queries all servers
- Session→port mapping available immediately on page load
- No need to fetch individual sessions first
- Handles cold-start scenario perfectly

**Implementation:**
1. Backend: Each server exposes `/sessions/ids` endpoint (returns array of session IDs)
2. Discovery: Query each server's session list during verification
3. MultiServerSSE: Pre-populate `sessionToPort` cache on discovery
4. Web client: Session routing works immediately, even before SSE events

### Option C: Session.get Includes Owner Port

**Modify `/session/:id` endpoint to return:**
```typescript
{
  id: "ses_123",
  title: "My Session",
  ownerPort: 53307,  // NEW FIELD
  // ... other fields
}
```

**Advantages:**
- Minimal backend change (single endpoint)
- Works for direct session navigation

**Disadvantages:**
- Requires additional request before first message send
- Doesn't help session list page

## Recommendation

**Implement Option B** (Discovery endpoint returns session mappings).

**Why?**
- Solves the problem at the root (discovery phase)
- No additional requests needed
- Handles all scenarios: session list, direct navigation, cold start
- Session routing works immediately, no "first message fails" edge case

**Implementation Effort:**
- Backend: Add `/sessions/ids` endpoint (trivial - return session IDs from local state)
- Discovery: Query each server's session IDs during verification (~10 lines)
- MultiServerSSE: Pre-populate cache from discovery response (~5 lines)

## Testing Strategy

1. **Setup:** Run 2 TUI instances on different directories
2. **Test Case 1:** Load session in web client → send message → verify TUI receives it (without TUI→web send first)
3. **Test Case 2:** Create session in TUI → navigate to it in web client → send message → verify TUI receives it
4. **Test Case 3:** Multiple TUIs, same directory → verify routing to correct instance

## Related Files

- `packages/core/src/sse/multi-server-sse.ts` - Session cache logic
- `packages/core/src/client/client.ts` - createClient routing
- `packages/core/src/discovery/server-routing.ts` - Routing helpers
- `apps/web/src/app/api/opencode/servers/route.ts` - Discovery endpoint
- `packages/core/src/atoms/sessions.ts` - Session API atoms

## Next Steps

1. Decide which fix to implement (recommend Option B)
2. Create cell for implementation
3. Test with multi-TUI setup
4. Document session routing architecture in ADR
