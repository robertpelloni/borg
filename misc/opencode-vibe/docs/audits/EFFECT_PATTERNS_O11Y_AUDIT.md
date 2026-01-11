# Effect Patterns O11y Audit - Core/World Layer

**Auditor**: SilverDawn  
**Date**: 2026-01-02  
**Scope**: All `packages/core/src/world/*.ts` files (13 files, ~1,900 LOC)  
**Priority**: HIGHEST - This is fundamentally an observability project

---

## Executive Summary

**CRITICAL FINDING**: Zero Effect-TS observability instrumentation across 1,900+ LOC of reactive streaming code.

The `core/world` layer implements a complex reactive SSE streaming system with server discovery, connection management, event parsing, state derivation, and cursor-based pagination. **None of it is instrumented.**

This is a production-grade distributed system with:
- Multi-server SSE connections
- Binary search updates (O(log n) complexity)
- Complex state derivation (sessions → messages → parts enrichment)
- Polling-based event sources (SwarmDb)
- Error handling with reconnection logic
- Cursor-based durable streaming

**Without observability, debugging is impossible in production.**

---

## 1. Current O11y State

### What Exists Today

**ZERO Effect-TS observability instrumentation:**
- ❌ No `Effect.tap` for pipeline inspection
- ❌ No `Effect.log*` for structured logging
- ❌ No `Effect.annotateLogs` for context tracking
- ❌ No `Effect.withSpan` for tracing
- ❌ No `Metric.*` for counters/gauges/histograms
- ❌ No `Effect.fn` instrumentation wrappers

**What we DO have:**
- ✅ Effect-TS used heavily (Effect.gen, Effect.tryPromise, Stream.async)
- ✅ Error handling with Effect.catchAll
- ✅ Resource cleanup with Effect.acquireRelease
- ✅ Service layers (CursorStore, MessageService, StatusService)

**CRITICAL GAP**: The infrastructure for observability exists (Effect-TS), but **none of the observability features are used**.

### Files Analyzed

| File | LOC | Purpose | Current O11y | Missed Opportunities |
|------|-----|---------|-------------|---------------------|
| `atoms.ts` | 340 | WorldStore state management | None | Binary search tracing, derivation timing |
| `derived.ts` | 143 | effect-atom world derivation | None | Hot path profiling, enrichment stages |
| `sse.ts` | 515 | SSE connection management | None | Connection lifecycle, reconnection metrics |
| `stream.ts` | 154 | World stream public API | None | Discovery timing, subscription counts |
| `sse-bridge.ts` | 131 | Event processing bridge | None | Event type distribution, processing latency |
| `events.ts` | 173 | WorldEvent schema definitions | None | Schema validation failures |
| `merged-stream.ts` | 225 | Multi-source event merging | None | Source availability, merge performance |
| `runtime.ts` | 100 | AtomRuntime with API services | None | Service call frequency, latency |
| `cursor.ts` | 43 | Cursor type definitions | None | N/A (types only) |
| `cursor-store.ts` | 166 | libSQL cursor persistence | None | DB query latency, save/load frequency |
| `event-source.ts` | 199 | SwarmDb polling source | None | Poll frequency, event batch sizes, DB errors |
| `types.ts` | 126 | Type definitions | None | N/A (types only) |
| `index.ts` | 68 | Public API exports | None | N/A (exports only) |
| **TOTAL** | **~1,900** | | **ZERO** | **Everywhere** |

---

## 2. Logging Opportunities

### Critical Logging Gaps

#### 2.1 SSE Connection Lifecycle (`sse.ts`)

**MISSING: Connection state transitions, discovery results, reconnection attempts**

**BEFORE (current):**
```typescript
// sse.ts:278-293 - Silent connection start
start(): void {
  if (this.running) return
  this.running = true
  this.store.setConnectionStatus("connecting")

  if (this.config.serverUrl) {
    const url = new URL(this.config.serverUrl)
    const port = parseInt(url.port || "1999", 10)
    this.connectToServer(port)
    return
  }

  this.startDiscoveryLoop()
}
```

**AFTER (with Effect.tap + annotateLogs):**
```typescript
start(): void {
  if (this.running) return
  this.running = true
  
  // Log connection start with context
  Effect.runFork(
    Effect.log("WorldSSE starting").pipe(
      Effect.annotateLogs({
        serverUrl: this.config.serverUrl || "auto-discover",
        autoReconnect: this.config.autoReconnect,
        maxAttempts: this.config.maxReconnectAttempts
      })
    )
  )
  
  this.store.setConnectionStatus("connecting")

  if (this.config.serverUrl) {
    const url = new URL(this.config.serverUrl)
    const port = parseInt(url.port || "1999", 10)
    this.connectToServer(port)
    return
  }

  this.startDiscoveryLoop()
}
```

#### 2.2 Server Discovery (`sse.ts:57-118`)

**MISSING: Discovery results, verification failures, lsof output**

**BEFORE:**
```typescript
export function discoverServers(): Effect.Effect<DiscoveredServer[], Error> {
  return Effect.gen(function* () {
    // ... lsof execution ...
    const result = yield* Effect.tryPromise({
      try: async () => { /* lsof command */ },
      catch: (error) => new Error(`Discovery failed: ${error}`)
    })
    
    // Parse candidates silently
    const candidates: Array<{ port: number; pid: number }> = []
    // ... parsing logic ...
    
    return servers
  })
}
```

**AFTER:**
```typescript
export function discoverServers(): Effect.Effect<DiscoveredServer[], Error> {
  return Effect.gen(function* () {
    yield* Effect.logDebug("Starting server discovery")
    
    const result = yield* Effect.tryPromise({
      try: async () => { /* lsof command */ },
      catch: (error) => new Error(`Discovery failed: ${error}`)
    }).pipe(
      Effect.tapError(err => 
        Effect.logWarning("Discovery lsof failed").pipe(
          Effect.annotateLogs({ error: err.message })
        )
      )
    )
    
    const candidates: Array<{ port: number; pid: number }> = []
    // ... parsing logic ...
    
    yield* Effect.log("Discovery found candidates").pipe(
      Effect.annotateLogs({ candidateCount: candidates.length })
    )
    
    // Verify each candidate
    const servers: DiscoveredServer[] = []
    for (const candidate of candidates) {
      const server = yield* verifyServer(candidate.port, candidate.pid).pipe(
        Effect.tap(s => s 
          ? Effect.logInfo("Verified OpenCode server").pipe(
              Effect.annotateLogs({ port: candidate.port, directory: s.directory })
            )
          : Effect.logDebug("Not an OpenCode server").pipe(
              Effect.annotateLogs({ port: candidate.port })
            )
        )
      )
      if (server) servers.push(server)
    }
    
    yield* Effect.logInfo("Discovery complete").pipe(
      Effect.annotateLogs({ serverCount: servers.length })
    )
    
    return servers
  })
}
```

#### 2.3 Event Processing (`sse-bridge.ts:85-122`)

**MISSING: Event type distribution, malformed events, processing failures**

**BEFORE:**
```typescript
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
    // ... other cases ...
  }
}
```

**AFTER:**
```typescript
processEvent(event: SSEEvent): void {
  const { type, properties } = event.payload
  
  // Log event with context
  Effect.runFork(
    Effect.logDebug("Processing SSE event").pipe(
      Effect.annotateLogs({
        eventType: type,
        directory: event.directory,
        hasProperties: !!properties
      })
    )
  )

  switch (type) {
    case "session.created":
    case "session.updated": {
      const session = properties.info as Session | undefined
      if (session) {
        store.upsertSession(session)
        Effect.runFork(
          Effect.logInfo("Session upserted").pipe(
            Effect.annotateLogs({ sessionId: session.id, eventType: type })
          )
        )
      } else {
        Effect.runFork(
          Effect.logWarning("Malformed session event").pipe(
            Effect.annotateLogs({ eventType: type, properties })
          )
        )
      }
      break
    }
    // ... other cases with similar logging ...
  }
}
```

#### 2.4 State Derivation (`atoms.ts:197-294`)

**MISSING: Derivation timing, data volumes, computed stats**

**BEFORE:**
```typescript
private deriveWorldState(data: WorldStateData): WorldState {
  // Build message ID -> parts map (silent)
  const partsByMessage = new Map<string, Part[]>()
  for (const part of data.parts) {
    const existing = partsByMessage.get(part.messageID) ?? []
    existing.push(part)
    partsByMessage.set(part.messageID, existing)
  }
  
  // ... 100 lines of enrichment logic ...
  
  return { /* world state */ }
}
```

**AFTER:**
```typescript
private deriveWorldState(data: WorldStateData): WorldState {
  // Wrap in Effect for instrumentation
  const derivation = Effect.gen(function* () {
    yield* Effect.logDebug("Starting world derivation").pipe(
      Effect.annotateLogs({
        sessionCount: data.sessions.length,
        messageCount: data.messages.length,
        partCount: data.parts.length
      })
    )
    
    // Build message ID -> parts map
    const partsByMessage = new Map<string, Part[]>()
    for (const part of data.parts) {
      const existing = partsByMessage.get(part.messageID) ?? []
      existing.push(part)
      partsByMessage.set(part.messageID, existing)
    }
    
    yield* Effect.logDebug("Built parts index").pipe(
      Effect.annotateLogs({ uniqueMessages: partsByMessage.size })
    )
    
    // ... enrichment logic ...
    
    const worldState: WorldState = { /* ... */ }
    
    yield* Effect.logDebug("Derivation complete").pipe(
      Effect.annotateLogs({
        enrichedSessions: worldState.sessions.length,
        activeCount: worldState.activeSessionCount,
        streamingCount: worldState.stats.streaming
      })
    )
    
    return worldState
  }).pipe(Effect.withLogSpan("deriveWorldState"))
  
  // Run synchronously for now (TODO: make async)
  return Effect.runSync(derivation)
}
```

### Structured Logging Best Practices

**Context Propagation Pattern:**
```typescript
// Annotate at entry point, propagates to all nested Effects
const program = Effect.gen(function* () {
  yield* Effect.annotateLogs({
    sessionId: "ses-123",
    directory: "/project/path",
    requestId: "req-456"
  })
  
  yield* discoverServers() // Inherits annotations
  yield* connectToSSE(port) // Inherits annotations
  yield* processEvents() // Inherits annotations
})
```

**Log Levels:**
- **Debug**: Discovery candidates, event parsing details, availability checks
- **Info**: Connection lifecycle, session upserts, discovery results
- **Warning**: Malformed events, verification failures, reconnection attempts
- **Error**: lsof failures, DB errors, unrecoverable connection failures

---

## 3. Tracing Opportunities

### SSE Pipeline - End-to-End Trace

**THE GOLDEN OPPORTUNITY**: SSE event processing is a multi-stage pipeline begging for distributed tracing.

**Pipeline Stages:**
1. **connect** - Establish SSE connection
2. **parse** - eventsource-parser parses SSE frames
3. **extract** - JSON.parse event payload
4. **route** - Switch on event type
5. **upsert** - Binary search + array splice
6. **derive** - Compute enriched world state
7. **emit** - Notify subscribers

**BEFORE (no tracing):**
```typescript
// sse.ts:171-244 - Silent SSE stream
export function connectToSSE(port: number): Stream.Stream<SSEEvent, Error> {
  return Stream.async<SSEEvent, Error>((emit) => {
    const url = `http://127.0.0.1:${port}/global/event`
    
    parser = createParser({
      onEvent: (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.payload?.type && data.payload?.properties) {
            emit.single({
              type: data.payload.type,
              properties: data.payload.properties,
            })
          }
        } catch (error) {
          // Skip malformed events
        }
      },
    })
    
    // ... fetch and stream ...
  })
}
```

**AFTER (with Effect.withSpan):**
```typescript
export function connectToSSE(port: number): Stream.Stream<SSEEvent, Error> {
  return Stream.async<SSEEvent, Error>((emit) => {
    const url = `http://127.0.0.1:${port}/global/event`
    
    parser = createParser({
      onEvent: (event) => {
        // Wrap parsing in traced Effect
        Effect.runFork(
          Effect.gen(function* () {
            // Stage 1: Parse JSON
            const data = yield* Effect.try({
              try: () => JSON.parse(event.data),
              catch: (e) => new Error(`JSON parse failed: ${e}`)
            }).pipe(
              Effect.withSpan("sse.parse", {
                attributes: { "event.id": event.id, "event.type": event.event }
              }),
              Effect.tapError(err => 
                Effect.logWarning("Malformed SSE event").pipe(
                  Effect.annotateLogs({ error: err.message, data: event.data.slice(0, 100) })
                )
              )
            )
            
            // Stage 2: Extract payload
            if (data.payload?.type && data.payload?.properties) {
              yield* Effect.sync(() => {
                emit.single({
                  type: data.payload.type,
                  properties: data.payload.properties,
                })
              }).pipe(
                Effect.withSpan("sse.emit", {
                  attributes: { "payload.type": data.payload.type }
                })
              )
            } else {
              yield* Effect.logDebug("Skipping event without payload")
            }
          }).pipe(
            Effect.withSpan("sse.process_event", {
              attributes: { port, "connection.url": url }
            })
          )
        )
      },
    })
    
    // ... fetch and stream ...
  })
}
```

### Cursor-Based Pagination Trace

**BEFORE:**
```typescript
// event-source.ts:137-182 - Silent polling
const poll = async () => {
  try {
    const result = await client.execute({
      sql: "SELECT * FROM events WHERE sequence > ? ORDER BY sequence",
      args: [lastSequence],
    })
    
    for (const row of result.rows) {
      const dbEvent = row as unknown as SwarmDbEvent
      // ... parse and emit ...
      lastSequence = dbEvent.sequence
    }
  } catch (error) {
    emit.fail(new Error(`SwarmDb poll failed: ${error}`))
  }
}
```

**AFTER:**
```typescript
const poll = async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      // Stage 1: Query database
      const result = yield* Effect.tryPromise({
        try: () => client.execute({
          sql: "SELECT * FROM events WHERE sequence > ? ORDER BY sequence",
          args: [lastSequence],
        }),
        catch: (e) => new Error(`DB query failed: ${e}`)
      }).pipe(
        Effect.withSpan("swarm_db.query", {
          attributes: {
            "db.path": dbPath,
            "cursor.sequence": lastSequence,
            "db.operation": "SELECT"
          }
        })
      )
      
      yield* Effect.logDebug("SwarmDb query complete").pipe(
        Effect.annotateLogs({ rowCount: result.rows.length })
      )
      
      // Stage 2: Parse and emit events
      for (const row of result.rows) {
        const dbEvent = row as unknown as SwarmDbEvent
        
        yield* Effect.gen(function* () {
          // Parse JSON
          const parsedData = yield* Effect.try({
            try: () => JSON.parse(dbEvent.data),
            catch: () => dbEvent.data // Fallback to raw string
          }).pipe(
            Effect.withSpan("swarm_db.parse_json", {
              attributes: { "event.type": dbEvent.type, "event.sequence": dbEvent.sequence }
            })
          )
          
          // Emit event
          yield* Effect.sync(() => {
            emit.single({
              source: "swarm-db",
              type: dbEvent.type,
              data: parsedData,
              timestamp: dbEvent.timestamp,
              sequence: dbEvent.sequence,
            })
          })
          
          lastSequence = dbEvent.sequence
        }).pipe(
          Effect.withSpan("swarm_db.process_event", {
            attributes: { "event.type": dbEvent.type }
          })
        )
      }
    }).pipe(
      Effect.withSpan("swarm_db.poll", {
        attributes: { "poll.interval_ms": pollIntervalMs }
      }),
      Effect.catchAll(err => 
        Effect.sync(() => emit.fail(err))
      )
    )
  )
}
```

### Trace Hierarchy Example

```
world_stream.bootstrap [200ms]
├─ discovery.discover_servers [150ms]
│  ├─ discovery.lsof [50ms]
│  ├─ discovery.verify_server [80ms] (port 1999)
│  │  └─ http.fetch [75ms] (/project/current)
│  └─ discovery.verify_server [15ms] (port 2000 - failed)
└─ sse.connect [50ms]
   └─ sse.initial_fetch [45ms]
      ├─ http.fetch [30ms] (/session)
      └─ http.fetch [10ms] (/session/status)

sse.process_event [2ms] (session.created)
├─ sse.parse [0.5ms]
├─ sse.emit [0.2ms]
└─ world_store.upsert [1ms]
   ├─ binary_search [0.3ms]
   └─ derive_world_state [0.5ms]
      ├─ build_parts_index [0.2ms]
      └─ enrich_sessions [0.3ms]
```

**Span Attributes to Track:**
- `port`, `connection.url` - SSE connection identity
- `event.type`, `event.id` - Event metadata
- `db.operation`, `db.path` - Database queries
- `cursor.sequence`, `cursor.offset` - Pagination state
- `session_count`, `message_count` - Data volumes

---

## 4. Metrics Opportunities

### Gauges (Current State)

#### Active SSE Connections
```typescript
const sseConnectionsGauge = Metric.gauge("sse_connections_active", {
  description: "Number of active SSE connections"
})

// In WorldSSE.connectToServer()
yield* Metric.increment(sseConnectionsGauge.pipe(
  Metric.tagged("port", String(port))
))

// In WorldSSE.disconnectFromServer()
yield* Metric.decrement(sseConnectionsGauge.pipe(
  Metric.tagged("port", String(port))
))
```

#### Pending Events Queue
```typescript
const pendingEventsGauge = Metric.gauge("world_stream_pending_events", {
  description: "Number of events waiting in async iterator queue"
})

// In stream.ts asyncIterator()
yield* Metric.set(pendingEventsGauge, queue.length)
```

#### Session Counts
```typescript
const sessionCountGauge = Metric.gauge("world_sessions_total", {
  description: "Total number of sessions in world state"
})

const activeSessionsGauge = Metric.gauge("world_sessions_active", {
  description: "Number of active (running) sessions"
})

// In deriveWorldState()
yield* Metric.set(sessionCountGauge, enrichedSessions.length)
yield* Metric.set(activeSessionsGauge, activeSessionCount)
```

### Counters (Events)

#### SSE Events Processed
```typescript
const sseEventsCounter = Metric.counter("sse_events_total", {
  description: "Total SSE events received and processed"
})

// In connectToSSE() parser.onEvent
yield* Metric.increment(sseEventsCounter.pipe(
  Metric.tagged("event_type", data.payload.type),
  Metric.tagged("port", String(port))
))
```

#### Reconnection Attempts
```typescript
const reconnectCounter = Metric.counter("sse_reconnections_total", {
  description: "Total SSE reconnection attempts"
})

// In WorldSSE.connectToServer() retry logic
yield* Metric.increment(reconnectCounter.pipe(
  Metric.tagged("port", String(port)),
  Metric.tagged("attempt", String(attempts))
))
```

#### Binary Search Operations
```typescript
const binarySearchCounter = Metric.counter("world_store_binary_searches_total", {
  description: "Total binary search operations in WorldStore"
})

// In WorldStore.binarySearch()
Effect.runFork(
  Metric.increment(binarySearchCounter.pipe(
    Metric.tagged("array_type", "sessions"), // or "messages", "parts"
    Metric.tagged("result", index >= 0 ? "found" : "not_found")
  ))
)
```

#### SwarmDb Poll Cycles
```typescript
const swarmDbPollCounter = Metric.counter("swarm_db_polls_total", {
  description: "Total SwarmDb polling cycles"
})

const swarmDbEventsCounter = Metric.counter("swarm_db_events_total", {
  description: "Total events fetched from SwarmDb"
})

// In event-source.ts poll()
yield* Metric.increment(swarmDbPollCounter)
yield* Metric.increment(swarmDbEventsCounter, result.rows.length)
```

### Histograms (Latency & Distribution)

#### Event Processing Latency
```typescript
const eventProcessingDuration = Metric.histogram(
  "sse_event_processing_seconds",
  {
    description: "Time to process SSE event (parse + upsert + derive)",
    boundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
  }
)

// In processEvent()
const startTime = performance.now()
// ... processing ...
const duration = (performance.now() - startTime) / 1000
yield* Metric.update(eventProcessingDuration.pipe(
  Metric.tagged("event_type", type)
), duration)
```

#### Derivation Latency
```typescript
const derivationDuration = Metric.histogram(
  "world_state_derivation_seconds",
  {
    description: "Time to derive enriched world state",
    boundaries: [0.001, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
  }
)

// In deriveWorldState()
const startTime = performance.now()
// ... derivation logic ...
const duration = (performance.now() - startTime) / 1000
yield* Metric.update(derivationDuration.pipe(
  Metric.tagged("session_count_bucket", sessionCountBucket(sessions.length))
), duration)

function sessionCountBucket(count: number): string {
  if (count < 10) return "0-10"
  if (count < 50) return "10-50"
  if (count < 100) return "50-100"
  return "100+"
}
```

#### Database Query Latency
```typescript
const dbQueryDuration = Metric.histogram(
  "cursor_store_query_seconds",
  {
    description: "libSQL query latency",
    boundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
  }
)

// In cursor-store.ts saveCursor/loadCursor
yield* Effect.tryPromise({
  try: async () => {
    const start = performance.now()
    const result = await client.execute(...)
    const duration = (performance.now() - start) / 1000
    await Effect.runPromise(
      Metric.update(dbQueryDuration.pipe(
        Metric.tagged("operation", "SELECT"),
        Metric.tagged("table", "cursors")
      ), duration)
    )
    return result
  },
  catch: (e) => new Error(`DB query failed: ${e}`)
})
```

#### Discovery Latency
```typescript
const discoveryDuration = Metric.histogram(
  "server_discovery_seconds",
  {
    description: "Time to discover and verify OpenCode servers",
    boundaries: [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
  }
)

// In discoverServers()
const startTime = performance.now()
// ... discovery logic ...
const duration = (performance.now() - startTime) / 1000
yield* Metric.update(discoveryDuration.pipe(
  Metric.tagged("server_count", String(servers.length))
), duration)
```

---

## 5. Effect.fn Instrumentation

### Automated Instrumentation via Effect.fn

**Pattern**: Wrap pure functions with `Effect.fn` to automatically trace calls without modifying business logic.

#### Binary Search Instrumentation

**BEFORE:**
```typescript
// atoms.ts:153-174 - Pure function, no instrumentation
private binarySearch(array: Array<{ id: string }>, id: string): number {
  let left = 0
  let right = array.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const midId = array[mid].id

    if (midId === id) return mid
    if (midId < id) left = mid + 1
    else right = mid - 1
  }

  return -(left + 1)
}
```

**AFTER:**
```typescript
// Create instrumented version
private readonly binarySearchInstrumented = Effect.fn("binarySearch")(
  (array: Array<{ id: string }>, id: string): number => {
    let left = 0
    let right = array.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midId = array[mid].id

      if (midId === id) return mid
      if (midId < id) left = mid + 1
      else right = mid - 1
    }

    return -(left + 1)
  }
).pipe(
  Effect.withSpan("binary_search", {
    attributes: { "array.length": array.length }
  }),
  Effect.tap(result => 
    Metric.increment(binarySearchCounter.pipe(
      Metric.tagged("result", result >= 0 ? "found" : "not_found")
    ))
  )
)

// Use in upsert methods
upsertSession(session: Session): void {
  const indexEffect = this.binarySearchInstrumented(this.data.sessions, session.id)
  const index = Effect.runSync(indexEffect)
  // ... rest of upsert logic ...
}
```

#### State Derivation Instrumentation

**BEFORE:**
```typescript
// atoms.ts:197-294 - Complex derivation, no instrumentation
private deriveWorldState(data: WorldStateData): WorldState {
  // 100 lines of enrichment logic
}
```

**AFTER:**
```typescript
private readonly deriveWorldStateInstrumented = Effect.fn("deriveWorldState")(
  (data: WorldStateData): WorldState => {
    // Same 100 lines, untouched
    // Business logic stays pure
  }
).pipe(
  Effect.withSpan("derive_world_state", {
    attributes: {
      "sessions.count": data.sessions.length,
      "messages.count": data.messages.length,
      "parts.count": data.parts.length
    }
  }),
  Effect.tap(() => 
    Metric.increment(derivationCounter)
  ),
  Effect.tap(result => 
    Effect.all([
      Metric.set(sessionCountGauge, result.sessions.length),
      Metric.set(activeSessionsGauge, result.activeSessionCount)
    ])
  )
)

getState(): WorldState {
  const derivationEffect = this.deriveWorldStateInstrumented(this.data)
  return Effect.runSync(derivationEffect)
}
```

### Advantages of Effect.fn

1. **Separation of concerns** - Business logic untouched, observability layered on top
2. **Type-safe** - Full type inference preserved
3. **Composable** - Stack instrumentation layers (span + metrics + logs)
4. **Testable** - Test business logic separately from instrumentation

---

## 6. OpenTelemetry Integration

### Export Effect Spans to OTel

**Goal**: Visualize end-to-end SSE event flow in Jaeger/Zipkin/Honeycomb.

#### Step 1: Initialize OTel Tracer Provider

```typescript
// packages/core/src/world/otel.ts

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"

/**
 * Initialize OpenTelemetry tracer for Effect-TS spans
 */
export function initOTelTracer(config: {
  serviceName: string
  endpoint?: string // Default: http://localhost:4318/v1/traces
}) {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0"
    })
  })

  const exporter = new OTLPTraceExporter({
    url: config.endpoint || "http://localhost:4318/v1/traces"
  })

  provider.addSpanProcessor(new BatchSpanProcessor(exporter))
  provider.register()

  return provider
}
```

#### Step 2: Bridge Effect Spans to OTel

```typescript
// packages/core/src/world/effect-otel-bridge.ts

import { trace, SpanStatusCode } from "@opentelemetry/api"
import { Effect } from "effect"

/**
 * Wrap Effect with OpenTelemetry span export
 */
export function withOtelSpan<A, E, R>(
  spanName: string,
  effect: Effect.Effect<A, E, R>,
  attributes?: Record<string, string | number>
): Effect.Effect<A, E, R> {
  return Effect.gen(function* () {
    const tracer = trace.getTracer("opencode-world")
    const otelSpan = tracer.startSpan(spanName, {
      attributes: attributes || {}
    })

    try {
      const result = yield* effect
      otelSpan.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      otelSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err)
      })
      throw err
    } finally {
      otelSpan.end()
    }
  })
}
```

#### Step 3: Use in SSE Pipeline

```typescript
// sse.ts - Modified to export OTel spans

export function connectToSSE(port: number): Stream.Stream<SSEEvent, Error> {
  return Stream.async<SSEEvent, Error>((emit) => {
    parser = createParser({
      onEvent: (event) => {
        Effect.runFork(
          withOtelSpan(
            "sse.process_event",
            Effect.gen(function* () {
              // Parse JSON
              const data = yield* withOtelSpan(
                "sse.parse_json",
                Effect.try({
                  try: () => JSON.parse(event.data),
                  catch: (e) => new Error(`Parse failed: ${e}`)
                }),
                { "event.id": event.id }
              )
              
              // Emit event
              yield* withOtelSpan(
                "sse.emit",
                Effect.sync(() => emit.single(data.payload)),
                { "payload.type": data.payload.type }
              )
            }),
            { port: String(port), "connection.url": url }
          )
        )
      }
    })
  })
}
```

#### Step 4: Initialize in Application

```typescript
// apps/web/src/app/layout.tsx or apps/swarm-cli/src/main.ts

import { initOTelTracer } from "@opencode-vibe/core/world/otel"

// Initialize before creating world stream
initOTelTracer({
  serviceName: "opencode-web", // or "opencode-cli"
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
})

const stream = createWorldStream({ baseUrl: "http://localhost:1999" })
```

### Distributed Tracing Across Services

**Trace Propagation**: Inject trace context into HTTP requests

```typescript
// sse.ts:426-455 - Bootstrap HTTP requests

import { context, propagation, trace } from "@opentelemetry/api"

private bootstrapFromServer(port: number): Effect.Effect<void, Error> {
  return Effect.gen(this, function* () {
    const baseUrl = `http://127.0.0.1:${port}`
    
    // Get current trace context
    const activeContext = context.active()
    const carrier: Record<string, string> = {}
    propagation.inject(activeContext, carrier)
    
    // Fetch with trace headers
    const [sessionsRes, statusRes] = yield* Effect.all([
      Effect.tryPromise({
        try: () => fetch(`${baseUrl}/session`, {
          headers: carrier // Propagate trace context
        }).then((r) => r.json()),
        catch: (e) => new Error(`Failed to fetch sessions: ${e}`)
      }),
      // ... similar for status ...
    ])
    
    // ... rest of bootstrap ...
  })
}
```

**Result**: End-to-end traces from Next.js → Core → Backend → Effect services

---

## 7. Dashboard Design

### Grafana Dashboard Layout

**Dashboard Name**: OpenCode World Stream

**Refresh**: 10s auto-refresh

#### Row 1: System Health (Quick Check)

**Panel 1: Availability (SLO)**
- **Query**: `avg_over_time(up{job="opencode-world"}[5m])`
- **Threshold**: Green >99.9%, Yellow >99%, Red <99%
- **Type**: Stat (percentage)

**Panel 2: Error Rate**
- **Query**: 
  ```promql
  sum(rate(sse_events_total{result="error"}[5m]))
  /
  sum(rate(sse_events_total[5m]))
  ```
- **Threshold**: Green <0.01, Yellow <0.05, Red >0.05
- **Type**: Stat (percentage)

**Panel 3: P99 Event Latency**
- **Query**: 
  ```promql
  histogram_quantile(0.99,
    sum(rate(sse_event_processing_seconds_bucket[5m])) by (le)
  )
  ```
- **Threshold**: Green <0.1s, Yellow <0.5s, Red >1s
- **Type**: Stat (seconds)

**Panel 4: Active Connections**
- **Query**: `sum(sse_connections_active)`
- **Type**: Stat (count)

#### Row 2: Traffic Patterns

**Panel 5: Event Throughput by Type**
- **Query**: `sum(rate(sse_events_total[1m])) by (event_type)`
- **Type**: Graph (time series)
- **Legend**: Top 10 event types

**Panel 6: Connection Lifecycle**
- **Query**: 
  ```promql
  sum(rate(sse_reconnections_total[5m])) by (port)
  ```
- **Type**: Graph (time series)
- **Shows**: Reconnection spikes, connection stability

**Panel 7: Event Distribution (Pie)**
- **Query**: `sum(increase(sse_events_total[1h])) by (event_type)`
- **Type**: Pie chart
- **Shows**: Proportions of session/message/part events

#### Row 3: Performance

**Panel 8: Derivation Latency (Heatmap)**
- **Query**: 
  ```promql
  sum(rate(world_state_derivation_seconds_bucket[5m])) by (le, session_count_bucket)
  ```
- **Type**: Heatmap
- **Shows**: Latency correlation with session count

**Panel 9: Database Query Latency**
- **Query**: 
  ```promql
  histogram_quantile(0.95,
    sum(rate(cursor_store_query_seconds_bucket[5m])) by (le, operation)
  )
  ```
- **Type**: Graph (P50/P95/P99)
- **Legend**: save, load, delete operations

**Panel 10: Binary Search Operations**
- **Query**: `sum(rate(world_store_binary_searches_total[5m])) by (array_type, result)`
- **Type**: Stacked bar graph
- **Shows**: found vs not_found ratio by array type

#### Row 4: Resource Usage

**Panel 11: Session Counts**
- **Queries**:
  - Total: `world_sessions_total`
  - Active: `world_sessions_active`
  - Streaming: `world_sessions_streaming`
- **Type**: Graph (multi-line)

**Panel 12: Pending Events Queue**
- **Query**: `world_stream_pending_events`
- **Type**: Graph
- **Threshold**: Alert if >100 (backpressure)

**Panel 13: SwarmDb Poll Efficiency**
- **Query**: 
  ```promql
  sum(rate(swarm_db_events_total[5m]))
  /
  sum(rate(swarm_db_polls_total[5m]))
  ```
- **Type**: Graph
- **Label**: "Events per poll"
- **Shows**: Batch efficiency

#### Row 5: Errors & Anomalies

**Panel 14: Error Rate by Type**
- **Query**: `sum(rate(sse_events_total{result="error"}[5m])) by (event_type)`
- **Type**: Graph (stacked area)

**Panel 15: Discovery Failures**
- **Query**: `rate(server_discovery_failures_total[5m])`
- **Type**: Stat
- **Threshold**: Alert if >0.1/s

**Panel 16: Recent Logs (Errors Only)**
- **Query**: Loki query for `{job="opencode-world"} |= "ERROR"`
- **Type**: Logs panel
- **Shows**: Last 50 error logs

---

## 8. Alerting Recommendations

### SLO-Based Alerts (Prevent Alert Fatigue)

#### Alert 1: High Error Rate

```yaml
alert: WorldStreamHighErrorRate
expr: |
  sum(rate(sse_events_total{result="error"}[5m]))
  /
  sum(rate(sse_events_total[5m]))
  > 0.01
for: 5m
severity: critical
annotations:
  summary: "World Stream error rate above 1%"
  description: "Error rate is {{ $value | humanizePercentage }} over last 5m"
  runbook: "https://docs.opencode.dev/runbooks/world-stream-errors"
```

#### Alert 2: High Latency (P99)

```yaml
alert: WorldStreamHighLatency
expr: |
  histogram_quantile(0.99,
    sum(rate(sse_event_processing_seconds_bucket[5m])) by (le)
  ) > 2
for: 10m
severity: warning
annotations:
  summary: "World Stream P99 latency above 2s"
  description: "P99 latency is {{ $value }}s"
  runbook: "https://docs.opencode.dev/runbooks/world-stream-latency"
```

#### Alert 3: Connection Failures

```yaml
alert: WorldStreamNoConnections
expr: sum(sse_connections_active) == 0
for: 2m
severity: critical
annotations:
  summary: "No active SSE connections"
  description: "All SSE connections lost. Discovery may have failed."
  runbook: "https://docs.opencode.dev/runbooks/sse-discovery"
```

#### Alert 4: Backpressure (Queue Buildup)

```yaml
alert: WorldStreamBackpressure
expr: world_stream_pending_events > 100
for: 5m
severity: warning
annotations:
  summary: "World Stream event queue backing up"
  description: "{{ $value }} events pending. Consumers may be slow."
```

#### Alert 5: Discovery Failures

```yaml
alert: WorldStreamDiscoveryFailing
expr: rate(server_discovery_failures_total[5m]) > 0.1
for: 5m
severity: warning
annotations:
  summary: "Server discovery failing repeatedly"
  description: "Discovery failing {{ $value }}/s. lsof may be broken."
```

### Alertmanager Configuration

```yaml
route:
  receiver: 'team-slack'
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    # Page on critical
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    
    # Slack for all
    - receiver: 'team-slack'

receivers:
  - name: 'team-slack'
    slack_configs:
      - channel: '#opencode-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
  
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_KEY>'
```

---

## 9. Recommendations

### Phase 1: Foundation (Week 1)

**Goal**: Add basic logging and metrics without changing business logic

1. **Add Effect.tap logging to SSE pipeline** (`sse.ts`)
   - Connection lifecycle (start, stop, reconnect)
   - Discovery results
   - Event counts per type
   
2. **Add basic metrics** (`atoms.ts`, `sse.ts`)
   - Gauges: `sse_connections_active`, `world_sessions_total`
   - Counters: `sse_events_total`, `sse_reconnections_total`
   
3. **Add structured logging with annotateLogs** (all files)
   - Session IDs, event types, ports in context
   - Log levels: Debug (discovery), Info (connections), Warning (errors)

**Estimated Effort**: 2-3 days  
**Risk**: Low - additive changes only

### Phase 2: Tracing (Week 2)

**Goal**: Add Effect.withSpan to pipeline stages

1. **Trace SSE event processing end-to-end**
   - Spans: connect → parse → extract → route → upsert → derive → emit
   - Attributes: port, event_type, session_id
   
2. **Trace database operations** (`cursor-store.ts`, `event-source.ts`)
   - Spans: query, save, load, delete
   - Attributes: db.operation, table, cursor.sequence
   
3. **Trace discovery and verification** (`sse.ts`)
   - Spans: lsof, verify_server, bootstrap
   - Attributes: port, candidate_count, server_count

**Estimated Effort**: 3-4 days  
**Risk**: Low - composition-based, no business logic changes

### Phase 3: Advanced Metrics (Week 3)

**Goal**: Add histograms for latency and distribution tracking

1. **Event processing latency histogram**
   - Track parse → derive → emit pipeline
   - Buckets: 1ms to 1s
   
2. **Derivation latency by session count**
   - Identify O(n²) hot paths
   - Optimize enrichment logic if needed
   
3. **Database query latency**
   - Track save/load/delete operations
   - Alert on P99 >100ms

**Estimated Effort**: 2-3 days  
**Risk**: Medium - requires performance testing

### Phase 4: OpenTelemetry Integration (Week 4)

**Goal**: Export traces to external observability platform

1. **Initialize OTel tracer provider**
   - Create `otel.ts` with tracer setup
   - Add environment config for endpoint
   
2. **Bridge Effect spans to OTel**
   - Create `withOtelSpan` wrapper
   - Replace Effect.withSpan with hybrid approach
   
3. **Propagate trace context across services**
   - Inject W3C trace context headers
   - Enable end-to-end tracing

**Estimated Effort**: 4-5 days  
**Risk**: Medium - requires external observability stack (Jaeger/Honeycomb)

### Phase 5: Dashboards & Alerting (Week 5)

**Goal**: Operationalize observability

1. **Create Grafana dashboard** (see section 7)
   - 16 panels across 5 rows
   - Auto-refresh every 10s
   
2. **Configure Prometheus /metrics endpoint**
   - Export Effect metrics to Prometheus format
   - Add to Prometheus scrape config
   
3. **Set up SLO-based alerts** (see section 8)
   - 5 critical alerts
   - Slack + PagerDuty integration

**Estimated Effort**: 3-4 days  
**Risk**: Low - infrastructure setup, no code changes

---

## 10. Risk/Effort Estimate

### Overall Migration Complexity

| Phase | Effort (Days) | Risk Level | Blocking Dependencies |
|-------|--------------|------------|----------------------|
| Phase 1: Foundation | 2-3 | Low | None |
| Phase 2: Tracing | 3-4 | Low | Phase 1 complete |
| Phase 3: Advanced Metrics | 2-3 | Medium | Phase 1 complete |
| Phase 4: OTel Integration | 4-5 | Medium | External observability stack |
| Phase 5: Dashboards | 3-4 | Low | Prometheus + Grafana running |
| **TOTAL** | **14-19** | **Medium** | **~3 weeks** |

### Risks & Mitigations

#### Risk 1: Performance Overhead

**Concern**: Observability instrumentation adds latency to hot paths (binary search, derivation)

**Mitigation**:
- Use `Effect.logDebug` (disabled in prod by default)
- Sample high-frequency events (10% sampling for parse/emit spans)
- Profile before/after with benchmarks
- Add `Effect.fn` instrumentation incrementally, measure impact

#### Risk 2: Breaking Effect Composition

**Concern**: Adding observability breaks existing Effect pipelines

**Mitigation**:
- Use `Effect.tap` (doesn't change value flow)
- Layer instrumentation via `pipe()` (composable)
- Test instrumented vs uninstrumented paths
- Keep business logic pure, wrap at boundaries

#### Risk 3: Context Explosion

**Concern**: Too much context logging blows up log volume

**Mitigation**:
- Use `Effect.annotateLogs` sparingly (session ID, event type only)
- Avoid logging full payloads (truncate to 100 chars)
- Use sampling for high-frequency events
- Configure log levels per environment (Debug in dev, Info in prod)

#### Risk 4: External Dependencies

**Concern**: OTel/Prometheus/Grafana stack required for Phase 4-5

**Mitigation**:
- Phase 1-3 work standalone (Effect-TS built-in observability)
- Use Docker Compose for local stack setup
- Document infrastructure requirements
- Provide Grafana dashboard JSON for import

### Testing Strategy

**Unit Tests**:
- Test instrumented functions preserve original behavior
- Verify metrics are incremented correctly
- Check log output contains expected context

**Integration Tests**:
- Verify spans nest correctly in traces
- Check OTel exporter sends spans to collector
- Validate Prometheus scrape endpoint format

**Load Tests**:
- Measure overhead with/without instrumentation
- Test high event throughput (1000 events/sec)
- Verify no memory leaks from metric registries

**Visual Tests**:
- Verify Grafana dashboard renders correctly
- Check alert firing/recovery cycle
- Validate trace visualization in Jaeger

---

## Appendix: Code Examples Summary

### Quick Reference - Before/After Patterns

#### 1. Effect.tap for Pipeline Inspection

```typescript
// BEFORE: Silent event processing
const data = JSON.parse(event.data)
emit.single(data.payload)

// AFTER: Traced with tap
yield* Effect.try(() => JSON.parse(event.data)).pipe(
  Effect.tap(data => Effect.logDebug("Parsed SSE event").pipe(
    Effect.annotateLogs({ eventType: data.payload.type })
  ))
)
```

#### 2. Effect.annotateLogs for Context

```typescript
// BEFORE: No context
Effect.log("Server discovered")

// AFTER: Structured context
Effect.log("Server discovered").pipe(
  Effect.annotateLogs({ port: 1999, directory: "/path" })
)
```

#### 3. Effect.withSpan for Tracing

```typescript
// BEFORE: Silent database query
const result = await client.execute({ sql, args })

// AFTER: Traced query
const result = yield* Effect.tryPromise({
  try: () => client.execute({ sql, args }),
  catch: (e) => new Error(`Query failed: ${e}`)
}).pipe(
  Effect.withSpan("db.query", {
    attributes: { "db.operation": "SELECT", "db.table": "cursors" }
  })
)
```

#### 4. Metric.counter for Events

```typescript
// BEFORE: Silent event processing
emit.single(event)

// AFTER: Counted event
yield* Metric.increment(sseEventsCounter.pipe(
  Metric.tagged("event_type", event.type)
))
emit.single(event)
```

#### 5. Metric.histogram for Latency

```typescript
// BEFORE: Silent derivation
const worldState = deriveWorldState(data)

// AFTER: Timed derivation
const startTime = performance.now()
const worldState = deriveWorldState(data)
const duration = (performance.now() - startTime) / 1000
yield* Metric.update(derivationDuration, duration)
```

#### 6. Effect.fn for Automated Instrumentation

```typescript
// BEFORE: Pure function, no tracing
function binarySearch(array, id) { /* ... */ }

// AFTER: Instrumented with Effect.fn
const binarySearchInstrumented = Effect.fn("binarySearch")(binarySearch).pipe(
  Effect.withSpan("binary_search"),
  Effect.tap(() => Metric.increment(searchCounter))
)
```

---

## Conclusion

The `core/world` layer is **begging for observability instrumentation**. It's a complex reactive streaming system handling real-time SSE events, multi-server connections, state derivation, and durable cursor-based pagination.

**WITHOUT observability:**
- Debugging production issues is impossible
- Performance regressions go unnoticed
- No visibility into event throughput, latency, or errors
- Can't diagnose discovery failures, reconnection storms, or backpressure

**WITH observability (5-phase plan):**
- **Logs**: Structured context for debugging (session IDs, event types, ports)
- **Traces**: End-to-end visibility into SSE pipeline (connect → parse → derive → emit)
- **Metrics**: Real-time gauges/counters/histograms for monitoring
- **Dashboards**: Grafana dashboards for at-a-glance health
- **Alerts**: SLO-based alerts prevent outages before they happen

**Recommended Next Steps:**

1. **START WITH PHASE 1** - Add basic logging and metrics (2-3 days)
2. **Validate with production load** - Ensure no performance regression
3. **Proceed to Phase 2** - Add tracing for end-to-end visibility
4. **Set up external stack** - Prometheus + Grafana + Jaeger
5. **Complete Phases 4-5** - OTel integration + dashboards

**This is THE most important audit** because observability is the foundation for debugging, monitoring, and operating a distributed system. Without it, we're flying blind.
