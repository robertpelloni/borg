# Effect Patterns Runtime/Lifecycle Audit

**Scope:** `packages/core/src/world/runtime.ts`, `types.ts`, `index.ts` + SSE/lifecycle files  
**Date:** 2026-01-02  
**Agent:** CalmHawk  
**Cell:** opencode-next--xts0a-mjx3stf3te5

---

## Executive Summary

The `core/world` module demonstrates **partial Effect adoption** with significant opportunities for improvement. While `CursorStore` uses proper Effect patterns (Service, Layer, acquireRelease), the core SSE connection lifecycle is implemented **imperatively** with manual resource management.

**Key Findings:**
- ✅ **GOOD**: Atom.runtime pattern for Service DI (runtime.ts)
- ✅ **GOOD**: acquireRelease for DB connections (cursor-store.ts)
- ❌ **MISSING**: Service pattern for SSE connections
- ❌ **MISSING**: Scope-based cleanup for WorldSSE lifecycle
- ❌ **MISSING**: Schedule-based retry (manual exponential backoff instead)
- ❌ **MISSING**: Effect.gen workflows (Promise-based instead)

**Impact:** Migration to full Effect patterns would improve:
1. **Resource safety** - guaranteed cleanup on interruption
2. **Retry reliability** - composable Schedule vs manual backoff
3. **Testability** - dependency injection via Services
4. **Composability** - Effect.gen workflows vs Promise chains

---

## 1. Current Implementation Analysis

### 1.1 Service Initialization (runtime.ts)

**Pattern Used:** Atom.runtime with Layer.mergeAll

```typescript
// Current: runtime.ts:33
const ApiLayer = Layer.mergeAll(MessageService.Default, StatusService.Default)
export const apiRuntimeAtom = Atom.runtime(ApiLayer as any)
```

**Analysis:**
- ✅ **Correct**: Uses Effect Service pattern (MessageService, StatusService)
- ✅ **Correct**: Layer composition via Layer.mergeAll
- ✅ **Correct**: Services are sync factories (pure computation, no lifecycle)
- ⚠️ **Type Cast**: `as any` suggests Atom.runtime type signature doesn't match Layer
- ✅ **Extensible**: Comment guides adding new services ("Add new API services here")

**DI Approach:**
- Services defined with `sync: () => ({...})` factory (mem-5bef20787787b69d pattern)
- Consumed in atoms via `yield* ServiceName` in Effect.gen blocks
- No manual Layer.provide calls - Atom.runtime handles provision

**Resource Cleanup:**
- N/A for sync services (stateless, no lifecycle)
- MessageService and StatusService are pure functions

### 1.2 SSE Connection Lifecycle (sse.ts)

**Pattern Used:** Imperative class with manual lifecycle management

```typescript
// Current: sse.ts:256-315
export class WorldSSE {
  private running = false
  private discoveryFiber: Fiber.RuntimeFiber<void, Error> | null = null
  private connectionFibers = new Map<number, Fiber.RuntimeFiber<void, Error>>()
  private connectedPorts = new Set<number>()

  start(): void {
    if (this.running) return
    this.running = true
    // ... manual fiber management
  }

  stop(): void {
    this.running = false
    // Manually interrupt fibers
    for (const [port, fiber] of this.connectionFibers) {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }
}
```

**Analysis:**
- ❌ **Manual Resource Tracking**: Tracks fibers, ports, running state imperatively
- ❌ **No acquireRelease**: Cleanup depends on caller remembering to call `stop()`
- ❌ **Interruption Risk**: If process crashes, fibers leak (no automatic cleanup)
- ✅ **Uses Effect Primitives**: Fiber, Stream, Effect.gen internally
- ❌ **Not Composable**: Can't be used in Effect pipelines without wrapping

**Cleanup Guarantees:**
- **Current**: Depends on explicit `stop()` call
- **Desired**: Automatic cleanup via Scope/acquireRelease (guaranteed on interruption)

### 1.3 Discovery (sse.ts:57-159)

**Pattern Used:** Effect.gen with Effect.tryPromise

```typescript
// Current: sse.ts:57
export function discoverServers(): Effect.Effect<DiscoveredServer[], Error> {
  return Effect.gen(function* () {
    // Dynamic import for Node.js child_process
    const { exec } = yield* Effect.promise(() => import("child_process"))
    // ... lsof scanning
  })
}
```

**Analysis:**
- ✅ **Correct**: Returns Effect (not Promise)
- ✅ **Effect.gen**: Readable imperative style
- ✅ **Error Handling**: Effect.tryPromise with typed errors
- ⚠️ **No Retry**: One-shot execution, caller handles retries
- ⚠️ **Hardcoded Timeout**: 2000ms in execAsync options

**Resource Cleanup:**
- ✅ **Automatic**: `exec` process cleanup handled by Node.js
- ⚠️ **No Abort Signal**: Can't cancel mid-execution

### 1.4 World Stream Handle (stream.ts)

**Pattern Used:** Factory function returning object with methods

```typescript
// Current: stream.ts:38
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
  const store = new WorldStore()
  let sse: WorldSSE | null = null
  // ... initialization
  
  async function dispose(): Promise<void> {
    sse?.stop()
  }

  return { subscribe, getSnapshot, [Symbol.asyncIterator]: asyncIterator, dispose }
}
```

**Analysis:**
- ❌ **Manual Dispose**: Caller must remember to call `dispose()`
- ❌ **No Scope**: Resources not tied to Effect Scope lifecycle
- ✅ **Async Iterator**: Clean API for CLI/TUI consumers
- ⚠️ **Nullable SSE**: `sse` can be null (discovery delay)

**Resource Cleanup:**
- **Current**: Relies on `dispose()` being called
- **Desired**: Automatic cleanup via Effect.Scope (mem-fa2e52bd6e3f080b)

---

## 2. Service Pattern Assessment

### 2.1 Current DI vs Effect.Service

**What's Used:**

```typescript
// runtime.ts - Pure computation services
export class MessageService extends Context.Tag("MessageService")<
  MessageService,
  { listWithParts: (...) => EnrichedMessage[] }
>() {
  static Default = Layer.succeed(MessageService, {
    sync: () => ({
      listWithParts: (input) => { /* pure join logic */ }
    })
  })
}
```

**Pattern Match:** ✅ Follows mem-5bef20787787b69d "sync factory" pattern
- Pure functions, no lifecycle
- Consumed via `yield* MessageService` in atoms

**What's Missing:**

```typescript
// SSE connections should be Services too
export class SSEService extends Context.Tag("SSEService")<
  SSEService,
  {
    connectToServer: (port: number) => Stream.Stream<SSEEvent, Error>
    discoverServers: () => Effect.Effect<DiscoveredServer[], Error>
  }
>() {
  static Default = Layer.effect(
    SSEService,
    Effect.gen(function* () {
      // Service with lifecycle (if needed)
      return {
        connectToServer: (port) => connectToSSE(port),
        discoverServers: () => discoverServers()
      }
    })
  )
}
```

**Benefits:**
1. **Testability**: Mock SSEService in tests
2. **Composition**: Combine with other Layers
3. **Dependency Injection**: Automatic provision via Atom.runtime

### 2.2 Service Factory Pattern Gaps

**Existing:**
- ✅ MessageService (sync factory)
- ✅ StatusService (sync factory)
- ✅ CursorStore (scoped factory with acquireRelease)

**Missing:**
- ❌ SSEService (should be scoped factory for connection lifecycle)
- ❌ DiscoveryService (could be sync factory - no lifecycle)
- ❌ WorldStoreService (should be scoped factory - manages atom registry)

**Recommendation:** Apply three-factory-pattern consistently:
- **sync** for pure functions (MessageService, StatusService, DiscoveryService)
- **scoped** for resources with cleanup (SSEService, WorldStoreService)
- **effect** only when you need complex setup (not needed here)

---

## 3. Scope/acquireRelease Gaps

### 3.1 Current Usage (CursorStore)

**Excellent Example** (cursor-store.ts:135-165):

```typescript
export const CursorStoreLive = (dbPath: string): Layer.Layer<CursorStore, Error, never> =>
  Layer.scoped(
    CursorStore,
    Effect.acquireRelease(
      Effect.gen(function* () {
        // Ensure directory exists
        yield* Effect.sync(() => mkdirSync(dirname(dbPath), { recursive: true }))
        
        // Create client
        const client = yield* Effect.sync(() => createClient({ url: `file:${dbPath}` }))
        
        // Initialize schema
        yield* initSchema(client)
        
        // Return service
        return makeCursorStore(client)
      }),
      (service) => Effect.sync(() => {
        // Cleanup: close database connection
        // libSQL client doesn't have explicit close() in all versions
      })
    )
  )
```

**Analysis:**
- ✅ **Perfect**: Layer.scoped + acquireRelease
- ✅ **Guaranteed Cleanup**: Runs finalizer on success, failure, OR interruption
- ✅ **Composable**: Can be combined with other Layers
- ⚠️ **Comment-Only Cleanup**: libSQL doesn't have close() (GC-based)

**Pattern Match:** mem-fa2e52bd6e3f080b (acquireRelease for resource lifecycle)

### 3.2 Missing acquireRelease Opportunities

#### Opportunity 1: SSE Connection Lifecycle

**Current** (sse.ts:369-409):

```typescript
private connectToServer(port: number): void {
  const connectionEffect = Effect.gen(this, function* () {
    let attempts = 0
    while (this.running && attempts < this.config.maxReconnectAttempts) {
      try {
        this.connectedPorts.add(port)
        yield* this.bootstrapFromServer(port)
        yield* Stream.runForEach(connectToSSE(port), (event) =>
          Effect.sync(() => this.handleEvent(event))
        )
        break
      } catch (error) {
        this.connectedPorts.delete(port)
        attempts++
        // Manual exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
        yield* Effect.sleep(delay)
      }
    }
  })
  
  const fiber = Effect.runFork(connectionEffect)
  this.connectionFibers.set(port, fiber)
}
```

**Should Be** (with acquireRelease):

```typescript
const makeSSEConnection = (port: number, store: WorldStore) =>
  Effect.acquireRelease(
    // Acquire: Bootstrap + start streaming
    Effect.gen(function* () {
      yield* bootstrapFromServer(port, store)
      return { port, stream: connectToSSE(port) }
    }),
    // Release: Cleanup on success, failure, OR interruption
    ({ port }) => Effect.sync(() => {
      console.log(`Closed SSE connection to port ${port}`)
      // Auto-cleanup connection resources
    })
  )

// Usage in service
const connectionEffect = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* makeSSEConnection(port, store)
    yield* Stream.runForEach(conn.stream, handleEvent)
  })
)
```

**Benefits:**
1. **Interruption Safety**: Cleanup runs even if fiber interrupted
2. **No Manual Tracking**: Scope manages lifecycle
3. **Composable**: Can be used in Effect pipelines

#### Opportunity 2: WorldStore Lifecycle

**Current** (stream.ts:41):

```typescript
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
  const store = new WorldStore()
  let sse: WorldSSE | null = null
  // ... setup
  
  async function dispose(): Promise<void> {
    sse?.stop()
  }
}
```

**Should Be** (with scoped service):

```typescript
const makeWorldStream = (config: WorldStreamConfig) =>
  Effect.acquireRelease(
    // Acquire
    Effect.gen(function* () {
      const store = yield* Effect.sync(() => new WorldStore())
      const sse = yield* Effect.sync(() => new WorldSSE(store, config))
      yield* Effect.sync(() => sse.start())
      return { store, sse }
    }),
    // Release: Guaranteed cleanup
    ({ sse }) => Effect.sync(() => sse.stop())
  )

export function createWorldStream(config: WorldStreamConfig = {}): Effect.Effect<WorldStreamHandle, Error> {
  return Effect.scoped(
    Effect.gen(function* () {
      const { store, sse } = yield* makeWorldStream(config)
      return makeHandleFromStore(store, sse)
    })
  )
}
```

**Benefits:**
1. **No dispose()**: Cleanup automatic when Scope exits
2. **Composition**: Can be used in larger Effect programs
3. **Safety**: Resources cleaned up on interruption/error

#### Opportunity 3: Async Iterator Cleanup

**Current** (stream.ts:99-131):

```typescript
async function* asyncIterator(): AsyncIterableIterator<WorldState> {
  const unsubscribe = store.subscribe((state) => { /* ... */ })
  
  try {
    while (true) { /* ... yield states ... */ }
  } finally {
    unsubscribe()
  }
}
```

**Analysis:**
- ✅ **try/finally**: Manual cleanup in finally block
- ⚠️ **Not Effect-Aware**: Can't be interrupted by Effect.interrupt
- ⚠️ **Promise-Based**: Not composable with other Effects

**Could Be** (Effect.Stream based):

```typescript
const worldStream = (store: WorldStore): Stream.Stream<WorldState, never> =>
  Stream.asyncScoped<WorldState>((emit) =>
    Effect.acquireRelease(
      // Acquire subscription
      Effect.sync(() => store.subscribe((state) => emit.single(state))),
      // Release: Guaranteed unsubscribe
      (unsubscribe) => Effect.sync(() => unsubscribe())
    )
  )

// Usage
for await (const state of Effect.runPromise(Stream.runCollect(worldStream(store)))) {
  console.log(state)
}
```

**Benefits:**
1. **Composable**: Works with Stream combinators (debounce, throttle, etc.)
2. **Interruption Safe**: acquireRelease guarantees cleanup
3. **Type Safe**: Stream.Stream<WorldState, never> vs AsyncIterableIterator<WorldState>

### 3.3 acquireRelease Pattern Summary

**Applied:**
- ✅ CursorStore (DB connection lifecycle)

**Missing:**
- ❌ SSE connection lifecycle (manual tracking instead)
- ❌ WorldStore subscription cleanup (manual try/finally)
- ❌ Discovery resource cleanup (no timeout abort signal)

**Risk:** Without acquireRelease:
- Leaked SSE connections on process crash/interruption
- Leaked subscriptions if async iterator breaks
- No guarantee cleanup runs on error paths

---

## 4. Schedule/Retry Opportunities

### 4.1 Current Retry Implementation

**Manual Exponential Backoff** (sse.ts:398-399):

```typescript
// Manual backoff calculation
const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
yield* Effect.sleep(delay)
```

**Analysis:**
- ❌ **Not Composable**: Hardcoded formula, can't reuse
- ❌ **No Jitter**: Thundering herd risk (mem-14ce09f40baf67e1)
- ❌ **Hardcoded Max**: 30s cap, not configurable
- ⚠️ **Max Attempts Check**: `attempts < this.config.maxReconnectAttempts` works but verbose

### 4.2 Schedule Pattern (from mem-39cc6a9ddb674506)

**Should Be:**

```typescript
// Reusable retry policy with jitter
const sseRetrySchedule = Schedule.exponential("1 second")
  .pipe(Schedule.jittered) // Add ±25% randomness (prevent thundering herd)
  .pipe(Schedule.upTo("30 seconds")) // Cap max delay
  .pipe(Schedule.recurs(10)) // Max 10 attempts

// Usage
const connectionEffect = Effect.retry(
  Effect.gen(function* () {
    yield* bootstrapFromServer(port, store)
    yield* Stream.runForEach(connectToSSE(port), handleEvent)
  }),
  sseRetrySchedule
)
```

**Benefits:**
1. **Declarative**: Policy separate from logic
2. **Jittered**: Prevents thundering herd (mem-14ce09f40baf67e1)
3. **Testable**: Can mock Schedule in tests
4. **Composable**: Combine with `Schedule.whileInput` for conditional retry

### 4.3 Conditional Retry (Transient Errors Only)

**Current** (sse.ts:389):

```typescript
catch (error) {
  this.connectedPorts.delete(port)
  attempts++
  if (!this.config.autoReconnect || attempts >= this.config.maxReconnectAttempts) {
    break // Give up
  }
  // Retry with backoff
}
```

**Analysis:**
- ⚠️ **Retries All Errors**: Even non-transient ones (404, auth failures)
- ❌ **No Error Classification**: Should only retry 503, timeout, network errors

**Should Be:**

```typescript
// Retry only transient errors
const isTransientError = (error: Error) =>
  error.message.includes("ECONNREFUSED") ||
  error.message.includes("timeout") ||
  error.message.includes("503")

const retryPolicy = Schedule.exponential("1 second")
  .pipe(Schedule.jittered)
  .pipe(Schedule.whileInput((error: Error) => isTransientError(error)))
  .pipe(Schedule.recurs(10))

const connectionEffect = Effect.retry(connectEffect, retryPolicy)
```

**Benefits:**
1. **Smart Retry**: Only retry errors that might resolve
2. **Fast Fail**: 404/auth errors fail immediately
3. **Declarative**: Error logic separate from retry logic

### 4.4 Discovery Retry

**Current** (sse.ts:331-360):

```typescript
// No retry - runs every discoveryIntervalMs
while (this.running) {
  const servers = yield* discoverServers().pipe(
    Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[]))
  )
  // ... connect to servers
  yield* Effect.sleep(this.config.discoveryIntervalMs)
}
```

**Analysis:**
- ✅ **Periodic Retry**: Implicit via loop + sleep
- ❌ **Not Schedule-Based**: Reinventing Schedule.fixed
- ⚠️ **Swallows All Errors**: catchAll always succeeds (good for discovery, but hides issues)

**Could Be:**

```typescript
// Declarative periodic schedule
const discoverySchedule = Schedule.fixed("5 seconds")

const discoveryEffect = Effect.repeat(
  Effect.gen(function* () {
    const servers = yield* discoverServers()
    yield* connectToNewServers(servers)
    yield* disconnectFromDeadServers(servers)
  }),
  discoverySchedule
)
```

**Benefits:**
1. **Clearer Intent**: Schedule.fixed vs manual loop
2. **Composable**: Can add jitter, backoff if needed
3. **Testable**: Mock schedule in tests

### 4.5 Schedule Opportunities Summary

**Current:**
- ❌ Manual exponential backoff (sse.ts:398)
- ❌ No jitter (thundering herd risk)
- ❌ Retries all errors (no transient classification)
- ⚠️ Discovery loop reinvents Schedule.fixed

**Recommendations:**
1. **SSE Reconnect**: `Schedule.exponential.pipe(Schedule.jittered, Schedule.recurs(10))`
2. **Discovery Loop**: `Schedule.fixed("5 seconds")`
3. **Conditional Retry**: `Schedule.whileInput(isTransientError)`

**Files to Update:**
- `sse.ts:398` - Replace manual backoff with Schedule
- `sse.ts:331` - Replace loop with Effect.repeat + Schedule

---

## 5. Effect.gen Usage

### 5.1 Current Usage

**Good Examples:**

```typescript
// sse.ts:57 - Discovery
export function discoverServers(): Effect.Effect<DiscoveredServer[], Error> {
  return Effect.gen(function* () {
    const { exec } = yield* Effect.promise(() => import("child_process"))
    // ... imperative workflow
  })
}

// cursor-store.ts:139 - DB setup
Effect.acquireRelease(
  Effect.gen(function* () {
    yield* Effect.sync(() => mkdirSync(dirname(dbPath), { recursive: true }))
    const client = yield* Effect.sync(() => createClient({ url: `file:${dbPath}` }))
    yield* initSchema(client)
    return makeCursorStore(client)
  }),
  // ... cleanup
)
```

**Analysis:**
- ✅ **Correct**: `function*` (not arrow function)
- ✅ **Imperative Style**: Reads like async/await
- ✅ **Service Access**: `yield* ServiceName` pattern

### 5.2 Promise-Based Code (Should Be Effect.gen)

**stream.ts:99-131** (Async Iterator):

```typescript
async function* asyncIterator(): AsyncIterableIterator<WorldState> {
  yield store.getState() // Promise-based
  
  const queue: WorldState[] = []
  let resolveNext: ((state: WorldState) => void) | null = null
  
  const unsubscribe = store.subscribe((state) => {
    if (resolveNext) {
      resolveNext(state)
      resolveNext = null
    } else {
      queue.push(state)
    }
  })
  
  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!
      } else {
        const state = await new Promise<WorldState>((resolve) => {
          resolveNext = resolve
        })
        yield state
      }
    }
  } finally {
    unsubscribe()
  }
}
```

**Analysis:**
- ❌ **Promise-Based**: Uses `async/await` instead of Effect
- ❌ **Manual Queue**: Reinventing Stream.asyncScoped
- ⚠️ **try/finally**: Should be acquireRelease

**Should Be:**

```typescript
const worldStream = (store: WorldStore): Stream.Stream<WorldState, never> =>
  Stream.asyncScoped<WorldState>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        emit.single(store.getState()) // Yield initial state
        return store.subscribe((state) => emit.single(state))
      }),
      (unsubscribe) => Effect.sync(() => unsubscribe())
    )
  )

// Async iterator wrapper (for backwards compat)
async function* asyncIterator(): AsyncIterableIterator<WorldState> {
  for await (const state of worldStream(store)) {
    yield state
  }
}
```

**Benefits:**
1. **No Manual Queue**: Stream handles buffering
2. **acquireRelease**: Guaranteed cleanup
3. **Composable**: Can use Stream combinators

### 5.3 Effect.gen vs async/await

**When to Use Effect.gen:**
- ✅ Resource management (acquireRelease)
- ✅ Service dependencies (yield* ServiceName)
- ✅ Complex retry logic (Schedule)
- ✅ Interruption-aware workflows

**When async/await is OK:**
- ✅ Top-level entry points (Effect.runPromise wrapper)
- ✅ External API boundaries (compatibility)
- ⚠️ Simple Promise chains (but Effect.gen is often clearer)

**Current State:**
- ✅ discovery, cursor-store use Effect.gen
- ❌ stream.ts async iterator should use Stream.asyncScoped
- ⚠️ sse.ts connectToSSE is Stream.async (good) but connectionEffect could use Effect.gen

---

## 6. Recommendations

### 6.1 High-Priority (Critical Path)

#### 1. Extract SSEService (Effort: Medium, Risk: Medium)

**Problem:** SSE connections managed imperatively in WorldSSE class, not composable.

**Solution:**

```typescript
// packages/core/src/services/sse-service.ts
export class SSEService extends Context.Tag("SSEService")<
  SSEService,
  {
    connectToServer: (port: number) => Stream.Stream<SSEEvent, Error>
    discoverServers: () => Effect.Effect<DiscoveredServer[], Error>
  }
>() {
  static Default = Layer.succeed(SSEService, {
    sync: () => ({
      connectToServer: (port) => connectToSSE(port),
      discoverServers: () => discoverServers()
    })
  })
}
```

**Benefits:**
- Testable (mock SSEService in tests)
- Composable (add to ApiLayer)
- Follows existing Service pattern

**Migration Path:**
1. Extract `connectToSSE` and `discoverServers` to SSEService
2. Update WorldSSE to use SSEService via dependency injection
3. Add SSEService to ApiLayer in runtime.ts

#### 2. Add acquireRelease for SSE Connections (Effort: High, Risk: Low)

**Problem:** Manual cleanup, no interruption safety.

**Solution:**

```typescript
const makeSSEConnection = (port: number, store: WorldStore) =>
  Effect.acquireRelease(
    // Acquire
    Effect.gen(function* () {
      yield* bootstrapFromServer(port, store)
      return { port, stream: connectToSSE(port) }
    }),
    // Release: Guaranteed cleanup
    ({ port }) => Effect.sync(() => {
      console.log(`Closed SSE connection to port ${port}`)
    })
  )

// Usage
const connectionEffect = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* makeSSEConnection(port, store)
    yield* Stream.runForEach(conn.stream, (event) =>
      Effect.sync(() => handleEvent(event))
    )
  })
)
```

**Benefits:**
- Interruption safety (cleanup guaranteed)
- No manual fiber tracking
- Composable with other Effects

**Migration Path:**
1. Wrap bootstrap + stream in acquireRelease
2. Remove manual fiber tracking from WorldSSE
3. Test interruption cleanup

#### 3. Replace Manual Backoff with Schedule (Effort: Low, Risk: Low)

**Problem:** Manual exponential backoff, no jitter, hardcoded.

**Solution:**

```typescript
// Before (sse.ts:398)
const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
yield* Effect.sleep(delay)

// After
const sseRetrySchedule = Schedule.exponential("1 second")
  .pipe(Schedule.jittered)
  .pipe(Schedule.upTo("30 seconds"))
  .pipe(Schedule.recurs(10))

const connectionEffect = Effect.retry(connectEffect, sseRetrySchedule)
```

**Benefits:**
- Jitter prevents thundering herd
- Declarative, testable
- Configurable (extract to WorldSSEConfig)

**Migration Path:**
1. Define sseRetrySchedule in sse.ts
2. Replace manual backoff with Effect.retry
3. Add jitter configuration to WorldSSEConfig

### 6.2 Medium-Priority (Quality of Life)

#### 4. Convert Async Iterator to Stream.asyncScoped (Effort: Medium, Risk: Low)

**Problem:** Manual queue management, Promise-based.

**Solution:**

```typescript
const worldStream = (store: WorldStore): Stream.Stream<WorldState, never> =>
  Stream.asyncScoped<WorldState>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        emit.single(store.getState())
        return store.subscribe((state) => emit.single(state))
      }),
      (unsubscribe) => Effect.sync(() => unsubscribe())
    )
  )
```

**Benefits:**
- No manual queue
- acquireRelease cleanup
- Composable (debounce, throttle, etc.)

**Migration Path:**
1. Add worldStream helper to stream.ts
2. Update asyncIterator to delegate to worldStream
3. Test with existing consumers

#### 5. Extract WorldStoreService (Effort: High, Risk: Medium)

**Problem:** WorldStore is a class, not a Service.

**Solution:**

```typescript
export class WorldStoreService extends Context.Tag("WorldStore")<
  WorldStoreService,
  WorldStore
>() {
  static Default = Layer.scoped(
    WorldStoreService,
    Effect.acquireRelease(
      Effect.sync(() => new WorldStore()),
      (store) => Effect.sync(() => {
        // Cleanup: dispose atom registry
        store.dispose()
      })
    )
  )
}
```

**Benefits:**
- DI for WorldStore (testability)
- Lifecycle management via Scope
- Composable with SSEService

**Migration Path:**
1. Add dispose() to WorldStore class
2. Create WorldStoreService Layer
3. Update createWorldStream to use WorldStoreService

### 6.3 Low-Priority (Nice to Have)

#### 6. Add Conditional Retry (Transient Errors Only) (Effort: Low, Risk: Low)

**Problem:** Retries all errors, even non-transient ones.

**Solution:**

```typescript
const isTransientError = (error: Error) =>
  error.message.includes("ECONNREFUSED") ||
  error.message.includes("timeout") ||
  error.message.includes("503")

const retryPolicy = sseRetrySchedule.pipe(
  Schedule.whileInput((error: Error) => isTransientError(error))
)
```

**Benefits:**
- Faster failure for 404/auth errors
- Reduced noise in logs

#### 7. Replace Discovery Loop with Schedule.repeat (Effort: Low, Risk: Low)

**Problem:** Manual while loop reinvents Schedule.

**Solution:**

```typescript
const discoverySchedule = Schedule.fixed("5 seconds")

const discoveryEffect = Effect.repeat(
  Effect.gen(function* () {
    const servers = yield* discoverServers()
    // ... handle servers
  }),
  discoverySchedule
)
```

**Benefits:**
- Clearer intent
- Composable (add jitter if needed)

---

## 7. Risk/Effort Assessment

### Summary Table

| Recommendation | Effort | Risk | Impact | Priority |
|----------------|--------|------|--------|----------|
| 1. Extract SSEService | Medium | Medium | High | **HIGH** |
| 2. acquireRelease for SSE | High | Low | High | **HIGH** |
| 3. Schedule for retry | Low | Low | Medium | **HIGH** |
| 4. Stream.asyncScoped | Medium | Low | Medium | **MEDIUM** |
| 5. WorldStoreService | High | Medium | Medium | **MEDIUM** |
| 6. Conditional retry | Low | Low | Low | **LOW** |
| 7. Schedule for discovery | Low | Low | Low | **LOW** |

### Risk Analysis

**Low Risk:**
- Schedule adoption (drop-in replacement for manual backoff)
- Conditional retry (additive, doesn't change happy path)
- Stream.asyncScoped (internal refactor, same API)

**Medium Risk:**
- SSEService extraction (changes DI approach, needs testing)
- WorldStoreService (touches core state management)

**High Risk:**
- None (no breaking API changes)

### Effort Analysis

**Low Effort (< 1 day):**
- Schedule for retry (#3)
- Conditional retry (#6)
- Discovery Schedule (#7)

**Medium Effort (1-2 days):**
- SSEService extraction (#1)
- Stream.asyncScoped (#4)

**High Effort (2-4 days):**
- acquireRelease for SSE (#2) - requires refactoring WorldSSE class
- WorldStoreService (#5) - touches many consumers

### Migration Strategy

**Phase 1 (Low-Hanging Fruit):**
1. Schedule for retry (#3) - Replace manual backoff
2. Conditional retry (#6) - Add transient error check
3. Discovery Schedule (#7) - Replace loop

**Phase 2 (Service Extraction):**
1. SSEService (#1) - Extract to Service pattern
2. acquireRelease for SSE (#2) - Add Scope-based cleanup

**Phase 3 (Advanced Patterns):**
1. Stream.asyncScoped (#4) - Refactor async iterator
2. WorldStoreService (#5) - Extract store to Service

---

## 8. Code Examples (Before/After)

### Example 1: SSE Retry with Schedule

**Before (sse.ts:372-409):**

```typescript
private connectToServer(port: number): void {
  const connectionEffect = Effect.gen(this, function* () {
    let attempts = 0
    while (this.running && attempts < this.config.maxReconnectAttempts) {
      try {
        this.connectedPorts.add(port)
        yield* this.bootstrapFromServer(port)
        yield* Stream.runForEach(connectToSSE(port), (event) =>
          Effect.sync(() => this.handleEvent(event))
        )
        break
      } catch (error) {
        this.connectedPorts.delete(port)
        attempts++
        if (!this.config.autoReconnect || attempts >= this.config.maxReconnectAttempts) {
          break
        }
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
        yield* Effect.sleep(delay)
      }
    }
  })
  
  const fiber = Effect.runFork(connectionEffect)
  this.connectionFibers.set(port, fiber)
}
```

**After (with Schedule):**

```typescript
// Define retry policy (reusable)
const sseRetrySchedule = Schedule.exponential("1 second")
  .pipe(Schedule.jittered) // Add ±25% randomness
  .pipe(Schedule.upTo("30 seconds")) // Cap max delay
  .pipe(Schedule.recurs(10)) // Max 10 attempts
  .pipe(Schedule.whileInput((error: Error) => isTransientError(error))) // Only retry transient

private connectToServer(port: number): void {
  const connectionEffect = Effect.retry(
    Effect.gen(this, function* () {
      this.connectedPorts.add(port)
      yield* this.bootstrapFromServer(port)
      yield* Stream.runForEach(connectToSSE(port), (event) =>
        Effect.sync(() => this.handleEvent(event))
      )
    }),
    sseRetrySchedule
  )
  
  const fiber = Effect.runFork(connectionEffect)
  this.connectionFibers.set(port, fiber)
}
```

**Benefits:**
- ✅ No manual retry loop
- ✅ Jitter prevents thundering herd
- ✅ Conditional retry (transient errors only)
- ✅ Declarative policy

---

### Example 2: SSE Connection with acquireRelease

**Before (sse.ts:369-409):**

```typescript
// Manual resource tracking
private connectionFibers = new Map<number, Fiber.RuntimeFiber<void, Error>>()
private connectedPorts = new Set<number>()

private connectToServer(port: number): void {
  // ... manual fiber management
  this.connectedPorts.add(port)
  // ... stream
  this.connectedPorts.delete(port)
}

stop(): void {
  for (const [port, fiber] of this.connectionFibers) {
    Effect.runFork(Fiber.interrupt(fiber))
  }
  this.connectionFibers.clear()
}
```

**After (with acquireRelease):**

```typescript
const makeSSEConnection = (
  port: number,
  store: WorldStore
): Effect.Effect<SSEConnection, Error, Scope.Scope> =>
  Effect.acquireRelease(
    // Acquire: Bootstrap + create stream
    Effect.gen(function* () {
      console.log(`Connecting to port ${port}`)
      yield* bootstrapFromServer(port, store)
      return {
        port,
        stream: connectToSSE(port),
        handleEvent: (event: SSEEvent) => handleEvent(event, store)
      }
    }),
    // Release: Guaranteed cleanup on interruption/error/success
    ({ port }) => Effect.sync(() => {
      console.log(`Disconnected from port ${port}`)
    })
  )

// Usage
const connectionEffect = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* makeSSEConnection(port, store)
    yield* Stream.runForEach(conn.stream, (event) =>
      Effect.sync(() => conn.handleEvent(event))
    )
  })
)

// No manual cleanup needed - Scope handles it
const fiber = Effect.runFork(connectionEffect)
```

**Benefits:**
- ✅ Guaranteed cleanup on interruption
- ✅ No manual port/fiber tracking
- ✅ Composable (can add more resources)

---

### Example 3: World Stream with Stream.asyncScoped

**Before (stream.ts:99-131):**

```typescript
async function* asyncIterator(): AsyncIterableIterator<WorldState> {
  yield store.getState()
  
  const queue: WorldState[] = []
  let resolveNext: ((state: WorldState) => void) | null = null
  
  const unsubscribe = store.subscribe((state) => {
    if (resolveNext) {
      resolveNext(state)
      resolveNext = null
    } else {
      queue.push(state)
    }
  })
  
  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!
      } else {
        const state = await new Promise<WorldState>((resolve) => {
          resolveNext = resolve
        })
        yield state
      }
    }
  } finally {
    unsubscribe()
  }
}
```

**After (with Stream.asyncScoped):**

```typescript
// Create Effect Stream with automatic cleanup
const worldStream = (store: WorldStore): Stream.Stream<WorldState, never> =>
  Stream.asyncScoped<WorldState>((emit) =>
    Effect.acquireRelease(
      // Acquire subscription
      Effect.sync(() => {
        emit.single(store.getState()) // Yield initial state
        return store.subscribe((state) => emit.single(state))
      }),
      // Release: Guaranteed unsubscribe
      (unsubscribe) => Effect.sync(() => unsubscribe())
    )
  )

// Async iterator wrapper (for backwards compatibility)
async function* asyncIterator(): AsyncIterableIterator<WorldState> {
  const runtime = Effect.runFork(
    Stream.runForEach(worldStream(store), function* (state) {
      // Yield to async iterator
    })
  )
  // ... implementation
}

// Or use Effect Stream directly
for await (const state of Stream.runAsyncIterable(worldStream(store))) {
  console.log(state)
}
```

**Benefits:**
- ✅ No manual queue management
- ✅ acquireRelease guarantees cleanup
- ✅ Composable with Stream combinators (debounce, throttle)
- ✅ Type-safe Stream.Stream<WorldState, never>

---

### Example 4: SSEService Extraction

**Before (sse.ts):**

```typescript
// Functions at module level
export function discoverServers(): Effect.Effect<DiscoveredServer[], Error> { /*...*/ }
export function connectToSSE(port: number): Stream.Stream<SSEEvent, Error> { /*...*/ }

// Usage (tightly coupled)
const servers = yield* discoverServers()
const stream = connectToSSE(port)
```

**After (with Service pattern):**

```typescript
// packages/core/src/services/sse-service.ts
export class SSEService extends Context.Tag("SSEService")<
  SSEService,
  {
    discoverServers: () => Effect.Effect<DiscoveredServer[], Error>
    connectToServer: (port: number) => Stream.Stream<SSEEvent, Error>
  }
>() {
  static Default = Layer.succeed(SSEService, {
    sync: () => ({
      discoverServers: () => discoverServers(),
      connectToServer: (port) => connectToSSE(port)
    })
  })
}

// Usage (dependency injection)
const effect = Effect.gen(function* () {
  const sse = yield* SSEService
  const servers = yield* sse.discoverServers()
  const stream = sse.connectToServer(port)
})

// Add to ApiLayer
const ApiLayer = Layer.mergeAll(
  MessageService.Default,
  StatusService.Default,
  SSEService.Default
)
```

**Benefits:**
- ✅ Testable (mock SSEService in tests)
- ✅ DI via Layer composition
- ✅ Follows existing Service pattern

---

### Example 5: Discovery with Schedule.repeat

**Before (sse.ts:328-361):**

```typescript
private startDiscoveryLoop(): void {
  const discoveryEffect = Effect.gen(this, function* () {
    while (this.running) {
      const servers = yield* discoverServers().pipe(
        Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[]))
      )
      
      // ... handle servers
      
      yield* Effect.sleep(this.config.discoveryIntervalMs)
    }
  })
  
  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**After (with Schedule.repeat):**

```typescript
private startDiscoveryLoop(): void {
  const discoverySchedule = Schedule.fixed(this.config.discoveryIntervalMs)
  
  const discoveryEffect = Effect.repeat(
    Effect.gen(this, function* () {
      const servers = yield* discoverServers().pipe(
        Effect.catchAll(() => Effect.succeed([] as DiscoveredServer[]))
      )
      
      // ... handle servers
    }),
    discoverySchedule
  )
  
  this.discoveryFiber = Effect.runFork(discoveryEffect)
}
```

**Benefits:**
- ✅ Clearer intent (Schedule.fixed vs manual loop)
- ✅ Can add jitter if needed: `Schedule.fixed(...).pipe(Schedule.jittered)`
- ✅ Testable (mock schedule)

---

## 9. Testing Implications

### Current Testing Challenges

**WorldSSE Class:**
- ❌ Hard to test (global state, manual lifecycle)
- ❌ Can't mock discovery/connections
- ❌ Requires real network or complex mocks

**Stream Functions:**
- ✅ Easier to test (pure Effect functions)
- ⚠️ Still requires network mocks for fetch

### After Service Pattern

**With SSEService:**

```typescript
// Test with mock SSEService
const MockSSEService = Layer.succeed(SSEService, {
  sync: () => ({
    discoverServers: () => Effect.succeed([{ port: 1999, pid: 123, directory: "/test" }]),
    connectToServer: (port) => Stream.make({ type: "test", properties: {} })
  })
})

const testProgram = Effect.gen(function* () {
  const sse = yield* SSEService
  const servers = yield* sse.discoverServers()
  expect(servers).toHaveLength(1)
}).pipe(Effect.provide(MockSSEService))

await Effect.runPromise(testProgram)
```

**Benefits:**
- ✅ No network required
- ✅ Fast tests
- ✅ Deterministic

### After acquireRelease

**Resource Cleanup Tests:**

```typescript
test("SSE connection cleans up on interruption", async () => {
  const cleanupCalled = { value: false }
  
  const connectionEffect = Effect.acquireRelease(
    Effect.succeed({ port: 1999 }),
    () => Effect.sync(() => { cleanupCalled.value = true })
  )
  
  const fiber = Effect.runFork(Effect.scoped(connectionEffect))
  await Effect.runPromise(Fiber.interrupt(fiber))
  
  expect(cleanupCalled.value).toBe(true) // Cleanup guaranteed!
})
```

**Benefits:**
- ✅ Can test cleanup guarantees
- ✅ Can test interruption scenarios

---

## 10. References

### Hivemind Learnings

- **mem-5bef20787787b69d**: Effect Service Factory Patterns (sync/scoped/effect)
- **mem-fa2e52bd6e3f080b**: acquireRelease pattern for resource management
- **mem-39cc6a9ddb674506**: Schedule pattern for retry with exponential backoff
- **mem-14ce09f40baf67e1**: Exponential backoff with jitter for reconnection
- **mem-a7f365b1ba7a975e**: Effect.gen for imperative Effect composition

### Related ADRs

- **ADR-016**: Core Layer Responsibility (smart boundary pattern)
- **ADR-018**: Reactive World Stream (push-based state)

### Effect-TS Patterns Collection

- **p.17**: acquireRelease (guaranteed cleanup)
- **p.306**: Schedule.exponential (retry with backoff)
- **p.328**: Schedule combinators (jittered, recurs, whileInput)

---

## 11. Conclusion

The `core/world` module is **partially Effect-aware** with strong foundations but significant gaps:

**Strengths:**
- ✅ Atom.runtime pattern for pure services (MessageService, StatusService)
- ✅ Excellent acquireRelease example (CursorStore)
- ✅ Effect.gen usage in discovery/cursor-store

**Critical Gaps:**
- ❌ SSE lifecycle managed imperatively (not Service pattern)
- ❌ No acquireRelease for SSE connections (manual cleanup)
- ❌ Manual exponential backoff (should use Schedule)
- ❌ Async iterator uses Promises (should use Stream.asyncScoped)

**Recommended Migration Path:**
1. **Phase 1 (Low-Hanging Fruit)**: Schedule for retry, conditional retry (1-2 days)
2. **Phase 2 (Service Extraction)**: SSEService, acquireRelease (3-5 days)
3. **Phase 3 (Advanced)**: WorldStoreService, Stream.asyncScoped (3-5 days)

**Total Effort:** 7-12 days for full migration  
**Risk:** Low-Medium (mostly additive, no breaking API changes)  
**Impact:** High (improved testability, safety, composability)

The migration is **incremental** - each phase delivers value independently. Start with Schedule (quick win), then tackle Service extraction (biggest impact).
