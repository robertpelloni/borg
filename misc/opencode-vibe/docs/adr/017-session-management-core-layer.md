# ADR 017: Session Management in Core Layer

**Status:** Accepted  
**Date:** 2026-01-01  
**Deciders:** Joel Hooks  
**Affected Components:** `@opencode-vibe/core`, `@opencode-vibe/react`, Web App, TUI  
**Related ADRs:** ADR-013 (Unified Same-Origin Architecture), ADR-010 (Store Architecture), ADR-016 (Core Layer Responsibility)

---

## Executive Summary

This ADR analyzes whether session management logic should move from the React layer (`packages/react/src/store/store.ts`) to the core layer (`packages/core/`). 

**Recommendation: Extract pure state logic to core, keep reactivity in framework layers.**

Move event handlers and reducers to core as pure functions. Keep Zustand in React as a thin adapter. TUI imports core reducer directly. This gives 80% of the benefit with 20% of the complexity.

---

## Context

### Current Architecture

**React Layer** (`packages/react/src/store/store.ts`):
- Zustand store with Immer middleware
- Handles session state mutations (create, update, delete)
- Processes SSE events via `handleSSEEvent()` and `handleEvent()`
- Uses binary search for O(log n) operations on sorted arrays
- Manages directory-scoped state (sessions, messages, parts, todos, etc.)

**Core Layer** (`packages/core/`):
- `sse/multi-server-sse.ts` - SSE connection management, server discovery, reconnection logic
- `atoms/sessions.ts` - Effect programs for session API operations (list, get, create, promptAsync, command)
- `types/domain.ts` - Session, Message, Part types
- `client/` - OpenAPI SDK wrapper with directory routing

### Recent Bug Fix

The session list live updates bug revealed:

1. **Store logic is correct** - `handleEvent()` properly handles `session.created` and `session.updated`
2. **SSE layer is correct** - `MultiServerSSE` emits all events to subscribers
3. **The bug was in React layer** - `useMultiDirectorySessions` hook returned `{}` for uninitialized directories

This validates that the *logic* is correct, but it's currently trapped in React-specific code.

---

## Problem Statement

### Original Arguments Against Moving to Core

1. **React-specific patterns** - Zustand + Immer are React idioms
2. **Premature abstraction** - TUI doesn't exist yet (YAGNI)
3. **Migration risk** - Moving working code introduces regression risk
4. **Backward compatibility** - Existing React consumers depend on current API
5. **Complexity increase** - Core layer becomes heavier

### Pushback (Why These Arguments Don't Apply)

1. **Counter to "React-specific"**: The *logic* (event handlers, binary search, reducers) is pure. Only the *reactivity* (Zustand subscriptions) is React-specific. We can extract pure logic without bringing Zustand into core.

2. **Counter to "YAGNI"**: A TUI exists TODAY. We want to build several example clients using this kit. This isn't premature - it's a concrete need.

3. **Counter to "Migration risk"**: This is a holiday hobby project, not production software with SLAs. Risk tolerance is higher.

4. **Counter to "Backward compatibility"**: It's just Joel and Claude. No external consumers to break.

5. **Counter to "Complexity increase"**: Pure functions are the *opposite* of complexity. `(state, event) => state` is maximally testable and minimal-dependency.

---

## Decision

**Extract pure state logic to core. Keep reactivity in framework layers.**

### What Moves to Core

```typescript
// packages/core/src/state/handlers.ts
// Pure event handlers - no framework dependencies

export const SessionEventHandlers = {
  handleCreated: (sessions: Session[], session: Session): Session[] =>
    Binary.upsert(sessions, session, s => s.id),
  
  handleDeleted: (sessions: Session[], id: string): Session[] =>
    Binary.remove(sessions, id, s => s.id),
  
  handleStatusUpdate: (
    status: Record<string, SessionStatus>, 
    sessionId: string, 
    newStatus: SessionStatus
  ): Record<string, SessionStatus> => 
    ({ ...status, [sessionId]: newStatus }),
}

// packages/core/src/state/reducer.ts
// Generic event reducer - pure function

export interface DirectoryState {
  sessions: Session[]
  sessionStatus: Record<string, SessionStatus>
  messages: Record<string, Message[]>
  parts: Record<string, Part[]>
}

export const createEmptyState = (): DirectoryState => ({
  sessions: [],
  sessionStatus: {},
  messages: {},
  parts: {},
})

export const directoryReducer = (
  state: DirectoryState, 
  event: GlobalEvent
): DirectoryState => {
  switch (event.payload.type) {
    case "session.created":
    case "session.updated": {
      const session = event.payload.properties.info as Session
      return {
        ...state,
        sessions: SessionEventHandlers.handleCreated(state.sessions, session)
      }
    }
    case "session.deleted": {
      const id = event.payload.properties.id as string
      return {
        ...state,
        sessions: SessionEventHandlers.handleDeleted(state.sessions, id)
      }
    }
    // ... other cases
    default:
      return state
  }
}
```

### What Stays in React

```typescript
// packages/react/src/store/store.ts
// Thin adapter over core reducer

import { directoryReducer, createEmptyState } from "@opencode-vibe/core/state"

export const useOpencodeStore = create(
  immer((set) => ({
    directories: {} as Record<string, DirectoryState>,
    
    handleSSEEvent: (event: GlobalEvent) => {
      set((state) => {
        const dir = event.directory
        // Core provides the pure logic
        state.directories[dir] = directoryReducer(
          state.directories[dir] ?? createEmptyState(),
          event
        )
      })
    }
  }))
)
```

### How TUI Uses Core Directly

```typescript
// TUI - no React, no Zustand
import { directoryReducer, createEmptyState } from "@opencode-vibe/core/state"
import { MultiServerSSE } from "@opencode-vibe/core/sse"

let state = createEmptyState()
const sse = new MultiServerSSE()

sse.onEvent((event) => {
  state = directoryReducer(state, event)
  renderUI(state) // TUI's own rendering
})

sse.start()
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TUI (Ink/Blessed/etc)                    │
├─────────────────────────────────────────────────────────────┤
│  let state = createEmptyState()                             │
│  sse.onEvent(e => state = directoryReducer(state, e))       │
│  Uses core reducer directly, own rendering                  │
└────────────────┬────────────────────────────────────────────┘
                 │
┌─────────────────────────────────────────────────────────────┐
│                    React App (Web)                          │
├─────────────────────────────────────────────────────────────┤
│  Zustand store (thin adapter)                               │
│  handleSSEEvent → calls core reducer                        │
│  React hooks for subscriptions                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core Layer                               │
├─────────────────────────────────────────────────────────────┤
│  STATE (NEW):                                               │
│  ├── directoryReducer(state, event) → state                 │
│  ├── SessionEventHandlers (pure functions)                  │
│  ├── createEmptyState()                                     │
│  └── Binary utilities (upsert, remove, find)                │
│                                                             │
│  EXISTING:                                                  │
│  ├── SSE: MultiServerSSE (framework-agnostic)               │
│  ├── Atoms: SessionAtom (Effect programs)                   │
│  ├── Types: Session, Message, Part (shared)                 │
│  └── Client: OpenAPI SDK wrapper                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Why Not effect-atom?

We considered [effect-atom](https://github.com/tim-smart/effect-atom) for reactive state in core. Decision: **not yet**.

effect-atom is designed for complex derived state with Effect dependencies:

```typescript
// effect-atom excels at this
const userAtom = Atom.make(Effect.succeed(fetchUser()))
const postsAtom = Atom.make((get) => {
  const user = yield* get.result(userAtom)
  return fetchPosts(user.id)
})
```

Our use case is simpler: CRUD state with SSE events. No complex derivations, no Effect chains. Pure reducers are sufficient.

**Revisit effect-atom if we need:**
- Complex derived state across multiple atoms
- Effect-based async state initialization
- Shared reactive primitives across frameworks

---

## Benefits

| Benefit | Impact |
|---------|--------|
| **Single source of truth** | Event handling logic lives in one place |
| **Pure, testable state** | `(state, event) => state` - no mocks needed |
| **Framework agnostic core** | TUI, Web, CLI all use same reducer |
| **No new dependencies** | Just pure functions, no effect-atom |
| **Incremental migration** | Move logic piece by piece |
| **Zustand stays in React** | Reactivity where it belongs |

---

## Costs

| Cost | Impact |
|------|--------|
| **Migration effort** | ~900 lines of store.ts to refactor |
| **Two layers** | Core reducer + React adapter (but adapter is thin) |
| **Learning curve** | Team needs to understand the split |

---

## Implementation Plan

### Phase 1: Extract Pure Handlers

1. Create `packages/core/src/state/handlers.ts`
2. Move `Binary.upsert`, `Binary.remove` logic
3. Create pure `SessionEventHandlers`, `MessageEventHandlers`, etc.
4. Add tests for pure handlers

### Phase 2: Create Reducer

1. Create `packages/core/src/state/reducer.ts`
2. Implement `directoryReducer` using handlers
3. Export `createEmptyState`
4. Add tests for reducer

### Phase 3: Refactor React Store

1. Import reducer from core
2. Simplify `handleSSEEvent` to call reducer
3. Keep Zustand subscriptions and selectors
4. Verify all existing tests pass

### Phase 4: TUI Integration

1. TUI imports reducer directly
2. Manages own state container
3. Wires SSE events to reducer
4. No Zustand dependency

---

## Conclusion

The original ADR was too conservative. Given:
- TUI exists today
- No external consumers
- Hobby project risk tolerance
- Desire for shared logic

**Extract pure state logic to core.** Keep reactivity in framework layers. This gives us shared logic without framework coupling.

The key insight: **separate the pure logic (reducers, handlers) from the reactive shell (Zustand, subscriptions)**. Core owns the logic. Frameworks own the reactivity.

---

## References

- **ADR-013:** Unified Same-Origin Architecture
- **ADR-010:** Store Architecture - Zustand + Immer patterns
- **ADR-016:** Core Layer Responsibility
- **effect-atom:** https://github.com/tim-smart/effect-atom (considered, deferred)
- **packages/core/src/utils/binary.ts** - Binary search utilities
- **packages/react/src/store/store.ts** - Current Zustand implementation
