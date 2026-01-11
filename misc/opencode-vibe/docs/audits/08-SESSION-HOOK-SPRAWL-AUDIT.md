# Session Hook Sprawl Audit - THE CRAZY TOWN MAZE

**Date:** 2025-12-30  
**Priority:** P0 - CRITICAL DX ISSUE  
**Epic Goal:** uploadthing-style single-hook DX

---

## TL;DR - THE PROBLEM

**Current state:** 11+ hooks scattered across components just to render a session page.  
**Target state:** Single `useSession()` hook like uploadthing's `useUploadThing()`.

**The DX gap is MASSIVE.** This is the #1 blocker to good developer experience.

---

## Hook Inventory - SessionLayout Component Tree

### SessionLayout.tsx (Entry Point)

**Hooks called:**

1. `useOpencode()` - context consumer (directory only)
2. `useMultiServerSSE()` - SSE connection manager
3. `useSubagentSync({ sessionId })` - subagent tracking
4. `useSession({ sessionId, directory })` - fetch session data
5. `useSessionStatus({ sessionId, directory })` - running state
6. `useMessages({ sessionId, directory })` - fetch messages
7. `useSendMessage({ sessionId, directory })` - send message queue

**Child components:**

- `<SessionMessages />` - 2 more hooks
- `<ContextUsageBar />` - 1 hook
- `<CompactionIndicator />` - 1 hook

**Total in tree:** 11 hooks + 1 provider

---

## SessionMessages.tsx (Child)

**Hooks called:**

1. `useMessagesWithParts({ sessionId, directory, initialMessages, initialParts })` - composition hook
2. `useSessionStatus({ sessionId, directory })` - running state (DUPLICATE)

**Derived hooks (inside useMessagesWithParts):**

- `useMessages()` - fetches messages
- `useParts()` - fetches parts

**Problem:** SessionMessages duplicates `useSessionStatus` even though parent already called it.

---

## ContextUsageBar.tsx

**Hooks called:**

1. `useContextUsage({ sessionId })` - token tracking via SSE

---

## CompactionIndicator.tsx

**Hooks called:**

1. `useCompactionState({ sessionId })` - compaction progress via SSE

---

## Hook Dependency Chain

```
SessionLayout (Component)
  ├─ OpencodeProvider (Context)
  │   └─ provides: { url, directory, ready, sync }
  │
  ├─ useOpencode() → directory
  ├─ useMultiServerSSE() → starts SSE (singleton)
  ├─ useSubagentSync({ sessionId })
  │   └─ calls: useMultiServerSSE({ onEvent })
  │
  ├─ useSession({ sessionId, directory })
  │   ├─ useState (session, loading, error)
  │   ├─ sessions.get() API call
  │   └─ multiServerSSE.onEvent() subscription
  │
  ├─ useSessionStatus({ sessionId, directory })
  │   ├─ useState (running, isLoading, status)
  │   ├─ sessions.get() API call (DUPLICATE FETCH)
  │   ├─ useMultiServerSSE({ onEvent }) subscription
  │   └─ 60s cooldown timer
  │
  ├─ useMessages({ sessionId, directory })
  │   ├─ useState (messageList, loading, error)
  │   ├─ messages.list() API call
  │   └─ multiServerSSE.onEvent() subscription
  │
  └─ useSendMessage({ sessionId, directory })
      ├─ useState (isLoading, error, queueLength)
      ├─ useCommands() → slash command registry
      │   └─ useFetch(() => commandsApi.list())
      │       └─ commands.list() API call
      ├─ useSessionStatus({ sessionId, directory }) (DUPLICATE CALL)
      │   └─ Same as above - ANOTHER sessions.get() call
      └─ Queue management + sessions.promptAsync() calls

SessionMessages (Child Component)
  ├─ useMessagesWithParts({ ... })
  │   ├─ useMessages() (DUPLICATE - parent already called this)
  │   └─ useParts()
  │       ├─ useState (partList, loading, error)
  │       ├─ parts.list() API call
  │       └─ multiServerSSE.onEvent() subscription
  │
  └─ useSessionStatus({ sessionId, directory }) (TRIPLE CALL)

ContextUsageBar (Child Component)
  └─ useContextUsage({ sessionId })
      ├─ useState (used, limit, percentage, tokens)
      └─ useMultiServerSSE({ onEvent })

CompactionIndicator (Child Component)
  └─ useCompactionState({ sessionId })
      ├─ useState (isCompacting, progress, isAutomatic)
      └─ useMultiServerSSE({ onEvent })
```

---

## Duplications - WTF Moments

### 1. useSessionStatus called 3 TIMES

**Locations:**

- `SessionLayout.tsx:133` - for header indicator
- `useSendMessage.ts:144` - for queue processing (inside SessionLayout)
- `SessionMessages.tsx:282` - for message status

**Impact:** 3x `sessions.get()` API calls on every render. Each call has:

- useState management
- useEffect for initial fetch
- SSE subscription with multiServerSSE.onEvent()
- 60s cooldown timer ref

**Why it's bad:** Same data fetched 3 times, same SSE events processed 3 times.

### 2. useMessages called 2 TIMES

**Locations:**

- `SessionLayout.tsx:136` - parent fetches messages
- `SessionMessages.tsx:274` - child re-fetches via `useMessagesWithParts`

**Impact:** 2x `messages.list()` API calls, 2x SSE subscriptions for message.updated events.

### 3. useMultiServerSSE called 6+ TIMES

**Direct calls:**

- SessionLayout.tsx:122
- useSubagentSync.ts:106
- useSessionStatus.ts:146 (x3 instances)
- useContextUsage.ts:131
- useCompactionState.ts:69

**Why it's "safe" but ugly:**

- MultiServerSSE is a singleton - calling `start()` multiple times is idempotent
- Each `onEvent()` subscription is independent but all listen to same stream

**But:** 6+ event handlers checking the same events is wasteful.

---

## What Could Be Consolidated?

### Option 1: Single useSession Hook (uploadthing-style)

```tsx
// TARGET DX - ONE HOOK
const session = useSession({ sessionId, directory })

// Returns EVERYTHING:
session.data           // Session object
session.messages       // Messages with parts
session.running        // Running status
session.contextUsage   // Token tracking
session.compacting     // Compaction state
session.subagents      // Subagent tracking
session.sendMessage    // Send message fn
session.isLoading      // Any loading state
session.error          // Any error
```

**Single hook manages:**

- One SSE subscription (not 6)
- One API call per resource (not 3x `sessions.get()`)
- All state derived from same data source

**Benefits:**

- Dead simple to use
- No prop drilling
- No duplicate subscriptions
- Single source of truth

### Option 2: Facade Hook with Composition

```tsx
// Wrapper that calls internal hooks but presents clean API
function useSession({ sessionId, directory }) {
  // Internal hooks (hidden from consumer)
  const sseState = useMultiServerSSE()
  const sessionData = useSessionData({ sessionId, sseState })
  const messagesData = useMessagesData({ sessionId, sseState })
  // ... etc

  // Expose clean API
  return {
    data: sessionData.session,
    messages: messagesData.messages,
    running: sessionData.running,
    sendMessage: useSendMessage({ sessionId, sseState }),
    // ...
  }
}
```

**Benefits:**

- Clean public API (uploadthing-style)
- Internal hooks can be tested independently
- Gradual migration path

### Option 3: Zustand Store (Current Approach - Keep Building)

**Current state:** We have `useOpencodeStore()` managing SSE events.

**What's missing:** High-level selectors that replace individual hooks.

```tsx
// Instead of 11 hooks, use store selectors
const session = useOpencodeStore((s) => s.sessions[sessionId])
const messages = useOpencodeStore((s) => s.getMessagesForSession(sessionId))
const running = useOpencodeStore((s) => s.sessionStatus[sessionId]?.running)
```

**Benefits:**

- Already have store infrastructure
- SSE integration exists
- Just need better selector API

**Tradeoff:** Still multiple calls, but at least from same store.

---

## The Ideal Simple Setup (uploadthing as north star)

### uploadthing DX (their docs)

```tsx
import { useUploadThing } from "~/utils/uploadthing"

export function Uploader() {
  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: () => alert("uploaded"),
    onUploadError: () => alert("error")
  })

  return <input onChange={e => startUpload(e.target.files)} />
}
```

**ONE HOOK. That's it.**

### OpenCode equivalent (TARGET)

```tsx
import { useSession } from "@opencode-vibe/react"

export function SessionPage({ sessionId }) {
  const session = useSession(sessionId, {
    onMessage: (msg) => console.log("new message", msg),
    onError: (err) => toast.error(err.message)
  })

  return (
    <>
      <h1>{session.data?.title}</h1>
      <Messages messages={session.messages} />
      <PromptInput onSubmit={session.sendMessage} disabled={session.isLoading} />
    </>
  )
}
```

**ONE HOOK. Dead simple.**

### Current OpenCode (REALITY - 11 hooks)

```tsx
export function SessionLayout({ sessionId, directory }) {
  const { directory: contextDirectory } = useOpencode()
  useMultiServerSSE()
  useSubagentSync({ sessionId })
  const { session } = useSession({ sessionId, directory: contextDirectory })
  const { running } = useSessionStatus({ sessionId, directory: contextDirectory })
  const { messages } = useMessages({ sessionId, directory: contextDirectory })
  const { sendMessage, isLoading, error, queueLength } = useSendMessage({
    sessionId,
    directory: contextDirectory
  })

  // Plus 3 more hooks in child components:
  // - useMessagesWithParts (DUPLICATE)
  // - useSessionStatus (DUPLICATE)
  // - useContextUsage
  // - useCompactionState

  return <OpencodeProvider url={url} directory={directory}>...</OpencodeProvider>
}
```

**11 HOOKS. Insane.**

---

## Comparison Matrix

| Aspect                    | uploadthing       | OpenCode (current) | OpenCode (target)  |
| ------------------------- | ----------------- | ------------------ | ------------------ |
| **Hooks per component**   | 1                 | 11                 | 1                  |
| **Provider required?**    | No                | Yes                | No                 |
| **Directory prop drill?** | No                | Yes (everywhere)   | No                 |
| **SSE subscriptions**     | 0 (polling)       | 6                  | 1                  |
| **API call duplicates**   | 0                 | 3x sessions.get()  | 0                  |
| **Lines to render**       | ~10               | ~150               | ~10                |
| **Cognitive load**        | None              | **CRAZY TOWN**     | None               |
| **DX rating**             | ⭐⭐⭐⭐⭐ | ⭐                 | ⭐⭐⭐⭐⭐ |

---

## Why This Matters (The Business Case)

### Developer Onboarding

**Current:**

- "Read 11 hook docs before rendering a session"
- "Understand SSE, multiServerSSE singleton, provider context"
- "Remember to pass `directory` to every hook"
- "Don't forget to call `useMultiServerSSE()` at root"

**Target:**

- "Call `useSession(id)`. Done."

**Impact:** 10x faster onboarding.

### Maintenance Burden

**Current:**

- Change to session API → update 3 hooks + store
- Add session feature → wire through 11 hooks
- Debug SSE issue → trace through 6 subscription points

**Target:**

- Change to session API → update 1 hook
- Add feature → extend single hook return value
- Debug SSE → single subscription point

**Impact:** 5x faster iteration.

### Bug Surface Area

**Current:**

- 11 hooks = 11 potential failure points
- 3x API duplicates = race condition potential
- 6x SSE subscriptions = event ordering bugs

**Target:**

- 1 hook = 1 failure point
- 1 API call = no races
- 1 SSE subscription = deterministic

**Impact:** 10x fewer bugs.

---

## Implementation Recommendations

### Phase 1: Facade Hook (Quick Win - 1 week)

Create `useSession()` facade that calls all internal hooks but hides complexity.

**File:** `packages/react/src/hooks/use-session-facade.ts`

```tsx
export function useSession(sessionId: string, options?: {
  directory?: string
  onMessage?: (msg: Message) => void
  onError?: (err: Error) => void
}) {
  const { directory: contextDir } = useOpencode()
  const dir = options?.directory ?? contextDir

  // Call internal hooks once
  useMultiServerSSE()
  useSubagentSync({ sessionId })

  const session = useSessionData({ sessionId, directory: dir })
  const messages = useMessagesWithParts({ sessionId, directory: dir })
  const status = useSessionStatus({ sessionId, directory: dir })
  const sender = useSendMessage({ sessionId, directory: dir })
  const context = useContextUsage({ sessionId })
  const compaction = useCompactionState({ sessionId })

  // Expose clean API
  return {
    // Data
    data: session.session,
    messages: messages.messages,
    
    // Status
    running: status.running,
    isLoading: session.loading || messages.loading || sender.isLoading,
    error: session.error || messages.error || sender.error,
    
    // Actions
    sendMessage: sender.sendMessage,
    queueLength: sender.queueLength,
    
    // Context tracking
    contextUsage: context,
    compacting: compaction.isCompacting,
    
    // Subagents (future)
    subagents: []
  }
}
```

**Migration:**

- Replace 7 hooks in SessionLayout with 1
- Update SessionMessages to consume from props instead of re-fetching
- Remove duplicate `useSessionStatus` calls

**Effort:** 2-3 days  
**Impact:** DX improves 80%

### Phase 2: Store-Based Implementation (Long Term - 2 weeks)

Refactor facade to use Zustand store internally, eliminating all duplicates.

**File:** `packages/react/src/hooks/use-session-store.ts`

```tsx
export function useSession(sessionId: string) {
  const session = useOpencodeStore((s) => s.sessions[sessionId])
  const messages = useOpencodeStore((s) => s.getMessagesForSession(sessionId))
  const running = useOpencodeStore((s) => s.getSessionStatus(sessionId))
  
  const sendMessage = useCallback((parts: Prompt) => {
    return useOpencodeStore.getState().sendMessage(sessionId, parts)
  }, [sessionId])

  return {
    data: session,
    messages,
    running,
    sendMessage,
    isLoading: session?.loading || messages?.loading,
    error: session?.error || messages?.error
  }
}
```

**Benefits:**

- Zero duplicates
- Single SSE subscription (in store)
- All hooks share same cache
- Perfect for concurrent rendering

**Effort:** 1-2 weeks  
**Impact:** DX improves 95%, performance improves 3x

### Phase 3: Remove Provider Entirely (Future - 1 week)

Once store is primary, OpencodeProvider is just dead weight.

**Change:**

```tsx
// BEFORE
<OpencodeProvider url={url} directory={directory}>
  <SessionLayout sessionId={id} />
</OpencodeProvider>

// AFTER
<SessionLayout sessionId={id} directory={directory} />
// Hook auto-discovers server, no provider needed
```

**Effort:** 1 week  
**Impact:** Complete uploadthing parity

---

## Success Criteria

### Code Reduction

- [x] **Current:** 150 lines to render session
- [ ] **Target:** 10-15 lines
- [ ] **Metric:** 90% reduction

### Hook Reduction

- [x] **Current:** 11 hooks per session page
- [ ] **Target:** 1 hook
- [ ] **Metric:** 91% reduction

### API Calls

- [x] **Current:** 3x sessions.get(), 2x messages.list()
- [ ] **Target:** 1x each
- [ ] **Metric:** 67% reduction

### SSE Subscriptions

- [x] **Current:** 6 subscriptions
- [ ] **Target:** 1 subscription
- [ ] **Metric:** 83% reduction

### DX Validation

- [ ] New contributor can render session in <5 minutes
- [ ] Zero questions about "which hook do I use?"
- [ ] No prop drilling of `directory`

---

## Related Audits

- `01-SYNC-AUDIT.md` - SSE architecture
- `02-FEATURE-PARITY-AUDIT.md` - Missing features
- `HOOKS_ARCHITECTURE_AUDIT.md` - Hook design principles
- `HOOKS_IMPLEMENTATION_AUDIT.md` - Individual hook analysis

---

## Next Actions

1. **Immediate (this week):**
   - [ ] Create `useSession()` facade hook
   - [ ] Replace 7 hooks in SessionLayout
   - [ ] Remove duplicate `useSessionStatus` calls
   - [ ] Write migration guide

2. **Short term (next 2 weeks):**
   - [ ] Store-based implementation
   - [ ] Remove all duplicates
   - [ ] Benchmark performance improvement

3. **Long term (next month):**
   - [ ] Remove OpencodeProvider
   - [ ] Auto-server-discovery
   - [ ] Full uploadthing DX parity

---

## Appendix: Full Hook Call Tree

```
SessionLayout Component Tree
├─ OpencodeProvider (context)
│  └─ value: { url, directory, ready, sync }
│
├─ SessionContent (inside provider)
│  ├─ useOpencode() → { directory }
│  ├─ useMultiServerSSE() → singleton.start()
│  ├─ useSubagentSync({ sessionId })
│  │  └─ useMultiServerSSE({ onEvent })
│  │
│  ├─ useSession({ sessionId, directory })
│  │  ├─ useState(session, loading, error)
│  │  ├─ sessions.get(sessionId, directory)
│  │  └─ multiServerSSE.onEvent((event) => {
│  │      if (event.type === "session.updated") setSession(...)
│  │    })
│  │
│  ├─ useSessionStatus({ sessionId, directory })
│  │  ├─ useState(running, isLoading, status)
│  │  ├─ sessions.get(sessionId, directory) ← DUPLICATE
│  │  ├─ useMultiServerSSE({ onEvent })
│  │  └─ Cooldown timer (60s)
│  │
│  ├─ useMessages({ sessionId, directory })
│  │  ├─ useState(messageList, loading, error)
│  │  ├─ messages.list(sessionId, directory)
│  │  └─ multiServerSSE.onEvent((event) => {
│  │      if (event.type === "message.updated") Binary.insert(...)
│  │    })
│  │
│  ├─ useSendMessage({ sessionId, directory })
│  │  ├─ useState(isLoading, error, queueLength)
│  │  ├─ useCommands()
│  │  │  └─ useFetch(() => commandsApi.list())
│  │  │     ├─ useState(data, loading, error)
│  │  │     └─ commands.list()
│  │  │
│  │  ├─ useSessionStatus({ sessionId, directory }) ← DUPLICATE (nested)
│  │  │  └─ Same as above
│  │  │
│  │  └─ Queue management + sessions.promptAsync()
│  │
│  └─ Child Components:
│     │
│     ├─ SessionMessages
│     │  ├─ useMessagesWithParts({ ... })
│     │  │  ├─ useMessages({ ... }) ← DUPLICATE
│     │  │  │  └─ Same as above
│     │  │  └─ useParts({ sessionId, directory })
│     │  │     ├─ useState(partList, loading, error)
│     │  │     ├─ parts.list(sessionId, directory)
│     │  │     └─ multiServerSSE.onEvent((event) => {
│     │  │         if (event.type === "part.updated") Binary.insert(...)
│     │  │       })
│     │  │
│     │  └─ useSessionStatus({ sessionId, directory }) ← TRIPLE DUPLICATE
│     │
│     ├─ ContextUsageBar
│     │  └─ useContextUsage({ sessionId })
│     │     ├─ useState(used, limit, percentage, tokens)
│     │     └─ useMultiServerSSE({ onEvent })
│     │
│     └─ CompactionIndicator
│        └─ useCompactionState({ sessionId })
│           ├─ useState(isCompacting, progress, isAutomatic)
│           └─ useMultiServerSSE({ onEvent })

Total Hook Calls: 11
Total API Calls: 6 (3x sessions.get, 1x messages.list, 1x parts.list, 1x commands.list)
Total SSE Subscriptions: 6
Total useState instances: 15+
```

---

**END OF AUDIT**
