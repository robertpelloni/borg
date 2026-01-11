# Send Message Flow - Unified Fix Proposal

**Status:** Ready for Implementation  
**Created:** 2025-12-31  
**Epic:** opencode-next--xts0a-mju5xjf9fb0  
**Agent:** RedStorm  

---

## Executive Summary

The send message flow fails due to **3 interconnected root causes** that create a perfect storm:

1. **SSR/Client Hydration Issue** - `useSSESync` accesses `window.__OPENCODE` during render
2. **createClient Routing Race** - SDK client created before discovery completes, stores stale URL
3. **API Proxy Route Mismatch** - Client sends portless URLs that break route pattern matching

**Critical Path:** Fix #2 (routing race) is CRITICAL. Fixes #1 and #3 are defensive improvements.

**Success Criteria:** User can send message from UI → message appears in backend logs → response streams back to UI

---

## Root Cause Analysis

### Issue #1: SSR/Client Hydration Error

**Location:** `packages/react/src/hooks/internal/use-sse-sync.ts`

**Root Cause:**
```typescript
// ❌ BAD: Called during component render
export function useSSESync(sessionId: string) {
  const config = getOpencodeConfig(); // Accesses window.__OPENCODE
  // ...
}
```

**Why it fails:**
- Next.js "use client" components **still execute on server** during initial page load
- `window.__OPENCODE` doesn't exist on server → crash
- Error occurs during SSR, but page recovers via client hydration

**Impact:**
- Non-blocking (hydration recovers)
- Console noise
- Delayed initialization

**Severity:** **LOW** (annoying, not blocking)

---

### Issue #2: createClient Routing Race Condition ⚠️ CRITICAL

**Location:** `packages/react/src/providers/opencode-provider.tsx`

**Root Cause:**
```typescript
// ❌ BAD: Client created before discovery completes
const client = useMemo(() => createClient(directory), [directory]);

// Discovery happens AFTER client creation
useEffect(() => {
  multiServerSSE.discover(directory);
}, [directory]);
```

**Timeline:**
1. Component mounts → `useMemo` runs → `createClient(directory)` called
2. Discovery map is empty → `getServerUrl(directory)` returns fallback
3. SDK client stores `baseUrl: "http://localhost:4056"` (NO PORT IN PATH)
4. Later: `multiServerSSE.discover()` completes → discovery map populated
5. **BUT:** SDK client already created with stale URL, never updates

**Why SSE works but SDK requests fail:**
- SSE bypasses SDK client, fetches directly from `/api/sse/${port}` (uses discovery)
- SDK requests use cached `baseUrl` from step 3 (doesn't use discovery)

**Proof:**
```typescript
// packages/core/src/client/create-client.ts
export function createClient(directory: string) {
  const baseUrl = getServerUrl(directory); // Called ONCE at creation
  const client = createSdkClient({ baseURL: baseUrl }); // Frozen
  return client;
}
```

**Impact:**
- **BLOCKS ALL SDK REQUESTS** (session.send, prompt.create, etc.)
- SSE connection works (false sense of health)
- User can receive messages but not send them

**Severity:** **CRITICAL** (breaks core functionality)

---

### Issue #3: API Proxy Route Pattern Mismatch

**Location:** `apps/web/src/app/api/opencode/[port]/[[...path]]/route.ts`

**Root Cause:**
- Route expects: `/api/opencode/{port}/{path}`
- Client sends: `/api/opencode/{path}` (missing port)
- Next.js interprets first path segment as `port` → 400 Invalid port

**Example:**
```
Request: POST /api/opencode/session/send
Route parses: port="session", path=["send"]
Validation: isNaN("session") → 400 error
```

**Why client sends portless URLs:**
- `createClient` called before discovery → uses fallback URL
- Fallback: `http://localhost:4056` (no port in path)
- SDK constructs: `/api/opencode/session/send` ❌

**Expected:**
- Discovery returns: `/api/opencode/4056`
- SDK constructs: `/api/opencode/4056/session/send` ✅

**Impact:**
- All SDK requests fail with 400
- Error message misleading ("Invalid port: session")

**Severity:** **HIGH** (symptom of Issue #2)

---

## Unified Fix Strategy

### Fix Order (Dependencies)

```
┌─────────────────────────────────────────────────────┐
│  FIX #2 (CRITICAL)                                  │
│  ↓ Ensures SDK client always has correct URL       │
│  FIX #3 (DEFENSIVE)                                 │
│  ↓ Optional: Better error messages                 │
│  FIX #1 (CLEANUP)                                   │
│  ↓ Optional: Eliminate SSR noise                   │
└─────────────────────────────────────────────────────┘
```

**Why this order:**
- Fix #2 solves the **root timing issue** - clients created too early
- Fix #3 becomes unnecessary if #2 works (URLs always have ports)
- Fix #1 is independent cleanup (can be done anytime)

---

## Fix #2: Eliminate createClient Routing Race ⚠️ CRITICAL

### Strategy

**Replace eager client creation with lazy client factory:**

```typescript
// ❌ BEFORE: Client created once, never updated
const client = useMemo(() => createClient(directory), [directory]);

// ✅ AFTER: Factory creates fresh client on-demand
const getClient = useCallback(() => createClient(directory), [directory]);
```

### Implementation Steps

#### Step 1: Update OpenCodeProvider

**File:** `packages/react/src/providers/opencode-provider.tsx`

```typescript
// BEFORE
const client = useMemo(() => createClient(directory), [directory]);

return (
  <OpencodeContext.Provider value={{ client, directory }}>
    {children}
  </OpencodeContext.Provider>
);

// AFTER
const getClient = useCallback(() => createClient(directory), [directory]);

return (
  <OpencodeContext.Provider value={{ getClient, directory }}>
    {children}
  </OpencodeContext.Provider>
);
```

**Impact:** Provider now exports factory, not frozen client instance

---

#### Step 2: Update OpencodeContext Interface

**File:** `packages/react/src/providers/opencode-provider.tsx`

```typescript
// BEFORE
interface OpencodeContextValue {
  client: OpencodeClient;
  directory: string;
}

// AFTER
interface OpencodeContextValue {
  getClient: () => OpencodeClient;
  directory: string;
}
```

---

#### Step 3: Update All Consumer Hooks

**Files to update:**
- `packages/react/src/hooks/use-send-message.ts`
- `packages/react/src/hooks/use-prompt-create.ts`
- `packages/react/src/hooks/use-session-*.ts` (any SDK consumers)

**Pattern:**

```typescript
// BEFORE
const { client } = useOpencodeContext();
const result = await client.session.send(...);

// AFTER
const { getClient } = useOpencodeContext();
const result = await getClient().session.send(...);
```

---

#### Step 4: Update Tests

**Files:**
- `packages/react/src/providers/opencode-provider.test.tsx`
- Any tests mocking `OpencodeContext`

**Pattern:**

```typescript
// BEFORE
<OpencodeContext.Provider value={{ client: mockClient, directory: "/test" }}>

// AFTER
<OpencodeContext.Provider value={{ getClient: () => mockClient, directory: "/test" }}>
```

---

### Why This Works

**Before (Race Condition):**
```
Time 0ms:  Component mounts
Time 1ms:  useMemo runs → createClient() → getServerUrl() → discovery map EMPTY → fallback URL
Time 2ms:  useEffect runs → multiServerSSE.discover() starts
Time 500ms: Discovery completes → map populated
Time 1000ms: User clicks send → SDK uses STALE URL from 1ms ❌
```

**After (Lazy Factory):**
```
Time 0ms:  Component mounts
Time 1ms:  useCallback creates factory (doesn't call createClient yet)
Time 2ms:  useEffect runs → multiServerSSE.discover() starts
Time 500ms: Discovery completes → map populated
Time 1000ms: User clicks send → getClient() runs NOW → getServerUrl() → FRESH URL ✅
```

**Key insight:** Defer client creation until request time, when discovery is complete.

---

### Success Criteria

1. **Type check passes** - `bun run typecheck`
2. **Tests pass** - `bun run test`
3. **Manual verification:**
   ```bash
   # Start dev server
   bun dev
   
   # Open browser → http://localhost:3000
   # Send message in UI
   # Check Network tab:
   #   - Request URL should be: /api/opencode/{PORT}/session/send
   #   - Response should be 200 OK
   
   # Check terminal logs:
   #   - Backend should log: "Received message: <text>"
   #   - No 400 errors
   ```

---

## Fix #3: Defensive Route Pattern Improvement (OPTIONAL)

### Strategy

Add better error handling to API proxy route to detect portless URLs.

**File:** `apps/web/src/app/api/opencode/[port]/[[...path]]/route.ts`

```typescript
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ port: string; path?: string[] }> }
) {
  const { port: portStr, path = [] } = await context.params;
  
  // DEFENSIVE: Detect common mistake (portless URL)
  if (!portStr || isNaN(Number(portStr))) {
    const fullPath = [portStr, ...path].join('/');
    console.error(`[API Proxy] Invalid URL - missing port. Got: /api/opencode/${fullPath}`);
    console.error(`[API Proxy] Expected: /api/opencode/{PORT}/${fullPath}`);
    console.error(`[API Proxy] Hint: Check that createClient() runs AFTER discovery completes`);
    
    return NextResponse.json(
      { 
        error: "Invalid URL format",
        expected: "/api/opencode/{PORT}/path",
        received: `/api/opencode/${fullPath}`,
        hint: "SDK client may be using stale baseUrl from before discovery completed"
      },
      { status: 400 }
    );
  }
  
  // ... rest of handler
}
```

### Why This Helps

- **Better error messages** - Developer sees root cause immediately
- **Faster debugging** - No need to guess what "Invalid port: session" means
- **Defense in depth** - Catches regression if lazy factory gets broken

### Success Criteria

1. If portless URL sent → error message includes "missing port" and "check discovery"
2. Error response JSON has `hint` field pointing to root cause

---

## Fix #1: Eliminate SSR Hydration Error (CLEANUP)

### Strategy

Move `getOpencodeConfig()` call from render into `useEffect`.

**File:** `packages/react/src/hooks/internal/use-sse-sync.ts`

```typescript
// BEFORE
export function useSSESync(sessionId: string) {
  const config = getOpencodeConfig(); // ❌ Runs on server
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  
  useEffect(() => {
    const url = `${config.baseUrl}/api/sse/${sessionId}`;
    // ...
  }, [sessionId, config]);
}

// AFTER
export function useSSESync(sessionId: string) {
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  
  useEffect(() => {
    const config = getOpencodeConfig(); // ✅ Only runs on client
    const url = `${config.baseUrl}/api/sse/${sessionId}`;
    // ...
  }, [sessionId]);
}
```

### Why This Works

- `useEffect` **never runs on server** (only during hydration/client updates)
- `window.__OPENCODE` is guaranteed to exist by the time effect runs
- No more SSR crash

### Success Criteria

1. **No console errors on page load** - Check browser console for "window is not defined"
2. **SSE connection still works** - Messages stream from backend to UI
3. **Tests pass** - `bun run test`

---

## Verification Plan

### Phase 1: Unit Tests

```bash
# Run full test suite
bun run typecheck
bun run test

# Expected: All green
```

### Phase 2: Integration Test (Manual)

```bash
# Terminal 1: Start backend (if not auto-started)
# (backend should be running on port 4056)

# Terminal 2: Start Next.js dev server
cd apps/web
bun dev

# Browser:
1. Navigate to http://localhost:3000
2. Open DevTools → Network tab
3. Send a message in the UI
4. Verify:
   ✅ Request URL: POST /api/opencode/4056/session/send
   ✅ Status: 200 OK
   ✅ Response: SSE stream starts
   ✅ Message appears in UI
   
# Terminal (backend logs):
5. Verify: "Received message: <your text>"
```

### Phase 3: Regression Check

**Ensure SSE still works:**

```bash
# Browser DevTools → Network → Filter: EventSource
1. Look for: /api/sse/4056
2. Status should be: 200 OK (pending)
3. Messages tab should show: heartbeat events every 30s
```

**Ensure discovery still works:**

```bash
# Browser Console:
> window.__OPENCODE
// Should show: { baseUrl: "/api/opencode/4056", ... }
```

---

## Implementation Checklist

- [ ] **Fix #2 - Step 1:** Update `OpenCodeProvider` (useMemo → useCallback)
- [ ] **Fix #2 - Step 2:** Update `OpencodeContextValue` interface
- [ ] **Fix #2 - Step 3:** Update consumer hooks (`use-send-message.ts`, etc.)
- [ ] **Fix #2 - Step 4:** Update tests
- [ ] **Run:** `bun run typecheck` → All green
- [ ] **Run:** `bun run test` → All green
- [ ] **Manual Test:** Send message in UI → 200 OK
- [ ] **Optional - Fix #3:** Add defensive error handling to API route
- [ ] **Optional - Fix #1:** Move `getOpencodeConfig()` into `useEffect`
- [ ] **Commit:** with message: `fix(react): eliminate createClient routing race condition`

---

## Risk Assessment

### Low Risk
- **Fix #2** - Well-understood change, covered by tests
- **Fix #1** - Isolated to one hook, no downstream effects

### Medium Risk
- **Fix #3** - Changes public API error responses (but only 400 cases)

### Rollback Plan
- Git revert commit
- All changes are in `packages/react` (isolated)
- No database migrations or data changes

---

## Related Issues

- **Epic:** opencode-next--xts0a-mju5xjf9fb0 - Send message flow investigation
- **Subtask 1:** opencode-next--xts0a-mju5xjfpcdo - SSR error analysis
- **Subtask 2:** opencode-next--xts0a-mju5xjfpcds - createClient routing analysis  
- **Subtask 3:** opencode-next--xts0a-mju5xjfpcdw - API proxy route analysis

---

## References

- **Investigation:** `docs/investigations/createclient-routing-race-condition.md`
- **Investigation:** `docs/investigations/ssr-usessesync-error-2025-12-31.md`
- **ADR:** `docs/adr/011-sse-proxy-architecture.md` - Original SSE design
- **Hivemind Learnings:**
  - `mem-95ad42aecb05bf85` - createClient routing race
  - `mem-95a7c4e9b2f82231` - Next.js SSR "use client" gotcha
  - `mem-658174b25e4fe5a4` - API proxy route catch-all gotcha

---

## Success Definition

**The fix is complete when:**

1. ✅ User can send message from UI
2. ✅ Request reaches backend with correct port in URL
3. ✅ Response streams back to UI
4. ✅ No console errors during page load
5. ✅ All tests pass
6. ✅ Type check passes

**Ship it.** 🚀
