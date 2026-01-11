# SSR useSSESync Error Investigation

**Date:** 2025-12-31  
**Cell:** opencode-next--xts0a-mju5xjff2o1  
**Epic:** opencode-next--xts0a-mju5xjf9fb0  
**Status:** ✅ ROOT CAUSE IDENTIFIED

## Problem Statement

Messages sent from web client don't reach server. SSE receiving works fine.

**Console Error:**
```
OpenCode: No configuration found. Did you forget to add <OpencodeSSRPlugin> to your layout?
```

**Error Location:** Thrown during SSR in `useSSESync` hook

## Architecture Overview

### The SSR Plugin Pattern (uploadthing-inspired)

```
┌─────────────────────────────────────────────────────────────┐
│                    INTENDED FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SERVER RENDER                                           │
│     OpencodeSSRPlugin.useServerInsertedHTML()               │
│     → Injects <script>window.__OPENCODE = {...}</script>    │
│                                                             │
│  2. HTML SENT TO BROWSER                                    │
│     <html>                                                  │
│       <script>window.__OPENCODE = {...}</script>            │
│       <div id="root">...</div>                              │
│     </html>                                                 │
│                                                             │
│  3. CLIENT HYDRATION                                        │
│     OpencodeSSRPlugin renders (client-side)                 │
│     → Synchronously sets window.__OPENCODE                  │
│     → Before any child hooks run                            │
│                                                             │
│  4. HOOKS EXECUTE                                           │
│     useSSESync() → getOpencodeConfig()                      │
│     → window.__OPENCODE exists ✅                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Files Involved

| File | Role | Directive |
|------|------|-----------|
| `packages/react/src/next-ssr-plugin.tsx` | Injects `window.__OPENCODE` | `"use client"` |
| `packages/react/src/factory.ts` | Exports `useSSESync`, `getOpencodeConfig` | `"use client"` |
| `apps/web/src/app/session/[id]/session-layout.tsx` | Renders `<OpencodeSSRPlugin>` and `<SessionContent>` | `"use client"` |

## The Flow (Step-by-Step)

### 1. OpencodeSSRPlugin Setup

**File:** `packages/react/src/next-ssr-plugin.tsx:35-54`

```typescript
"use client"

export function OpencodeSSRPlugin({ config }: OpencodeSSRPluginProps) {
  // SSR: Inject script tag during server rendering
  useServerInsertedHTML(() => {
    return (
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__OPENCODE = ${JSON.stringify(config)};`,
        }}
      />
    )
  })

  // Client: Set config synchronously during render (not in useEffect!)
  // This ensures config is available before any hooks call getOpencodeConfig()
  if (typeof window !== "undefined") {
    window.__OPENCODE = config
  }

  return null
}
```

**Key Points:**
- `"use client"` directive (line 12)
- `useServerInsertedHTML()` injects `<script>` tag during SSR (line 37-45)
- Synchronous `window.__OPENCODE` assignment during client render (line 49-51)
- **CRITICAL:** The `window` check prevents SSR execution, but doesn't help if hooks run before this component renders

### 2. getOpencodeConfig Implementation

**File:** `packages/react/src/factory.ts:64-80`

```typescript
export function getOpencodeConfig(fallback?: OpencodeConfig): OpencodeConfig {
  // 1. Check globalThis (from SSR plugin)
  if (typeof window !== "undefined" && window.__OPENCODE) {
    return window.__OPENCODE
  }

  // 2. Fallback to provided config (for tests)
  if (fallback?.baseUrl) {
    return fallback
  }

  // 3. No config available - throw helpful error
  throw new Error(
    "OpenCode: No configuration found. " +
      "Did you forget to add <OpencodeSSRPlugin> to your layout?",
  )
}
```

**Key Points:**
- Returns `window.__OPENCODE` if available (line 66-68)
- Falls back to test config (line 71-73)
- **THROWS ERROR** if neither exists (line 76-79)

### 3. useSSESync Hook

**File:** `packages/react/src/factory.ts:810-841`

```typescript
function useSSESync(): void {
  const cfg = getOpencodeConfig(config)  // ⚠️ CALLS getOpencodeConfig AT RENDER TIME

  // Start MultiServerSSE singleton (idempotent)
  useEffect(() => {
    console.log("[useSSESync] Starting multiServerSSE")
    multiServerSSE.start()
  }, [])

  // Subscribe to events and route to store
  useEffect(() => {
    console.log("[useSSESync] Subscribing to SSE events for directory:", cfg.directory)

    const unsubscribe = multiServerSSE.onEvent((event) => {
      // Only process events for our directory
      if (event.directory !== cfg.directory) return

      console.log("[useSSESync] Received event:", event.payload.type)

      // Route to store
      useOpencodeStore.getState().handleSSEEvent({
        directory: event.directory,
        payload: event.payload,
      })
    })

    return () => {
      console.log("[useSSESync] Unsubscribing from SSE events")
      unsubscribe()
    }
  }, [cfg.directory])
}
```

**Key Points:**
- **Line 811:** `getOpencodeConfig(config)` called during render (NOT in useEffect)
- This is necessary because `cfg.directory` is used in useEffect dependencies
- If `window.__OPENCODE` doesn't exist yet, **throws error immediately**

### 4. SessionLayout Component Structure

**File:** `apps/web/src/app/session/[id]/session-layout.tsx:253-282`

```typescript
export function SessionLayout({ session, sessionId, directory, ... }: SessionLayoutProps) {
  return (
    <>
      {/* Inject OpenCode config for factory hooks - must have directory from URL */}
      {directory && (
        <OpencodeSSRPlugin
          config={{
            baseUrl: "/api/opencode",
            directory,
          }}
        />
      )}
      <SessionContent
        sessionId={sessionId}
        directory={directory}
        initialMessages={initialMessages}
        initialStoreMessages={initialStoreMessages}
        initialStoreParts={initialStoreParts}
        initialSession={session}
      />
    </>
  )
}
```

**File:** `apps/web/src/app/session/[id]/session-layout.tsx:86-112`

```typescript
function SessionContent({ sessionId, directory, ... }) {
  // Debug panel state
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  const toggleDebugPanel = () => setDebugPanelOpen((prev) => !prev)

  // Start SSE and wire events to store - CRITICAL for real-time updates
  useSSESync()  // ⚠️ CALLED HERE - DURING RENDER

  // Use individual factory hooks
  const sessionData = useSession(sessionId)
  const messages = useMessages(sessionId)
  // ...
}
```

## ROOT CAUSE

### The Problem: Execution Order

```
┌────────────────────────────────────────────────────────────┐
│               ACTUAL EXECUTION ORDER                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SERVER SIDE RENDERING (SSR)                               │
│  ─────────────────────────────                             │
│                                                            │
│  1. SessionLayout renders                                  │
│     ├─ OpencodeSSRPlugin renders                           │
│     │  ├─ useServerInsertedHTML() ✅ injects <script>      │
│     │  └─ if (typeof window !== "undefined") ❌ SKIPPED    │
│     │                                                       │
│     └─ SessionContent renders                              │
│        └─ useSSESync() called                              │
│           └─ getOpencodeConfig() called                    │
│              ├─ typeof window !== "undefined" ❌ FALSE     │
│              ├─ fallback?.baseUrl ❌ undefined             │
│              └─ 💥 THROWS ERROR                            │
│                                                            │
│  ❌ ERROR: "No configuration found"                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**The Issue:**

1. **OpencodeSSRPlugin is `"use client"`** → Still renders on server (RSC)
2. **During SSR:** `typeof window !== "undefined"` is `false` → `window.__OPENCODE` assignment is skipped
3. **SessionContent renders next** (same render pass)
4. **useSSESync calls getOpencodeConfig** during render (line 811)
5. **getOpencodeConfig checks `window`** → doesn't exist on server → **throws error**

### Why This Happens

**Next.js Client Components Still Render on Server:**

From Next.js docs:
> Client Components are rendered on the server for the initial page load, then on the client for subsequent navigation.

**`"use client"` boundary doesn't prevent SSR** - it just marks where hydration starts. The component still executes on the server to generate initial HTML.

**The `typeof window !== "undefined"` guard:**
- Prevents errors in server environment
- But doesn't make `window.__OPENCODE` available during SSR
- Child components that call `getOpencodeConfig()` during render will fail

## The Fix

### Option 1: Conditional Hook Execution (RECOMMENDED)

**Move `getOpencodeConfig` into `useEffect`:**

```typescript
function useSSESync(): void {
  const [cfg, setCfg] = useState<OpencodeConfig | null>(null)

  // Get config only on client
  useEffect(() => {
    const config = getOpencodeConfig()
    setCfg(config)
  }, [])

  // Start MultiServerSSE singleton (idempotent)
  useEffect(() => {
    if (!cfg) return
    console.log("[useSSESync] Starting multiServerSSE")
    multiServerSSE.start()
  }, [cfg])

  // Subscribe to events and route to store
  useEffect(() => {
    if (!cfg) return
    console.log("[useSSESync] Subscribing to SSE events for directory:", cfg.directory)

    const unsubscribe = multiServerSSE.onEvent((event) => {
      if (event.directory !== cfg.directory) return
      // ...
    })

    return () => unsubscribe()
  }, [cfg])
}
```

**Pros:**
- Cleanest fix
- No SSR execution of client-only code
- Hooks only run after hydration

**Cons:**
- Adds state management complexity
- Slight delay before SSE starts (one render pass)

### Option 2: Guard in getOpencodeConfig

**Add SSR check to getOpencodeConfig:**

```typescript
export function getOpencodeConfig(fallback?: OpencodeConfig): OpencodeConfig {
  // 1. SSR guard - return empty config during server render
  if (typeof window === "undefined") {
    // Return a placeholder config for SSR
    // The component will re-render on client with real config
    return fallback ?? { baseUrl: "", directory: "" }
  }

  // 2. Check globalThis (from SSR plugin)
  if (window.__OPENCODE) {
    return window.__OPENCODE
  }

  // 3. Fallback to provided config (for tests)
  if (fallback?.baseUrl) {
    return fallback
  }

  // 4. No config available - throw helpful error
  throw new Error(
    "OpenCode: No configuration found. " +
      "Did you forget to add <OpencodeSSRPlugin> to your layout?",
  )
}
```

**Pros:**
- Minimal change
- Fixes the immediate error

**Cons:**
- Returns invalid config during SSR
- Components need to handle empty config
- Could mask real configuration errors

### Option 3: Make SessionContent Client-Only

**Prevent SSR of SessionContent entirely:**

```typescript
// session-layout.tsx
"use client"

import dynamic from "next/dynamic"

const SessionContent = dynamic(
  () => import("./session-content").then(mod => ({ default: mod.SessionContent })),
  { ssr: false }
)

export function SessionLayout({ ... }) {
  return (
    <>
      {directory && (
        <OpencodeSSRPlugin config={{ baseUrl: "/api/opencode", directory }} />
      )}
      <SessionContent {...props} />
    </>
  )
}
```

**Pros:**
- Guarantees client-only execution
- No SSR/hydration mismatches
- Clean separation

**Cons:**
- No SSR benefits for session page
- Blank page until JS loads
- SEO impact (minor for authenticated app)

## Recommended Solution

**Use Option 1 (Conditional Hook Execution) with Option 2 as fallback:**

1. **Primary:** Modify `useSSESync` to defer `getOpencodeConfig` to `useEffect`
2. **Fallback:** Add SSR guard to `getOpencodeConfig` to prevent errors
3. **Document:** Add JSDoc comments explaining the SSR/client boundary

This provides defense-in-depth:
- useSSESync won't call getOpencodeConfig during SSR (Option 1)
- If somehow called during SSR, getOpencodeConfig won't throw (Option 2)

## Related Issues

### useSendMessage Has Same Pattern

**File:** `packages/react/src/factory.ts:216-218`

```typescript
function useSendMessage(options: { sessionId: string }) {
  const cfg = getOpencodeConfig(config)  // ⚠️ SAME ISSUE
  console.log("[useSendMessage] config:", cfg)
  // ...
}
```

**Impact:** If `useSendMessage` is called during SSR, same error occurs.

**Fix:** Apply same conditional execution pattern.

### All Factory Hooks Call getOpencodeConfig

**Affected hooks:**
- `useSession` (line 138)
- `useMessages` (line 174)
- `useSessionList` (line 426)
- `useCommands` (line 549)
- `useFileSearch` (line 591)
- `useSSE` (line 676)
- `useSessionStatus` (line 696)
- `useCompactionState` (line 717)
- `useContextUsage` (line 739)
- `useMessagesWithParts` (line 875)

**Current Behavior:** All fail during SSR if called during render.

**Mitigation:** Most are called inside client components that are already hydrated, so they work. Only `useSSESync` is problematic because it's called at the top of the render tree.

## Testing Strategy

### Verify the Fix

1. **SSR Test:** Check that session page renders without errors
2. **Hydration Test:** Verify `window.__OPENCODE` is set after hydration
3. **SSE Test:** Confirm SSE connection starts and events flow
4. **Message Test:** Send message and verify it reaches server

### Regression Prevention

Add tests for:
- `getOpencodeConfig` during SSR (should not throw)
- `useSSESync` in SSR environment
- Factory hooks with missing config

## Lessons Learned

1. **`"use client"` !== client-only execution** - Client components still render on server
2. **Window access during render is fragile** - Use `useEffect` for client-only code
3. **Config injection patterns need SSR guards** - Always check `typeof window`
4. **Hooks that depend on browser APIs must defer** - Use `useEffect`, not render-time calls

## Next Steps

1. ✅ **Analysis complete** - Root cause identified
2. ⏳ **Implement fix** - Option 1 + Option 2 (coordinator decision)
3. ⏳ **Test fix** - Verify SSR, hydration, SSE, messaging
4. ⏳ **Review other hooks** - Apply same pattern to `useSendMessage` and others
5. ⏳ **Document pattern** - Add to AGENTS.md or architecture docs

---

**Analyst:** BrightMountain  
**Cell:** opencode-next--xts0a-mju5xjff2o1  
**Date:** 2025-12-31
