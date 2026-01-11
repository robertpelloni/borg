# World State Management

**The reactive world stream architecture for OpenCode.**

Push-based state management using effect-atom. Core derives ALL state from SSE events and emits complete consistent world snapshots to subscribers.

```
SSE events → merged-stream → effect-atom invalidation → derived worldAtom → consumers
```

## Architecture Overview

The world layer provides a unified, reactive state management system that:

1. **Ingests events** from multiple sources (SSE, SwarmDB, future sources)
2. **Maintains canonical state** in effect-atom stores (sessions, messages, parts)
3. **Derives enriched views** via effect-atom composition (worldAtom with status, formatting)
4. **Pushes updates** to all subscribers (React hooks, CLI visualizers, TUI)

**Core Principle:** Consumers never coordinate. They subscribe to a single world stream and render. No orchestration burden.

```
┌─────────────────────────────────────────────────────────────────┐
│                       EVENT SOURCES                             │
├─────────────────────────────────────────────────────────────────┤
│  SSE (/api/events)  │  SwarmDB  │  Future: WebSocket, etc.     │
└───────────┬─────────┴─────┬─────┴──────────────────────────────┘
            │               │
            └───────┬───────┘
                    ▼
        ┌───────────────────────┐
        │   merged-stream.ts    │
        │  (THE source of truth)│
        │                       │
        │  • Event routing      │
        │  • Source priority    │
        │  • PubSub fan-out     │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │      atoms.ts         │
        │  (Canonical state)    │
        │                       │
        │  sessionsAtom         │
        │  messagesAtom         │
        │  partsAtom            │
        │                       │
        │  WorldStore (spike)   │ ◄─── TRANSITIONAL
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │     derived.ts        │
        │  (Enriched views)     │
        │                       │
        │  • worldAtom          │
        │  • Status computation │
        │  • Formatting         │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │   stream.ts (API)     │
        │                       │
        │  createWorldStream()  │
        │  • subscribe()        │
        │  • async iterator     │
        │  • getSnapshot()      │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────────────────────┐
        │            CONSUMERS                  │
        ├───────────────────────────────────────┤
        │  React hooks  │  CLI  │  TUI  │ Future│
        └───────────────────────────────────────┘
```

## File Reference

| File | Pattern | Purpose | Key Exports |
|------|---------|---------|-------------|
| **atoms.ts** | Hybrid (effect-atom + class spike) | Canonical state atoms + WorldStore class (TRANSITIONAL) | `sessionsAtom`, `messagesAtom`, `partsAtom`, `WorldStore` class |
| **cursor-store.ts** | Effect Layer | StreamCursor persistence with libSQL | `CursorStore` service, `CursorStoreLive` |
| **cursor.ts** | Effect Schema | EventOffset and StreamCursor type definitions | `EventOffset`, `StreamCursor` |
| **derived.ts** | effect-atom | Derived worldAtom with status computation and enrichment | `worldAtom` (derives from sessions/messages/parts) |
| **event-source.ts** | Effect Service | EventSource interface + SwarmDB implementation | `EventSource` interface, `SwarmDbEventSource` |
| **events.ts** | Effect Schema | WorldEvent discriminated union for type-safe events | `WorldEvent` union type |
| **index.ts** | Barrel file | Public exports for world layer | Re-exports all public APIs |
| **merged-stream.ts** | Hybrid (Effect + effect-atom) | **THE source of truth** - Unified event stream orchestration | `createMergedStream`, `MergedStreamConfig` |
| **metrics.ts** | Effect Metric | Observability metrics (counters, gauges) | `eventCounter`, `subscriptionGauge`, etc. |
| **metrics-endpoint.ts** | Effect Service | Metrics HTTP endpoint for Prometheus scraping | `MetricsEndpoint` service |
| **otel.ts** | Effect Layer | OpenTelemetry tracing integration | `OtelLive` layer |
| **pubsub.ts** | Effect PubSub | PubSub.bounded for event fan-out (internal) | `createWorldPubSub` |
| **routing.ts** | Plain TS | Instance routing utilities (session → instance mapping) | `sessionToInstance` Map, routing helpers |
| **runtime.ts** | Hybrid (effect-atom + Effect) | apiRuntimeAtom with merged Effect service layers | `apiRuntimeAtom` |
| **sse-source.ts** | Effect Service | SSE EventSource adapter for Discovery + connection | `SSEEventSource` |
| **sse.ts** | Hybrid (class + Effect) | Discovery + SSE orchestration + WorldSSE class (TRANSITIONAL) | `WorldSSE` class, `SSEService` |
| **stream.ts** | Hybrid | **Public API** - createWorldStream entry point | `createWorldStream` |
| **types.ts** | Pure types | Type definitions for world state and config | `WorldState`, `WorldConfig`, etc. |

## Pattern Distribution

```
Effect Services:  8 files  ██████████████████░░░░░░░░ 44%
effect-atom:      3 files  ████████░░░░░░░░░░░░░░░░░░ 17%
Hybrid:           3 files  ████████░░░░░░░░░░░░░░░░░░ 17%
Effect Schema:    2 files  ████░░░░░░░░░░░░░░░░░░░░░░ 11%
Plain TS:         2 files  ████░░░░░░░░░░░░░░░░░░░░░░ 11%
```

## Effect-Atom Migration Plan

### Current State (SPIKE - ADR-018)

**WorldStore class** in `atoms.ts` provides subscribe/getState API using **plain TypeScript observable pattern** instead of pure effect-atom:

```typescript
export class WorldStore {
  private listeners = new Set<(state: WorldState) => void>()
  
  subscribe(callback: (state: WorldState) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
  
  private notify(): void {
    const state = this.getState()
    this.listeners.forEach(cb => cb(state))
  }
  
  // Manual state updates call notify()
}
```

**Why spike?** effect-atom has steep learning curve (AtomRegistry vs Registry, makeRuntime API unclear, peer deps). Spike validates API design with plain classes, upgrade later. **Pattern proven - tests pass, CLI renders, API clean.**

### Target State (Pure effect-atom)

Migrate to **pure effect-atom** with no manual listener management:

```typescript
// atoms.ts - AFTER migration
export const sessionsAtom = Atom.make<Map<string, Session>>(new Map())
export const messagesAtom = Atom.make<Map<string, Message[]>>(new Map())
export const partsAtom = Atom.make<Map<string, Part[]>>(new Map())

// All updates via Registry.set() - invalidation automatic
```

**WorldStoreService** extraction wraps class for Effect integration (see migration steps).

### Migration Steps

#### Phase 1: Extract WorldStoreService (FIRST)

**Pattern:** Three-layer service extraction preserving 39 characterization tests.

```typescript
// 1. Effect.Service interface (Promise-wrapped)
export interface WorldStoreServiceInterface {
  subscribe: (callback) => Effect.Effect<() => void, never, never>
  getState: () => Effect.Effect<WorldState, never, never>
  updateSession: (session) => Effect.Effect<void, never, never>
  // ... all methods return Effect
}

// 2. Effect.Tag for DI
export class WorldStoreService extends Context.Tag("WorldStoreService")<
  WorldStoreService,
  WorldStoreServiceInterface
>() {}

// 3. Layer.scoped factory
export const WorldStoreServiceLive: Layer.Layer<WorldStoreService> =
  Layer.scoped(
    WorldStoreService,
    Effect.acquireRelease(
      // Acquire: Create WorldStore instance
      Effect.sync(() => {
        const store = new WorldStore()
        return {
          subscribe: (cb) => Effect.sync(() => store.subscribe(cb)),
          getState: () => Effect.sync(() => store.getState()),
          updateSession: (s) => Effect.sync(() => store.updateSession(s)),
          // ... wrap all methods
        }
      }),
      // Release: Cleanup (none needed for WorldStore)
      () => Effect.void
    )
  )

// 4. OLD CLASS PRESERVED (backward compat)
export class WorldStore {
  // ... unchanged implementation
}
```

**Testing:** Zero test changes required. Service delegates to class, inherits all 39 test guarantees.

**Reference:** `cursor-store.ts` (Layer.scoped + libSQL lifecycle), `sse.ts` (Layer.scoped wrapping WorldSSE class).

#### Phase 2: Migrate Consumers to WorldStoreService

**Before:**
```typescript
import { WorldStore } from "@opencode-vibe/core/world"
const store = new WorldStore()
```

**After:**
```typescript
import { WorldStoreService } from "@opencode-vibe/core/world"

Effect.gen(function* () {
  const store = yield* WorldStoreService
  const state = yield* store.getState()
})
```

**Gradual migration:** Old code uses `WorldStore` class, new code uses `WorldStoreService`. Both work simultaneously.

#### Phase 3: Pure effect-atom Internal Migration

**Replace manual notify() with Registry.set() invalidation:**

```typescript
// BEFORE (manual notify)
updateSession(session: Session): void {
  const sessions = this.registry.get(sessionsMapAtom)
  sessions.set(session.id, session)
  this.registry.set(sessionsMapAtom, sessions)
  this.notify() // ← MANUAL
}

// AFTER (automatic invalidation)
updateSession(session: Session): void {
  const sessions = this.registry.get(sessionsAtom)
  sessions.set(session.id, session)
  this.registry.set(sessionsAtom, sessions) // ← Auto-invalidates worldAtom
}
```

**Tests still pass** - behavior identical, implementation cleaner.

#### Phase 4: Remove WorldStore Class

Once all consumers migrated:

1. Delete `WorldStore` class from `atoms.ts`
2. Keep `WorldStoreService` (it now wraps Registry directly)
3. Update `WorldStoreServiceLive` to use Registry instead of class instance
4. Run characterization tests - should still pass

**Final state:**
```typescript
export const WorldStoreServiceLive = Layer.scoped(
  WorldStoreService,
  Effect.sync(() => {
    const registry = Registry.make()
    return {
      subscribe: (cb) => Effect.sync(() => registry.subscribe(worldAtom, cb)),
      getState: () => Effect.sync(() => registry.get(worldAtom)),
      // ... all methods use registry directly
    }
  })
)
```

### Backwards Compatibility Strategy

**Export both during migration:**
```typescript
// packages/core/src/world/index.ts
export { WorldStore } from "./atoms.js" // ← Old API
export { WorldStoreService, WorldStoreServiceLive } from "./atoms.js" // ← New API
export type { WorldStoreServiceInterface } from "./atoms.js"
```

**Deprecation path:**
1. Add `@deprecated` JSDoc to `WorldStore` class
2. Console warn on first usage
3. After full migration, remove class in next major version

### Test Strategy

**Characterization tests already exist:**
- `atoms.test.ts` - 39 passing tests for WorldStore class
- `sse.test.ts` - 33 passing tests for WorldSSE class

**No new tests needed** - Service layer is trivial delegation wrapper:
```typescript
subscribe: (cb) => Effect.sync(() => store.subscribe(cb))
// ↑ Just wraps class method, inherits all class test guarantees
```

**Migration verification:**
1. Phase 1: Run `bun run test` after service extraction - 39 tests still pass
2. Phase 2: Consumer migration - integration tests verify Effect code paths
3. Phase 3: Internal migration - characterization tests prove behavior unchanged
4. Phase 4: Class removal - final test run confirms no regressions

**TDD principle:** RED → GREEN → REFACTOR. Tests already green, refactoring preserves greenness.

### Key Imports

```typescript
import { Effect, Metric, Context, Layer } from "effect"
import { Atom } from "@effect-atom/atom"
import * as Registry from "@effect-atom/atom/Registry"
```

### Timeline

- **Phase 1** (2 hours): Extract WorldStoreService, verify tests pass
- **Phase 2** (1 week): Gradual consumer migration to WorldStoreService
- **Phase 3** (4 hours): Internal notify() → Registry.set() migration
- **Phase 4** (2 hours): Remove WorldStore class, final verification

**Total: ~2 weeks** for complete migration with zero downtime.

## Transitional Code Audit

### TRANSITIONAL (Spike Implementation)

#### atoms.ts - WorldStore Class

**Status:** ⚠️ TRANSITIONAL SPIKE (ADR-018)

**What:** Plain TypeScript class with manual listener management instead of pure effect-atom.

**Why exists:** Rapid prototyping to validate API design. effect-atom learning curve steep (AtomRegistry vs Registry, makeRuntime API unclear, peer deps).

**When to migrate:** After API stabilizes and team comfortable with effect-atom patterns.

**Migration path:** See "Effect-Atom Migration Plan" above (4-phase service extraction → pure effect-atom).

**Evidence:** 39 characterization tests passing. API validated. Spike succeeded.

---

#### sse.ts - WorldSSE Class

**Status:** ⚠️ TRANSITIONAL (Effect service extraction pending)

**What:** Plain TypeScript class wrapping SSE connection + discovery logic.

**Why exists:** Same spike pattern as WorldStore - validate observable API before Effect migration.

**When to migrate:** Alongside WorldStore migration (Phase 1 service extraction applies same pattern).

**Migration path:** Extract `SSEService` using Layer.scoped + acquireRelease (see WorldStore pattern).

**Evidence:** 33 characterization tests passing. `SSEService` export already present in code (partial migration started).

---

### ZERO Debris Files

**Audit Result:** No dead code, no abandoned experiments, no forgotten TODOs.

**Files checked:** All 18 files in `packages/core/src/world/`

**Findings:**
- All files actively used by `merged-stream.ts` or public API
- No orphaned utilities or one-off scripts
- No commented-out code blocks
- TODOs/FIXMEs: None found
- Duplicate logic: None found (pubsub.ts is internal but alive, used by merged-stream)

**Why clean?** World layer is **THE source of truth** - every file has clear responsibility in the event flow pipeline. No speculative abstractions.

## Usage Examples

### React Hook (Consumer)

```typescript
import { useWorld } from "@opencode-vibe/react"

function SessionList() {
  const world = useWorld()
  return (
    <ul>
      {world.sessions.map(session => (
        <li key={session.id}>{session.status}</li>
      ))}
    </ul>
  )
}
```

**Consumer never coordinates** - just subscribes and renders.

### CLI Visualizer (Async Iterator)

```typescript
import { createWorldStream } from "@opencode-vibe/core/world"

const stream = createWorldStream({ baseUrl, directory })

for await (const world of stream) {
  logUpdate(renderWorld(world)) // In-place update
}
```

### One-Shot Snapshot

```typescript
const stream = createWorldStream({ baseUrl, directory })
const world = await stream.getSnapshot()
console.log(world.activeSessionCount)
```

## Deep Module Analysis

**Interface Complexity:** Simple - `createWorldStream(config)` returns `{ subscribe, getSnapshot, [Symbol.asyncIterator] }`.

**Implementation Complexity:** 18 files, multi-source orchestration, Effect services, effect-atom derivation, SSE connection management, observability.

**Ratio:** 3 methods / 18 files = **DEEP MODULE** (Ousterhout pattern).

```
┌─────────────────────────────────────┐
│   createWorldStream(config)         │  ← Simple interface (3 methods)
├─────────────────────────────────────┤
│                                     │
│  • Multi-source event ingestion     │
│  • SSE connection lifecycle         │
│  • effect-atom invalidation         │
│  • Status computation               │
│  • Metrics + tracing                │
│  • Cursor persistence               │
│  • Routing logic                    │  ← Deep implementation (18 files)
│  • PubSub fan-out                   │
│  • Error handling                   │
│  • Type-safe events                 │
│                                     │
└─────────────────────────────────────┘
```

**Information Hiding:** Consumers never see:
- SSE connection details
- effect-atom Registry
- Effect runtime
- Event routing logic
- Source priority

**Defines Errors Away:** No error handling required by consumers - stream never fails (reconnects automatically, degrades gracefully).

## Related Documentation

- **ADR-018:** Reactive World Stream - architecture decision record
- **ADR-016:** Core Layer Responsibility - smart boundary pattern
- **packages/react/src/hooks/use-world.ts** - React binding implementation
- **apps/swarm-cli/src/world-state.ts** - CLI wrapper example
- **STREAMING_IMPLEMENTATION.md** - SSE event streaming details

---

**Last Updated:** January 2026  
**Status:** ✅ PRODUCTION (spike → service extraction → pure effect-atom migration planned)  
**Maintainer:** OpenCode Core Team
