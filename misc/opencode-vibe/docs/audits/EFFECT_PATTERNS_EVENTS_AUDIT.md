# Effect-TS Patterns: Event/Stream Layer Audit

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│      ███████╗███████╗███████╗███████╗ ██████╗████████╗                      │
│      ██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝╚══██╔══╝                      │
│      █████╗  █████╗  █████╗  █████╗  ██║        ██║                         │
│      ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║        ██║                         │
│      ███████╗██║     ██║     ███████╗╚██████╗   ██║                         │
│      ╚══════╝╚═╝     ╚═╝     ╚══════╝ ╚═════╝   ╚═╝                         │
│                                                                             │
│             PubSub, Stream.mapEffect, and Fiber Opportunities              │
│                    Making Events Great Again (for real)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Audit Date:** 2026-01-02  
**Auditor:** SilverOcean (Swarm Worker Agent)  
**Cell:** opencode-next--xts0a-mjx3stf0f26  
**Epic:** opencode-next--xts0a-mjx3stek3wg  
**Scope:** Analyze SSE/event handling in core/world for Effect-TS pattern opportunities

---

## Executive Summary

**Current Architecture:** Custom SSE polling, Stream.async, setInterval-based discovery  
**Effect Patterns Available:** PubSub (event broadcasting), Stream.mapEffect (concurrency), Fiber (background work)  
**Migration Potential:** HIGH - 3 major opportunities identified  
**Risk Level:** MEDIUM - requires careful coordination with existing atom layer  

### Key Findings

1. **PubSub vs SSE Broadcasting** - WorldSSE currently uses store mutations directly. PubSub would enable type-safe fan-out with backpressure.
2. **Stream.mapEffect for Bootstrap** - Parallel session/status fetching is manual. Stream.mapEffect could handle concurrency cleanly.
3. **Fiber for Discovery Loop** - setInterval + manual cleanup. Fiber would provide structured cancellation and scope-based lifecycle.

**Recommendation:** Incremental migration - start with Fiber (lowest risk), then Stream.mapEffect (medium risk), then PubSub (requires architectural change).

---

## 1. Current Implementation Analysis

### 1.1 Event Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CURRENT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Discovery (lsof)                                                       │
│       ↓                                                                 │
│  WorldSSE.startDiscoveryLoop()                                          │
│       ↓ (setInterval)                                                   │
│  discoverServers() → Effect                                             │
│       ↓                                                                 │
│  connectToServer(port) → Fiber per server                               │
│       ↓                                                                 │
│  connectToSSE(port) → Stream.async                                      │
│       ↓ (fetch + eventsource-parser)                                    │
│  handleEvent() → direct store mutations                                 │
│       ↓                                                                 │
│  WorldStore.upsertSession/Message/Part()                                │
│       ↓                                                                 │
│  Subscribers (React hooks, TUI)                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 File-by-File Breakdown

#### **event-source.ts** (199 lines)
- **Purpose:** Generic EventSource interface + SwarmDb polling implementation
- **Pattern:** Stream.async with cursor-based pagination
- **Current State:** Well-structured, minimal Effect usage
- **Effect Patterns:**
  - ✅ `Stream.async` for polling source (line 124)
  - ✅ `Effect.sync` for availability check (line 113)
  - ✅ `Effect.sync` for cleanup (line 191)
  - ❌ `setInterval` instead of Fiber/Schedule (line 185)

**Code Evidence:**
```typescript
// event-source.ts:184-195
// Start polling interval
const intervalId = setInterval(poll, pollIntervalMs)

// Initial poll
void poll()

// Cleanup on stream end
return Effect.sync(() => {
  clearInterval(intervalId)
  client.close()
})
```

**Analysis:** Uses raw `setInterval` instead of Effect's `Schedule.spaced`. Cleanup is Effect-wrapped but scheduling is not.

---

#### **events.ts** (173 lines)
- **Purpose:** WorldEvent discriminated union (Schema-based)
- **Pattern:** Effect Schema for type safety
- **Current State:** Pure schema definitions, no runtime behavior
- **Effect Patterns:**
  - ✅ Schema.Union for discriminated unions
  - ✅ Schema.Literal for type discriminators
  - N/A for runtime patterns (this is schema-only)

**Code Evidence:**
```typescript
// events.ts:158-172
export const WorldEvent = S.Union(
  SessionCreated,
  SessionUpdated,
  SessionCompleted,
  WorkerSpawned,
  WorkerProgress,
  WorkerCompleted,
  WorkerFailed,
  MessageSent,
  MessageReceived,
  ReservationAcquired,
  ReservationReleased,
)
```

**Analysis:** Excellent use of Schema. No runtime behavior to migrate. This file is Effect-first already.

---

#### **sse-bridge.ts** (131 lines)
- **Purpose:** Maps SSE events to WorldStore mutations
- **Pattern:** Simple switch/case event handler
- **Current State:** Stateless bridge, no Effect usage
- **Effect Patterns:**
  - ❌ No Effect usage (plain TypeScript)
  - ❌ Direct store mutations (imperative)
  - ❌ No backpressure handling
  - ❌ No error handling

**Code Evidence:**
```typescript
// sse-bridge.ts:85-122
processEvent(event: SSEEvent): void {
  const { type, properties } = event.payload

  switch (type) {
    case "session.created":
    case "session.updated": {
      const session = properties.info as Session | undefined
      if (session) {
        store.upsertSession(session)
      }
      break
    }
    // ... more cases
  }
}
```

**Analysis:** **DEPRECATED CANDIDATE.** This bridge pattern is obsolete now that WorldSSE exists (sse.ts). WorldSSE handles events directly (line 461-506). This file likely vestigial from the MultiServerSSE era.

---

#### **sse.ts** (515 lines)
- **Purpose:** Self-contained SSE connection management (discovery + streaming)
- **Pattern:** Fiber-based connections, Stream.async for SSE
- **Current State:** Most Effect-forward file in the layer
- **Effect Patterns:**
  - ✅ `Effect.gen` for async workflows (line 58, 328, 372, 427)
  - ✅ `Effect.tryPromise` for Promise interop (line 70, 129, 141)
  - ✅ `Effect.all` for parallel bootstrap (line 431)
  - ✅ `Fiber.RuntimeFiber` for connection management (line 260, 261)
  - ✅ `Effect.runFork` for launching fibers (line 363, 407)
  - ✅ `Effect.sleep` for delays (line 359, 399)
  - ✅ `Stream.async` for SSE streaming (line 172)
  - ✅ `Stream.runForEach` for consuming streams (line 383)
  - ❌ Manual fiber tracking in Map (line 261) instead of Scope
  - ❌ setInterval for discovery (implicit in startDiscoveryLoop) instead of Schedule

**Code Evidence - Good Effect Usage:**
```typescript
// sse.ts:431-440 - Parallel bootstrap with Effect.all
const [sessionsRes, statusRes] = yield* Effect.all([
  Effect.tryPromise({
    try: () => fetch(`${baseUrl}/session`).then((r) => r.json()),
    catch: (e) => new Error(`Failed to fetch sessions: ${e}`),
  }),
  Effect.tryPromise({
    try: () => fetch(`${baseUrl}/session/status`).then((r) => r.json()),
    catch: (e) => new Error(`Failed to fetch status: ${e}`),
  }),
])
```

**Code Evidence - Improvement Opportunity:**
```typescript
// sse.ts:328-361 - Discovery loop uses Effect.gen but manual while loop
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    while (this.running) {  // ← Manual loop instead of Schedule
      const servers = yield* discoverServers().pipe(
        Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[])),
      )
      // ... connect/disconnect logic ...
      yield* Effect.sleep(this.config.discoveryIntervalMs)  // ← Manual sleep
    }
  })
  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**Analysis:** Excellent Effect integration overall. Two improvement areas:
1. Discovery loop could use `Schedule.spaced` + `Stream.repeat` instead of manual `while + sleep`
2. Connection fiber map could use `Scope` for automatic cleanup instead of manual tracking

---

#### **merged-stream.ts** (225 lines)
- **Purpose:** Combines SSE + additional event sources (SwarmDb, Git, etc.)
- **Pattern:** Stream.mergeAll, availability checks, graceful degradation
- **Current State:** Good Effect usage, extensible design
- **Effect Patterns:**
  - ✅ `Stream.mergeAll` for combining streams (line 154)
  - ✅ `Effect.all` with concurrency for parallel checks (line 140)
  - ✅ `Effect.catchAllDefect` for error handling (line 131)
  - ✅ `Stream.unwrap` for lazy stream creation (line 137)
  - ✅ `Stream.empty` for unavailable sources (line 147)
  - ❌ Duplicate WorldSSE initialization (line 84, 105) - DRY violation

**Code Evidence - Excellent Stream Composition:**
```typescript
// merged-stream.ts:137-156
return Stream.unwrap(
  Effect.gen(function* () {
    // Wait for all availability checks
    const results = yield* Effect.all(availabilityChecks, { concurrency: "unbounded" })

    // Filter to only available sources
    const availableSources = results.filter((r) => r.isAvailable).map((r) => r.source)

    // If no available sources, return empty stream
    if (availableSources.length === 0) {
      return Stream.empty
    }

    // Create streams from all available sources
    const streams = availableSources.map((source) => source.stream())

    // Merge all streams
    return Stream.mergeAll(streams, { concurrency: "unbounded" })
  }),
)
```

**Analysis:** **BEST Effect patterns in the layer.** Stream.mergeAll, graceful degradation, proper error handling. Only issue is code duplication with stream.ts.

---

#### **stream.ts** (154 lines)
- **Purpose:** Basic World Stream without additional sources
- **Pattern:** SSE-only variant of merged-stream.ts
- **Current State:** Duplicate logic, could be unified
- **Effect Patterns:**
  - ❌ No direct Effect usage (delegates to WorldSSE)
  - ❌ Duplicate discovery/initialization code (vs merged-stream.ts)

**Code Evidence - Duplication:**
```typescript
// stream.ts:47-80 (IDENTICAL to merged-stream.ts:84-116)
if (baseUrl) {
  sse = new WorldSSE(store, {
    serverUrl: baseUrl,
    autoReconnect,
    onEvent,
  })
  sse.start()
} else {
  store.setConnectionStatus("connecting")
  discoverServers()
    .then((servers) => {
      if (servers.length === 0) {
        store.setConnectionStatus("error")
        return
      }
      const firstServer = servers[0]
      const discoveredUrl = `http://127.0.0.1:${firstServer.port}`
      sse = new WorldSSE(store, {
        serverUrl: discoveredUrl,
        autoReconnect,
        onEvent,
      })
      sse.start()
    })
    .catch(() => {
      store.setConnectionStatus("error")
    })
}
```

**Analysis:** This file is redundant with merged-stream.ts. stream.ts could be `createMergedWorldStream({ ...config, sources: [] })`.

---

### 1.3 SSE Connection Management Summary

**Current Flow:**
1. `WorldSSE.start()` called
2. If no baseUrl, runs discovery (Promise-based)
3. Discovery finds servers via lsof
4. For each server, spawns connection Fiber
5. Connection Fiber bootstraps data (Effect.all), then streams SSE (Stream.async)
6. Events flow to `handleEvent()` which mutates WorldStore directly
7. WorldStore notifies subscribers

**Strengths:**
- ✅ Fiber-based connections (one per server)
- ✅ Effect.all for parallel bootstrap
- ✅ Stream.async for SSE parsing
- ✅ Graceful error handling

**Weaknesses:**
- ❌ Discovery loop uses manual `while + sleep` instead of Schedule
- ❌ Manual Fiber tracking instead of Scope
- ❌ Direct store mutations instead of PubSub
- ❌ No backpressure handling for fast SSE streams

---

## 2. PubSub Applicability

### 2.1 Current Event Broadcasting Pattern

**Problem:** WorldSSE directly mutates WorldStore (imperative fan-out)

```typescript
// sse.ts:461-506 - Direct mutation
private handleEvent(event: SSEEvent): void {
  const { type, properties } = event

  switch (type) {
    case "session.created":
    case "session.updated": {
      const session = properties as unknown as Session
      if (session?.id) {
        this.store.upsertSession(session)  // ← Direct mutation
      }
      break
    }
    // ... more direct mutations
  }
}
```

**Issue:** Tight coupling between SSE layer and store layer. Can't easily:
- Add new subscribers without modifying WorldSSE
- Implement backpressure when subscribers are slow
- Log/intercept events without store dependency
- Test SSE independently of store

---

### 2.2 PubSub Pattern (from Hivemind mem-af0a57f4d40f2f5f)

**What PubSub Provides:**
- **Publish-subscribe pattern** - each subscriber gets independent queue
- **Fan-out** - events delivered to ALL subscribers (unlike streams where one consumer wins)
- **Backpressure** - `PubSub.bounded(N)` blocks publisher when queues full
- **Type-safe** - Schema-validated events
- **Auto-cleanup** - Subscribers auto-released when scope ends

**Pattern:**
```typescript
// Create PubSub with bounded queues (backpressure)
const pubsub = yield* PubSub.bounded<SSEEvent>(32)

// Publisher (SSE connection)
yield* PubSub.publish(pubsub, event)  // Blocks if all queues full

// Subscriber 1: WorldStore
const storeQueue = yield* PubSub.subscribe(pubsub)
yield* Effect.fork(
  Stream.fromQueue(storeQueue).pipe(
    Stream.runForEach((event) => Effect.sync(() => store.handleEvent(event)))
  )
)

// Subscriber 2: Logger
const logQueue = yield* PubSub.subscribe(pubsub)
yield* Effect.fork(
  Stream.fromQueue(logQueue).pipe(
    Stream.runForEach((event) => Effect.sync(() => console.log(event)))
  )
)
```

---

### 2.3 Migration Strategy: SSE → PubSub

**Before (Current):**
```
SSE Stream → handleEvent() → store.upsertSession()
                          → store.upsertMessage()
                          → store.upsertPart()
```

**After (PubSub):**
```
SSE Stream → PubSub.publish()
               ↓
               ├→ Subscriber 1 (WorldStore) → store.handleEvent()
               ├→ Subscriber 2 (Logger) → console.log()
               └→ Subscriber 3 (Telemetry) → metrics.track()
```

**Code Example:**
```typescript
// sse.ts - Create PubSub in WorldSSE constructor
export class WorldSSE {
  private pubsub: PubSub.PubSub<SSEEvent> | null = null

  async start(): Promise<void> {
    // Create PubSub with bounded queues
    this.pubsub = await Effect.runPromise(
      PubSub.bounded<SSEEvent>(32)  // 32 events buffer per subscriber
    )

    // Fork WorldStore subscriber
    await Effect.runPromise(
      Effect.gen(this, function* () {
        const queue = yield* PubSub.subscribe(this.pubsub!)
        yield* Effect.forkScoped(
          Stream.fromQueue(queue).pipe(
            Stream.runForEach((event) => 
              Effect.sync(() => this.store.handleEvent(event))
            )
          )
        )
      }).pipe(Effect.scoped)
    )

    // Start SSE connections (now publish to PubSub)
    // ... existing connection logic
  }

  private async publishEvent(event: SSEEvent): Promise<void> {
    if (this.pubsub) {
      await Effect.runPromise(PubSub.publish(this.pubsub, event))
    }
  }

  private handleEvent(event: SSEEvent): void {
    // Replace direct mutations with PubSub publish
    void this.publishEvent(event)
  }
}
```

**WorldStore Integration:**
```typescript
// atoms.ts - Add handleEvent method
export class WorldStore {
  handleEvent(event: SSEEvent): void {
    const { type, properties } = event

    switch (type) {
      case "session.created":
      case "session.updated": {
        const session = properties as unknown as Session
        if (session?.id) {
          this.upsertSession(session)
        }
        break
      }
      // ... existing mutation logic
    }
  }
}
```

---

### 2.4 Benefits of PubSub Migration

| Benefit | Current | With PubSub |
|---------|---------|-------------|
| **Add subscribers** | Modify WorldSSE | Subscribe to PubSub |
| **Backpressure** | None (unbounded) | Bounded queues |
| **Type safety** | Manual casting | Schema validation |
| **Testing** | Requires full stack | Mock PubSub.publish |
| **Logging** | Modify handleEvent | Add subscriber |
| **Metrics** | Modify handleEvent | Add subscriber |

---

### 2.5 Risks and Tradeoffs

**Risks:**
1. **Breaking change** - WorldStore API changes (+ handleEvent method)
2. **Complexity** - Additional abstraction layer
3. **Memory** - Bounded queues use more memory than direct mutation
4. **Async overhead** - PubSub.publish is async (currently sync)

**Tradeoffs:**
- **Pro:** Clean separation, extensible, backpressure, n+1 subscribers already exist
- **Con:** More code, async complexity, memory overhead

**Verdict:** **RECOMMEND** - System now has n+1 stream capability (React UI + TUI + debug tools + future consumers). PubSub provides typed fan-out with backpressure for unknown/growing number of subscribers. Each subscriber gets independent queue (no blocking between consumers). Perfect for current architecture.

---

## 3. Stream.mapEffect Opportunities

### 3.1 Current Parallel Processing Patterns

#### **Bootstrap Fetching (sse.ts:431-440)**
**Current:** Effect.all for parallel session + status fetch

```typescript
const [sessionsRes, statusRes] = yield* Effect.all([
  Effect.tryPromise({
    try: () => fetch(`${baseUrl}/session`).then((r) => r.json()),
    catch: (e) => new Error(`Failed to fetch sessions: ${e}`),
  }),
  Effect.tryPromise({
    try: () => fetch(`${baseUrl}/session/status`).then((r) => r.json()),
    catch: (e) => new Error(`Failed to fetch status: ${e}`),
  }),
])
```

**Analysis:** This is already optimal for 2 parallel requests. Effect.all is the right tool. Stream.mapEffect would be overkill.

---

#### **Availability Checks (merged-stream.ts:127-140)**
**Current:** Effect.all for parallel source availability checks

```typescript
const availabilityChecks = sources.map((source) =>
  source.available().pipe(
    Effect.map((isAvailable) => ({ source, isAvailable })),
    Effect.catchAllDefect(() => Effect.succeed({ source, isAvailable: false })),
    Effect.catchAll(() => Effect.succeed({ source, isAvailable: false })),
  ),
)

const results = yield* Effect.all(availabilityChecks, { concurrency: "unbounded" })
```

**Analysis:** Effect.all with `concurrency: "unbounded"` is correct. Stream.mapEffect wouldn't improve this.

---

### 3.2 WHERE Stream.mapEffect WOULD Help

**Scenario:** If we wanted to fetch messages for ALL sessions concurrently (not just bootstrap)

**Current (hypothetical):**
```typescript
// Sequential message fetching
for (const session of sessions) {
  const messages = await fetch(`/session/${session.id}/messages`)
  store.setMessages(session.id, messages)
}
```

**With Stream.mapEffect:**
```typescript
// Concurrent message fetching with controlled parallelism
yield* Stream.fromIterable(sessions).pipe(
  Stream.mapEffect(
    (session) => Effect.tryPromise({
      try: () => fetch(`/session/${session.id}/messages`).then(r => r.json()),
      catch: (e) => new Error(`Failed to fetch messages for ${session.id}: ${e}`)
    }),
    { concurrency: 5 }  // Fetch 5 sessions at a time
  ),
  Stream.runForEach((messages) => 
    Effect.sync(() => store.setMessages(messages.sessionId, messages))
  )
)
```

**Benefits:**
- Controlled concurrency (5 at a time instead of all-at-once)
- Backpressure via Stream.buffer
- Streaming results (start processing before all fetches complete)

---

### 3.3 Candidate: Parallel Session Status Computation

**Context:** When bootstrapping, we fetch sessions and status separately, then merge. If we wanted to fetch status PER session concurrently:

**Current:**
```typescript
// sse.ts:431-449 - Fetch all status at once
const statusRes = yield* Effect.tryPromise({
  try: () => fetch(`${baseUrl}/session/status`).then((r) => r.json()),
  catch: (e) => new Error(`Failed to fetch status: ${e}`),
})
```

**With Stream.mapEffect:**
```typescript
// Fetch status per session concurrently (if API supported it)
const sessions = sessionsRes as Session[]

const statusMap = yield* Stream.fromIterable(sessions).pipe(
  Stream.mapEffect(
    (session) => Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${baseUrl}/session/${session.id}/status`)
        const status = await res.json()
        return { sessionId: session.id, status }
      },
      catch: (e) => new Error(`Failed to fetch status for ${session.id}: ${e}`)
    }),
    { concurrency: 10 }  // 10 concurrent status fetches
  ),
  Stream.runFold({}, (acc, { sessionId, status }) => {
    acc[sessionId] = status
    return acc
  })
)
```

**When This Makes Sense:**
- Backend API supports per-session status endpoint (currently it's bulk `/session/status`)
- Want to stream status updates as they arrive (display sessions before all status fetched)
- Need controlled concurrency (avoid thundering herd)

**Current State:** Backend has bulk `/session/status` endpoint, so Stream.mapEffect not needed.

---

### 3.4 Stream.mapEffect Verdict

**Current Usage:** None (and none needed)

**Opportunities:**
1. **Parallel message fetching** - IF we wanted to eagerly load messages for all sessions (currently lazy-loaded)
2. **Per-session status fetching** - IF backend API changed to per-session endpoints
3. **Parallel part fetching** - IF we wanted to pre-fetch parts for recent messages

**Recommendation:** **DEFER** until we have a concrete use case requiring bounded-concurrency parallel processing. Current Effect.all + concurrency:"unbounded" is sufficient.

---

## 4. Fiber Candidates

### 4.1 Current Fiber Usage

**WorldSSE already uses Fibers extensively:**

```typescript
// sse.ts:260-261 - Fiber management
private discoveryFiber: Fiber.RuntimeFiber<void, Error> | null = null
private connectionFibers = new Map<number, Fiber.RuntimeFiber<void, Error>>()

// sse.ts:363 - Fork discovery loop
this.discoveryFiber = Effect.runFork(discoveryEffect)

// sse.ts:407 - Fork connection per server
const fiber = Effect.runFork(connectionEffect)
this.connectionFibers.set(port, fiber)

// sse.ts:303 - Interrupt fibers on stop
if (this.discoveryFiber) {
  Effect.runFork(Fiber.interrupt(this.discoveryFiber))
}
for (const [port, fiber] of this.connectionFibers) {
  Effect.runFork(Fiber.interrupt(fiber))
}
```

**Analysis:** Excellent Fiber usage for concurrent connections. Each server gets a Fiber, discovery runs in a Fiber.

---

### 4.2 Improvement: Scope-Based Fiber Management

**Problem:** Manual fiber tracking in Map + manual interrupt

**Current:**
```typescript
// sse.ts:407-408
const fiber = Effect.runFork(connectionEffect)
this.connectionFibers.set(port, fiber)

// sse.ts:414-419 - Manual cleanup
private disconnectFromServer(port: number): void {
  const fiber = this.connectionFibers.get(port)
  if (fiber) {
    Effect.runFork(Fiber.interrupt(fiber))
    this.connectionFibers.delete(port)
  }
  this.connectedPorts.delete(port)
}
```

**With Scope:**
```typescript
// sse.ts - Store scope reference instead of fiber map
private connectionScope: Scope.CloseableScope | null = null

async start(): Promise<void> {
  // Create a closeable scope for all connections
  this.connectionScope = await Effect.runPromise(Scope.make())

  // Fork fibers within scope (auto-cleanup on scope close)
  await Effect.runPromise(
    Effect.gen(this, function* () {
      while (this.running) {
        const servers = yield* discoverServers()
        for (const server of servers) {
          // Fork within scope - auto-interrupted on scope close
          yield* Effect.forkIn(
            this.connectToServerEffect(server.port),
            this.connectionScope!
          )
        }
        yield* Effect.sleep(this.config.discoveryIntervalMs)
      }
    })
  )
}

stop(): void {
  // Close scope - interrupts ALL fibers automatically
  if (this.connectionScope) {
    Effect.runFork(Scope.close(this.connectionScope, Exit.unit))
    this.connectionScope = null
  }
}
```

**Benefits:**
- No manual Map tracking
- No manual interrupt calls
- Guaranteed cleanup (can't leak fibers)
- Scope composability (nested scopes for sub-resources)

**Risk:** Requires understanding Scope API (moderate learning curve)

---

### 4.3 Improvement: Schedule.spaced for Discovery

**Problem:** Manual `while + sleep` loop in discovery

**Current:**
```typescript
// sse.ts:328-361
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    while (this.running) {  // ← Manual loop
      const servers = yield* discoverServers()
      // ... logic ...
      yield* Effect.sleep(this.config.discoveryIntervalMs)  // ← Manual sleep
    }
  })
  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**With Schedule.spaced:**
```typescript
// sse.ts - Use Schedule for discovery
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    const servers = yield* discoverServers()
    // ... connect/disconnect logic ...
  }).pipe(
    Effect.catchAll(() => Effect.void),  // Ignore errors, keep running
    Effect.repeat(Schedule.spaced(this.config.discoveryIntervalMs))
  )

  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**Benefits:**
- Declarative (Schedule.spaced vs while + sleep)
- Composable (can add Schedule.recurs for max iterations)
- Built-in jitter (Schedule.jittered for anti-thundering-herd)
- Better error semantics (Schedule.whileInput for conditional retry)

**Risk:** LOW - Schedule is well-documented and widely used

---

### 4.4 Candidate: SwarmDb Polling as Daemon Fiber

**Context:** event-source.ts uses setInterval for SwarmDb polling

**Current:**
```typescript
// event-source.ts:185-195
const intervalId = setInterval(poll, pollIntervalMs)

// Cleanup
return Effect.sync(() => {
  clearInterval(intervalId)
  client.close()
})
```

**With Fiber (daemon pattern):**
```typescript
// event-source.ts - Convert to daemon fiber
export function createSwarmDbSource(dbPath: string, pollIntervalMs = 500): EventSource {
  return {
    name: "swarm-db",
    available: () => Effect.sync(() => existsSync(dbPath)),

    stream: () => {
      return Stream.unwrapScoped(
        Effect.gen(function* () {
          const client = createClient({ url: `file:${dbPath}` })
          let lastSequence = 0

          // Polling effect
          const pollEffect = Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () => client.execute({
                sql: "SELECT * FROM events WHERE sequence > ? ORDER BY sequence",
                args: [lastSequence],
              }),
              catch: (e) => new Error(`SwarmDb poll failed: ${e}`)
            })

            const events: SourceEvent[] = []
            for (const row of result.rows) {
              const dbEvent = row as unknown as SwarmDbEvent
              let parsedData: unknown
              try {
                parsedData = JSON.parse(dbEvent.data)
              } catch {
                parsedData = dbEvent.data
              }

              events.push({
                source: "swarm-db",
                type: dbEvent.type,
                data: parsedData,
                timestamp: dbEvent.timestamp,
                sequence: dbEvent.sequence,
              })

              lastSequence = dbEvent.sequence
            }

            return events
          }).pipe(
            Effect.catchAll(() => Effect.succeed([] as SourceEvent[])),
            Effect.repeat(Schedule.spaced(pollIntervalMs))
          )

          // Fork as scoped daemon (auto-cleanup)
          const fiber = yield* Effect.forkDaemon(pollEffect)

          // Convert fiber to stream
          return Stream.fromQueue(
            // ... fiber → queue conversion
          )
        }).pipe(
          Effect.ensuring(Effect.sync(() => client.close()))
        )
      )
    }
  }
}
```

**Benefits:**
- No setInterval (pure Effect)
- Scoped cleanup (client.close() guaranteed)
- Daemon fiber (background work pattern)
- Composable with other Effects

**Complexity:** HIGH - requires fiber → queue conversion (non-trivial)

**Recommendation:** Keep current setInterval pattern. It's simple and works. Daemon fiber would be over-engineering.

---

### 4.5 Fiber Verdict

**Current Usage:** ✅ Excellent - one Fiber per SSE connection

**Improvements:**
1. **Scope-based management** (MEDIUM effort, HIGH value) - Replace fiber Map with Scope
2. **Schedule.spaced** (LOW effort, MEDIUM value) - Replace while + sleep with Schedule
3. **Daemon fiber for SwarmDb** (HIGH effort, LOW value) - Keep setInterval

**Recommendation:** Implement #1 (Scope) and #2 (Schedule) in sse.ts. Skip #3 (daemon fiber).

---

## 5. Recommendations

### 5.1 Priority Ranking

| Recommendation | Complexity | Value | Risk | Priority |
|----------------|-----------|-------|------|----------|
| **1. Migrate discovery loop to Schedule.spaced** | LOW | MEDIUM | LOW | P0 |
| **2. Replace fiber Map with Scope** | MEDIUM | HIGH | MEDIUM | P1 |
| **3. Add PubSub for n+1 subscribers** | MEDIUM | HIGH | MEDIUM | P2 |
| **4. Delete sse-bridge.ts (obsolete)** | LOW | LOW | LOW | P2 |
| **5. Unify stream.ts and merged-stream.ts** | MEDIUM | MEDIUM | LOW | P2 |
| **6. Use Stream.mapEffect for parallel fetching** | MEDIUM | LOW | LOW | P3 (defer) |

---

### 5.2 Detailed Migration Plans

#### **Recommendation 1: Schedule.spaced for Discovery**

**File:** `packages/core/src/world/sse.ts`  
**Lines:** 328-361  
**Effort:** 30 minutes  
**Risk:** LOW  

**Before:**
```typescript
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    while (this.running) {
      const servers = yield* discoverServers().pipe(
        Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[])),
      )

      // Connect to new servers
      const activePorts = new Set(servers.map((s) => s.port))
      for (const server of servers) {
        if (!this.connectedPorts.has(server.port)) {
          this.connectToServer(server.port)
        }
      }

      // Disconnect from dead servers
      for (const port of this.connectedPorts) {
        if (!activePorts.has(port)) {
          this.disconnectFromServer(port)
        }
      }

      // Update connection status
      if (this.connectedPorts.size > 0) {
        this.store.setConnectionStatus("connected")
      } else if (servers.length === 0) {
        this.store.setConnectionStatus("disconnected")
      }

      yield* Effect.sleep(this.config.discoveryIntervalMs)
    }
  })

  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**After:**
```typescript
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    // Remove while loop - Schedule handles repetition
    const servers = yield* discoverServers().pipe(
      Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[])),
    )

    // Connect to new servers
    const activePorts = new Set(servers.map((s) => s.port))
    for (const server of servers) {
      if (!this.connectedPorts.has(server.port)) {
        this.connectToServer(server.port)
      }
    }

    // Disconnect from dead servers
    for (const port of this.connectedPorts) {
      if (!activePorts.has(port)) {
        this.disconnectFromServer(port)
      }
    }

    // Update connection status
    if (this.connectedPorts.size > 0) {
      this.store.setConnectionStatus("connected")
    } else if (servers.length === 0) {
      this.store.setConnectionStatus("disconnected")
    }
  }).pipe(
    // Add Schedule.spaced for repetition
    Effect.repeat(
      Schedule.spaced(this.config.discoveryIntervalMs)
    ),
    // Add Schedule.whileInput to respect this.running flag
    Effect.repeat(
      Schedule.spaced(this.config.discoveryIntervalMs).pipe(
        Schedule.whileInput(() => this.running)
      )
    )
  )

  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**Testing:**
```typescript
// Test discovery runs on schedule
const store = new WorldStore()
const sse = new WorldSSE(store, { discoveryIntervalMs: 100 })

sse.start()
await new Promise(r => setTimeout(r, 350))  // 3 discovery cycles
sse.stop()

// Verify discovery ran 3-4 times (initial + 3 intervals)
expect(mockDiscoverServers).toHaveBeenCalledTimes(3 or 4)
```

---

#### **Recommendation 2: Scope-Based Fiber Management**

**File:** `packages/core/src/world/sse.ts`  
**Lines:** 260-261, 369-409, 414-421  
**Effort:** 2 hours  
**Risk:** MEDIUM (affects connection lifecycle)

**Before:**
```typescript
export class WorldSSE {
  private connectionFibers = new Map<number, Fiber.RuntimeFiber<void, Error>>()

  private connectToServer(port: number): void {
    const fiber = Effect.runFork(connectionEffect)
    this.connectionFibers.set(port, fiber)
  }

  private disconnectFromServer(port: number): void {
    const fiber = this.connectionFibers.get(port)
    if (fiber) {
      Effect.runFork(Fiber.interrupt(fiber))
      this.connectionFibers.delete(port)
    }
    this.connectedPorts.delete(port)
  }

  stop(): void {
    for (const [port, fiber] of this.connectionFibers) {
      Effect.runFork(Fiber.interrupt(fiber))
    }
    this.connectionFibers.clear()
  }
}
```

**After:**
```typescript
export class WorldSSE {
  private connectionScope: Scope.CloseableScope | null = null

  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    // Create closeable scope for all connections
    this.connectionScope = await Effect.runPromise(Scope.make())

    // Discovery loop now forks connections within scope
    // ... (see full implementation in migration code)
  }

  private connectToServer(port: number): void {
    if (!this.connectionScope) return

    // Fork connection effect within scope
    const connectionEffect = Effect.gen(this, function* () {
      // ... existing connection logic
    })

    // Fork in scope - auto-cleanup on scope close
    Effect.runPromise(
      Effect.forkIn(connectionEffect, this.connectionScope)
    )
  }

  stop(): void {
    this.running = false

    // Close scope - interrupts ALL fibers automatically
    if (this.connectionScope) {
      Effect.runFork(
        Scope.close(this.connectionScope, Exit.unit)
      )
      this.connectionScope = null
    }

    this.connectedPorts.clear()
    this.store.setConnectionStatus("disconnected")
  }
}
```

**Benefits:**
- ✅ No manual Map tracking
- ✅ No manual Fiber.interrupt calls
- ✅ Guaranteed cleanup (can't leak fibers)
- ✅ Composable with other scoped resources

**Testing:**
```typescript
// Test scope cleanup
const store = new WorldStore()
const sse = new WorldSSE(store)

sse.start()
await new Promise(r => setTimeout(r, 100))

// Stop should interrupt all fibers
sse.stop()

// Verify no fibers leaked
expect(sse['connectionScope']).toBeNull()
```

---

#### **Recommendation 3: Delete sse-bridge.ts**

**File:** `packages/core/src/world/sse-bridge.ts`  
**Effort:** 15 minutes  
**Risk:** LOW (file is already unused)

**Rationale:** WorldSSE (sse.ts) handles events directly via `handleEvent()` method (line 461-506). The sse-bridge.ts file is vestigial from the MultiServerSSE era and no longer referenced.

**Verification:**
```bash
# Check for imports
rg "from.*sse-bridge" packages/
rg "import.*SSEBridge" packages/

# Expected: No results (file unused)
```

**Migration:**
1. Verify no imports of sse-bridge.ts
2. Delete `packages/core/src/world/sse-bridge.ts`
3. Remove export from `packages/core/src/world/index.ts` (if present)
4. Run tests to confirm no breakage

---

#### **Recommendation 4: Unify stream.ts and merged-stream.ts**

**Files:** `packages/core/src/world/stream.ts`, `packages/core/src/world/merged-stream.ts`  
**Effort:** 1 hour  
**Risk:** LOW (API-compatible change)

**Rationale:** 80+ lines of duplicate code between the two files. stream.ts is just merged-stream.ts with `sources: []`.

**Before:**
```typescript
// stream.ts - 154 lines
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
  const { baseUrl, autoReconnect = true, onEvent } = config
  const store = new WorldStore()
  
  // ... 80 lines of SSE initialization (DUPLICATE)
}

// merged-stream.ts - 225 lines
export function createMergedWorldStream(config: MergedStreamConfig = {}): MergedStreamHandle {
  const { baseUrl, autoReconnect = true, onEvent, sources = [] } = config
  const store = new WorldStore()
  
  // ... 80 lines of SSE initialization (DUPLICATE)
  // ... 40 lines of source merging (UNIQUE)
}
```

**After:**
```typescript
// stream.ts - 10 lines
import { createMergedWorldStream, type WorldStreamConfig, type WorldStreamHandle } from "./merged-stream.js"

/**
 * Create a world stream from SSE events (convenience wrapper)
 *
 * Equivalent to createMergedWorldStream({ ...config, sources: [] })
 */
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
  return createMergedWorldStream({ ...config, sources: [] })
}

export type { WorldState, WorldStreamConfig, WorldStreamHandle } from "./types.js"
export { discoverServers, type DiscoveredServer } from "../discovery/server-discovery.js"
```

**Benefits:**
- ✅ DRY (80 lines → 10 lines)
- ✅ Single source of truth
- ✅ API-compatible (no breaking changes)

---

#### **Recommendation 3: PubSub (RECOMMEND)**

**Rationale:** System now has n+1 stream capability with multiple subscribers (React UI + TUI + debug tools). PubSub provides typed fan-out with backpressure for unknown/growing number of subscribers.

**Current reality:**
- Multiple consumers already exist (UI, TUI, debug tools)
- Future consumers expected (webhooks, analytics, log aggregation)
- Need backpressure to prevent slow consumer from causing memory issues
- Need independent queues per subscriber (no blocking)

**Migration priority:** P2 (after O11y foundation, Schedule, Scope)

**Estimated effort:** 1 day (4 hours implementation + 4 hours testing)

---

#### **Recommendation 6: Stream.mapEffect (DEFER)**

**Rationale:** No current use case for bounded-concurrency parallel processing. Effect.all with `concurrency: "unbounded"` is sufficient.

**When to reconsider:**
- Eager message loading for all sessions
- Backend API changes to per-session endpoints
- Parallel part fetching becomes necessary

**Estimated effort when needed:** 2 hours

---

## 6. Risk/Effort Analysis

### 6.1 Effort Estimates

| Task | Complexity | Lines Changed | Testing | Total Time |
|------|-----------|---------------|---------|------------|
| Schedule.spaced migration | Simple | ~30 | 30min | 1h |
| Scope-based fiber mgmt | Moderate | ~80 | 1h | 2h |
| Delete sse-bridge.ts | Trivial | -131 | 15min | 30min |
| Unify stream files | Simple | -80 | 30min | 1h |
| **PubSub for n+1 subscribers** | Moderate | ~120 | 4h | 8h |
| **Total (P0-P2)** | - | **+19** | **6h 15min** | **12h 30min** |

### 6.2 Risk Assessment

**Schedule.spaced:**
- ✅ LOW risk - well-documented pattern
- ✅ Backwards compatible (same behavior)
- ⚠️ Test coverage critical (verify repetition works)

**Scope-based management:**
- ⚠️ MEDIUM risk - affects connection lifecycle
- ✅ More correct (guaranteed cleanup)
- ⚠️ Requires understanding Scope API
- ⚠️ Test fiber interruption carefully

**Delete sse-bridge.ts:**
- ✅ ZERO risk - file already unused
- ✅ Reduces maintenance burden

**Unify stream files:**
- ✅ LOW risk - pure refactor
- ✅ Reduces duplication
- ⚠️ Ensure API exports unchanged

### 6.3 Migration Order

**Phase 1: Quick Wins (1 day)**
1. Delete sse-bridge.ts (30min)
2. Unify stream files (1h)
3. Migrate to Schedule.spaced (1h)

**Phase 2: Fiber Scope (1 day)**
4. Replace fiber Map with Scope (2h)
5. Integration testing (2h)

**Phase 3: PubSub for n+1 Subscribers (1 day)**
6. PubSub.bounded(32) for backpressure (2h)
7. Fork subscribers as Fibers (UI, TUI, Logger, Metrics) (2h)
8. Integration testing (4h)

**Phase 4: Future (DEFER)**
9. Stream.mapEffect (when needed)

---

## 7. Code Examples: Before/After

### 7.1 Discovery Loop: Schedule.spaced

**Before (manual while loop):**
```typescript
// sse.ts:328-361
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    while (this.running) {  // ← Manual loop condition
      const servers = yield* discoverServers().pipe(
        Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[])),
      )

      // ... connect/disconnect logic (30 lines) ...

      yield* Effect.sleep(this.config.discoveryIntervalMs)  // ← Manual sleep
    }
  })

  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**After (Schedule.spaced):**
```typescript
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    // Single iteration - Schedule handles repetition
    const servers = yield* discoverServers().pipe(
      Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[])),
    )

    // ... connect/disconnect logic (same 30 lines) ...

  }).pipe(
    // Declarative repetition with Schedule
    Effect.repeat(
      Schedule.spaced(this.config.discoveryIntervalMs).pipe(
        Schedule.whileInput(() => this.running)  // ← Declarative condition
      )
    )
  )

  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**Benefits:**
- ✅ Declarative (Schedule vs while)
- ✅ Composable (can add jitter, max iterations, etc.)
- ✅ Same behavior, cleaner code

---

### 7.2 Fiber Management: Scope

**Before (manual Map tracking):**
```typescript
// sse.ts:260-261, 407-408, 414-421
export class WorldSSE {
  private connectionFibers = new Map<number, Fiber.RuntimeFiber<void, Error>>()

  private connectToServer(port: number): void {
    const fiber = Effect.runFork(connectionEffect)
    this.connectionFibers.set(port, fiber)  // ← Manual tracking
  }

  private disconnectFromServer(port: number): void {
    const fiber = this.connectionFibers.get(port)
    if (fiber) {
      Effect.runFork(Fiber.interrupt(fiber))  // ← Manual interrupt
      this.connectionFibers.delete(port)      // ← Manual cleanup
    }
  }

  stop(): void {
    // Manual iteration and interrupt
    for (const [port, fiber] of this.connectionFibers) {
      Effect.runFork(Fiber.interrupt(fiber))
    }
    this.connectionFibers.clear()
  }
}
```

**After (Scope-based):**
```typescript
export class WorldSSE {
  private connectionScope: Scope.CloseableScope | null = null

  async start(): Promise<void> {
    // Create scope for all connections
    this.connectionScope = await Effect.runPromise(Scope.make())

    // Fork discovery loop within scope
    await Effect.runPromise(
      Effect.forkIn(this.discoveryEffect(), this.connectionScope)
    )
  }

  private connectToServer(port: number): void {
    if (!this.connectionScope) return

    // Fork in scope - auto-cleanup on scope close
    Effect.runPromise(
      Effect.forkIn(this.connectionEffect(port), this.connectionScope)
    )
  }

  stop(): void {
    // Close scope - interrupts ALL fibers automatically
    if (this.connectionScope) {
      Effect.runFork(
        Scope.close(this.connectionScope, Exit.unit)
      )
      this.connectionScope = null
    }
  }
}
```

**Benefits:**
- ✅ No Map tracking
- ✅ No manual interrupts
- ✅ Guaranteed cleanup
- ✅ Composable (nested scopes)

---

### 7.3 Stream Unification

**Before (duplication):**
```typescript
// stream.ts:47-80 (DUPLICATE)
if (baseUrl) {
  sse = new WorldSSE(store, { serverUrl: baseUrl, autoReconnect, onEvent })
  sse.start()
} else {
  store.setConnectionStatus("connecting")
  discoverServers()
    .then((servers) => {
      if (servers.length === 0) {
        store.setConnectionStatus("error")
        return
      }
      const firstServer = servers[0]
      const discoveredUrl = `http://127.0.0.1:${firstServer.port}`
      sse = new WorldSSE(store, { serverUrl: discoveredUrl, autoReconnect, onEvent })
      sse.start()
    })
    .catch(() => store.setConnectionStatus("error"))
}

// merged-stream.ts:84-116 (DUPLICATE - same code)
```

**After (unified):**
```typescript
// stream.ts - 10 lines (delegates to merged-stream)
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
  return createMergedWorldStream({ ...config, sources: [] })
}

// merged-stream.ts - single implementation
// ... (existing code, no changes)
```

**Benefits:**
- ✅ DRY (80 duplicate lines eliminated)
- ✅ Single source of truth
- ✅ API-compatible

---

## 8. Conclusion

### 8.1 Summary of Findings

**Current State:**
- ✅ **Good Effect usage** - Fiber-based connections, Effect.all for parallelism, Stream.async for SSE
- ⚠️ **Some manual patterns** - setInterval instead of Schedule, Map instead of Scope
- ⚠️ **n+1 subscribers exist** - React UI + TUI + debug tools (growing list)
- ❌ **No backpressure** - fast SSE stream can overwhelm slow subscribers
- ❌ **Code duplication** - stream.ts and merged-stream.ts have 80 duplicate lines
- ❌ **Obsolete code** - sse-bridge.ts no longer used

**Effect Patterns:**
- **PubSub:** **RECOMMEND** - n+1 subscribers are the reality, provides typed fan-out + backpressure
- **Stream.mapEffect:** DEFER - no current bounded-concurrency use case
- **Fiber + Scope:** RECOMMEND - improves current fiber management
- **Schedule:** RECOMMEND - declarative alternative to while + sleep

### 8.2 Recommended Action Plan

**Week 1: Quick Wins**
1. Delete sse-bridge.ts
2. Unify stream.ts → merged-stream.ts
3. Migrate discovery loop to Schedule.spaced

**Week 2: Fiber Scope**
4. Replace fiber Map with Scope
5. Integration testing
6. Document new patterns

**Week 3: PubSub for n+1 Subscribers**
7. Migrate to PubSub.bounded(32) for backpressure
8. Fork subscribers as Fibers (UI, TUI, Logger, Metrics)
9. Test multi-subscriber fan-out
10. Document PubSub patterns

**Future (DEFER):**
- Stream.mapEffect (when parallel bounded-concurrency needed)

### 8.3 Key Takeaways

**What's Working:**
- Fiber-based SSE connections (one per server)
- Effect.all for parallel bootstrap
- Stream.async for SSE parsing

**What Needs Improvement:**
- Discovery loop (use Schedule)
- Fiber management (use Scope)
- Code duplication (unify stream files)
- **Event broadcasting (use PubSub for n+1 subscribers)**

**What to Avoid:**
- Premature Stream.mapEffect optimization (YAGNI)
- Breaking changes without clear value

---

## Appendix A: Hivemind References

### mem-af0a57f4d40f2f5f: PubSub Pattern
```
Effect PubSub Pattern - Event Broadcasting

WHAT IT IS: Publish-subscribe for decoupled event communication.
Multiple subscribers get independent queues, events delivered to ALL.

KEY POINTS:
- bounded(N) for backpressure (blocks publisher when queues full)
- unbounded() for no limit (risk: memory growth)
- Each subscriber gets independent queue (fan-out)
- Auto-cleanup when scope ends

WHEN TO USE:
- Multiple consumers need same events (logging + store + metrics)
- Need backpressure for slow subscribers
- Decouple producer from consumers

PATTERN:
const pubsub = yield* PubSub.bounded<Event>(32)
const queue1 = yield* PubSub.subscribe(pubsub)
const queue2 = yield* PubSub.subscribe(pubsub)
yield* PubSub.publish(pubsub, event)  // Both queues get event
```

### mem-127a693a2783614f: Stream.mapEffect Pattern
```
Effect Stream.mapEffect Pattern - Concurrent Stream Processing

WHAT IT IS: Process stream elements concurrently with controlled
parallelism and buffer management.

KEY POINTS:
- { concurrency: N } limits parallel operations
- Backpressure via Stream.throttle (rate limiting), Stream.buffer (capacity)
- Results maintain stream order (or use mapEffectPar for unordered)

WHEN TO USE:
- API calls for each stream element (fetch per item)
- Controlled concurrency (avoid thundering herd)
- Streaming results (process as they arrive)

PATTERN:
Stream.fromIterable(items).pipe(
  Stream.mapEffect(
    (item) => Effect.tryPromise(() => fetch(item.url)),
    { concurrency: 5 }
  )
)
```

### mem-7736a95d132eb5b5: Fiber Pattern
```
Effect Fiber Pattern - Lightweight Threads

WHAT IT IS: Lightweight concurrent threads - millions fit in one OS thread,
interruptible unlike promises.

KEY POINTS:
- Effect.fork, Fiber.await, join, interrupt - core API
- forkScoped auto-cleanup on scope end
- forkDaemon for background services

WHEN TO USE:
- Background work (SSE polling, metrics collection)
- Concurrent operations (parallel server connections)
- Interruptible tasks (user can cancel)

PATTERN:
const fiber = yield* Effect.fork(longRunningTask)
// Later...
yield* Fiber.interrupt(fiber)  // Graceful cancellation
```

---

## Appendix B: Testing Checklist

### Schedule.spaced Migration Tests
- [ ] Discovery runs on schedule (3 intervals in 350ms with 100ms interval)
- [ ] Discovery stops when `this.running = false`
- [ ] Discovery handles errors gracefully (doesn't crash loop)
- [ ] Schedule respects `discoveryIntervalMs` config

### Scope Migration Tests
- [ ] Fibers auto-interrupted on `stop()`
- [ ] No fiber leaks (scope closes cleanly)
- [ ] Multiple `start()/stop()` cycles work correctly
- [ ] Connections auto-cleanup when server disappears

### Stream Unification Tests
- [ ] `createWorldStream()` API unchanged (backwards compatible)
- [ ] Subscribing to stream works (events flow correctly)
- [ ] Auto-discovery works (no baseUrl provided)
- [ ] Explicit baseUrl works (skips discovery)
- [ ] `dispose()` cleans up resources

---

**End of Audit**
