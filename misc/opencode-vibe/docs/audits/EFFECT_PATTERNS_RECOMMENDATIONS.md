# Effect Patterns Migration - Final Recommendations

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ███████╗███████╗███████╗███████╗ ██████╗████████╗    ████████╗███████╗ ║
║   ██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝╚══██╔══╝    ╚══██╔══╝██╔════╝ ║
║   █████╗  █████╗  █████╗  █████╗  ██║        ██║          ██║   ███████╗ ║
║   ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║        ██║          ██║   ╚════██║ ║
║   ███████╗██║     ██║     ███████╗╚██████╗   ██║          ██║   ███████║ ║
║   ╚══════╝╚═╝     ╚═╝     ╚══════╝ ╚═════╝   ╚═╝          ╚═╝   ╚══════╝ ║
║                                                                           ║
║            Final Migration Roadmap - Four Audits Synthesized             ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Date:** 2026-01-02  
**Synthesizer:** CoolWind  
**Cell:** opencode-next--xts0a-mjx3stf7zj9  
**Epic:** opencode-next--xts0a-mjx3stek3wg  
**Source Audits:**
- State Management Audit (QuickHawk) - 684 lines
- Event/Stream Layer Audit (SilverOcean) - 1622 lines
- Runtime/Lifecycle Audit (CalmHawk) - 1423 lines
- O11y Audit (SilverDawn) - 1598 lines

---

## Implementation Status (Updated 2026-01-02)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                        IMPLEMENTATION PROGRESS                            ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Phase 1: O11y Foundation                              ██████████ 100%   ║
║  Phase 2: Advanced O11y + Safety                       ██████████ 100%   ║
║  Phase 2.5: QoL Improvements                           ██████████ 100%   ║
║  Phase 3: Production Stack                             ░░░░░░░░░░   0%   ║
║  Quick Wins                                            ██████████ 100%   ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Completed Work

| Item | Status | Notes |
|------|--------|-------|
| **Quick Win 1: Schedule for Retry** | ✅ DONE | `Schedule.exponential` + `Schedule.jittered` in sse.ts:60-65 |
| **Quick Win 2: Delete sse-bridge.ts** | ✅ DONE | File deleted, -131 LOC |
| **Quick Win 3: Basic Logging** | ✅ DONE | Effect.logDebug/logInfo/logWarning throughout |
| **Quick Win 4: Unify Stream Files** | ✅ DONE | stream.ts delegates to merged-stream.ts (49 LOC) |
| **Quick Win 5: Basic Metrics** | ✅ DONE | metrics.ts with gauges, counters, histograms |
| **Phase 1: Logging** | ✅ DONE | Effect.annotateLogs with context in all files |
| **Phase 1: Basic Metrics** | ✅ DONE | WorldMetrics namespace with 9 metrics |
| **Phase 2: Tracing (withSpan)** | ✅ DONE | sse.process_event → sse.parse → sse.transform → sse.emit |
| **Phase 2: Histograms** | ✅ DONE | eventProcessingSeconds, swarmDbPollSeconds, cursorQuerySeconds |
| **Phase 2: acquireRelease for SSE** | ✅ DONE | sse.ts:214 uses Effect.acquireRelease |
| **Phase 2: PubSub for n+1 subscribers** | ✅ DONE | pubsub.ts with bounded(32) backpressure |
| **P2: SSEService Extraction** | ✅ DONE | Effect.Service + Layer.scoped pattern (cursor-store.ts style) |
| **P2: Scope-based Fiber Management** | ✅ DONE | WorldSSE.scope field, auto-cleanup on stop() |
| **P2: Schedule.repeat for Discovery** | ✅ DONE | Replaced while+sleep with Schedule.fixed in discovery loop |
| **P2: Stream.asyncScoped (merged-stream)** | ✅ DONE | acquireRelease for async iterator lifecycle |

### Remaining Work

| Item | Status | Priority | Effort |
|------|--------|----------|--------|
| **Phase 3: OTel Integration** | ❌ TODO | P3 | 4-5 days |
| **Phase 3: Grafana Dashboards** | ❌ TODO | P3 | 3-4 days |
| **Phase 3: Alerting** | ❌ TODO | P3 | 2-3 days |
| **WorldStoreService Extraction** | ❌ TODO | P3 | 4 hours |
| **Unify Atom Definitions** | ❌ TODO | P3 | 2 hours |

---

## Executive Summary

**CRITICAL FINDING: This is fundamentally an observability project.**

Analyzed 1,900+ LOC across 13 files in `packages/core/src/world/`. The codebase demonstrates **partial Effect adoption** with excellent foundations but critical gaps. The most severe gap is **zero observability instrumentation** across a production-grade distributed streaming system.

### Key Findings Across All Audits

**✅ WHAT'S WORKING:**
- Current state management architecture is SOUND (effect-atom + Effect services)
- Strong Effect foundations: Effect.gen, Effect.tryPromise, Stream.async
- Excellent acquireRelease example (CursorStore)
- Fiber-based connection management

**❌ CRITICAL GAPS:**
1. **ZERO observability** - No logging, tracing, or metrics (HIGHEST PRIORITY)
2. **Manual resource tracking** - SSE connections lack acquireRelease
3. **Manual retry logic** - Exponential backoff without Schedule
4. **Legacy patterns** - setInterval instead of Schedule, while loops instead of Effect.repeat

**📊 IMPACT ASSESSMENT:**

| Pattern Area | Current State | Risk Level | Business Impact |
|--------------|---------------|------------|----------------|
| **Observability** | ZERO instrumentation | CRITICAL | Can't debug production, blind operations |
| **Resource Safety** | Manual SSE cleanup | HIGH | Connection leaks, no interruption guarantees |
| **Retry Logic** | Manual backoff | MEDIUM | Thundering herd, no jitter, retries all errors |
| **State Management** | SOUND (atoms + services) | LOW | No changes needed |
| **Event Broadcasting** | Direct mutation | LOW | Works for single subscriber |

**Total Migration Effort:** 21-31 days across 3 phases (prioritized by impact)

---

## 1. Pattern-by-Pattern Analysis

### 1.1 Observability (ZERO → PRODUCTION-READY)

**Current State:** 1,900+ LOC reactive SSE streaming system with NO Effect-TS observability.

**What's Missing:**
- ❌ No `Effect.tap` for pipeline inspection
- ❌ No `Effect.log*` for structured logging
- ❌ No `Effect.annotateLogs` for context tracking
- ❌ No `Effect.withSpan` for tracing
- ❌ No `Metric.*` for counters/gauges/histograms
- ❌ No `Effect.fn` instrumentation wrappers

**Business Impact:**
- **Can't debug production issues** - No visibility into SSE pipeline stages
- **Can't monitor performance** - No latency tracking for derivation, queries
- **Can't detect anomalies** - No metrics for reconnections, error rates
- **Can't set SLOs** - No data for availability, latency targets

**Affected Files:**
- `sse.ts` (515 LOC) - Connection lifecycle, discovery, event processing
- `atoms.ts` (340 LOC) - State derivation, binary search
- `event-source.ts` (199 LOC) - SwarmDb polling
- `cursor-store.ts` (166 LOC) - Database queries
- ALL files lack instrumentation

**Migration Strategy:** 5-phase approach (14-19 days)
1. **Foundation** (2-3 days) - Basic logging + metrics
2. **Tracing** (3-4 days) - End-to-end spans for SSE pipeline
3. **Advanced Metrics** (2-3 days) - Histograms for latency tracking
4. **OTel Integration** (4-5 days) - Export to external observability stack
5. **Dashboards** (3-4 days) - Grafana + alerts

**Recommendation:** **START HERE.** This is THE most critical gap.

---

### 1.2 Resource Safety (acquireRelease Pattern)

**Current State:** CursorStore uses acquireRelease correctly. SSE connections do NOT.

**What's Working:**
- ✅ CursorStore (DB lifecycle) - Layer.scoped + acquireRelease
- ✅ Cleanup guaranteed on success, failure, interruption

**What's Missing:**
- ❌ SSE connection lifecycle - manual fiber tracking
- ❌ WorldStore subscription cleanup - try/finally instead of acquireRelease
- ❌ Discovery resource cleanup - no timeout abort signal

**Code Evidence (SSE Manual Cleanup):**
```typescript
// CURRENT (sse.ts:260-261, 414-421)
private connectionFibers = new Map<number, Fiber.RuntimeFiber<void, Error>>()

stop(): void {
  for (const [port, fiber] of this.connectionFibers) {
    Effect.runFork(Fiber.interrupt(fiber))  // Manual interrupt
  }
  this.connectionFibers.clear()  // Manual cleanup
}
```

**Should Be:**
```typescript
const makeSSEConnection = (port: number, store: WorldStore) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      yield* bootstrapFromServer(port, store)
      return { port, stream: connectToSSE(port) }
    }),
    ({ port }) => Effect.sync(() => {
      console.log(`Closed SSE connection to port ${port}`)
    })
  )

// Usage
const connectionEffect = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* makeSSEConnection(port, store)
    yield* Stream.runForEach(conn.stream, handleEvent)
  })
)
```

**Benefits:**
- Interruption safety (cleanup guaranteed)
- No manual fiber tracking
- Composable with other Effects

**Migration Effort:** 2 hours per connection type  
**Files Affected:** `sse.ts` (SSE connections), `stream.ts` (async iterator)

**Recommendation:** **HIGH priority** after O11y foundation.

---

### 1.3 Retry/Schedule Pattern

**Current State:** Manual exponential backoff in SSE reconnection logic.

**What's Missing:**
- ❌ Manual backoff: `Math.min(1000 * Math.pow(2, attempts), 30000)`
- ❌ No jitter (thundering herd risk)
- ❌ Retries ALL errors (even non-transient like 404, auth failures)
- ❌ Discovery loop uses `while + sleep` instead of Schedule

**Code Evidence (Manual Retry):**
```typescript
// CURRENT (sse.ts:398-399)
let attempts = 0
while (this.running && attempts < this.config.maxReconnectAttempts) {
  try {
    // ... connection logic ...
    break
  } catch (error) {
    attempts++
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
    yield* Effect.sleep(delay)
  }
}
```

**Should Be:**
```typescript
// Schedule-based retry with jitter
const sseRetrySchedule = Schedule.exponential("1 second")
  .pipe(Schedule.jittered) // ±25% randomness
  .pipe(Schedule.upTo("30 seconds"))
  .pipe(Schedule.recurs(10))
  .pipe(Schedule.whileInput((error: Error) => isTransientError(error)))

const connectionEffect = Effect.retry(connectEffect, sseRetrySchedule)
```

**Benefits:**
- Jitter prevents thundering herd
- Declarative policy (testable, composable)
- Conditional retry (only transient errors)

**Migration Effort:** 1 hour per retry location  
**Files Affected:** `sse.ts` (reconnection), `event-source.ts` (polling)

**Recommendation:** **HIGH priority** - quick win with Schedule.

---

### 1.4 Service Pattern

**Current State:** MessageService and StatusService use Service pattern. SSE connections do NOT.

**What's Working:**
- ✅ MessageService (sync factory) - pure computation
- ✅ StatusService (sync factory) - pure computation
- ✅ CursorStore (scoped factory) - DB lifecycle

**What's Missing:**
- ❌ SSEService - should be scoped factory for connection lifecycle
- ❌ DiscoveryService - could be sync factory (no lifecycle)
- ❌ WorldStoreService - should be scoped factory (atom registry management)

**Benefits of Service Pattern:**
- **Testability** - Mock SSEService in tests
- **Composition** - Add to ApiLayer
- **Dependency Injection** - Automatic provision via Atom.runtime

**Migration Effort:** 2-3 hours per service  
**Files Affected:** `sse.ts` (extract SSEService), `atoms.ts` (extract WorldStoreService)

**Recommendation:** **MEDIUM priority** - quality-of-life improvement.

---

### 1.5 Fiber/Scope Management

**Current State:** WorldSSE uses Fibers correctly (one per connection). Manual tracking in Map.

**What's Working:**
- ✅ Fiber-based connections (one per server)
- ✅ Effect.runFork for launching fibers
- ✅ Fiber.interrupt for cleanup

**What's Missing:**
- ❌ Manual fiber tracking: `Map<number, Fiber.RuntimeFiber>`
- ❌ Manual interrupt calls on stop
- ❌ Discovery loop uses `while + sleep` instead of Schedule.repeat

**Should Use:**
- Scope-based fiber management (auto-cleanup on scope close)
- Schedule.repeat for discovery (declarative vs manual loop)

**Benefits:**
- No manual Map tracking
- Guaranteed cleanup (can't leak fibers)
- Composable with other scoped resources

**Migration Effort:** 2 hours (Scope), 30 mins (Schedule.repeat)  
**Files Affected:** `sse.ts` (discovery loop, connection tracking)

**Recommendation:** **MEDIUM priority** - after SSEService extraction.

---

### 1.6 State Management (SOUND - NO CHANGES)

**Current State:** effect-atom for UI reactive state, Effect services for persistence.

**Architecture:**
- ✅ Atom for UI-bound reactive state (sessions, messages, parts)
- ✅ Derived atoms with automatic dependency tracking
- ✅ Effect services for backend integration
- ✅ Clear separation: Atom for sync UI, Ref for concurrent Effect workflows

**Minor Issue:** Atom duplication (atoms.ts + derived.ts define same atoms)
- **Fix:** Unify on Map-based atoms, convert to arrays in derivation
- **Effort:** 1-2 hours
- **Risk:** Low

**Recommendation:** **KEEP AS-IS.** Only fix atom duplication (low priority).

---

### 1.7 Event Broadcasting (PubSub Pattern)

**Current State:** WorldSSE directly mutates WorldStore. **NEW:** System now has n+1 stream capability with multiple subscribers (React UI + TUI + debug tools + future consumers).

**What's Working:**
- ✅ Simple, direct mutation
- ✅ Multiple subscribers already exist

**What's Missing:**
- ❌ No PubSub pattern (each subscriber needs independent queue)
- ❌ No backpressure for slow subscribers (risk: fast SSE stream overwhelms slow TUI consumer)
- ❌ Subscribers coupled to WorldStore mutations (can't add logger/metrics without modifying store)

**PubSub Benefits:**
- **Each subscriber gets independent queue** - UI renders don't block TUI updates
- **Backpressure via bounded(N)** - prevents slow consumer from causing memory issues
- **Type-safe event distribution** - Schema-validated events
- **Fork subscribers as background Fibers** - auto-cleanup when scope ends
- **Decoupled architecture** - add new subscribers without modifying WorldSSE

**Perfect for:**
- React UI + TUI + debug tools (current reality)
- Future: external consumers (webhooks, analytics, log aggregation)
- Observability: metrics/logging subscribers alongside store

**Recommendation:** **RECOMMEND** - n+1 subscribers are the reality, PubSub is the right abstraction.

---

### 1.8 Stream Patterns (mapEffect, asyncScoped)

**Current State:** Effect.all for parallel bootstrap. No Stream.mapEffect.

**What's Working:**
- ✅ Effect.all for 2 parallel requests (sessions + status)
- ✅ Stream.async for SSE parsing

**Stream.mapEffect Opportunities:**
- IF we wanted concurrent message fetching for all sessions
- IF backend API supported per-session endpoints
- NOT NEEDED with current bulk endpoints

**Stream.asyncScoped Opportunity:**
- Async iterator uses manual queue management
- Could use Stream.asyncScoped + acquireRelease

**Recommendation:** **DEFER** Stream.mapEffect. **MEDIUM priority** for asyncScoped refactor.

---

## 2. Priority Matrix

### Critical Path (COMPLETED ✅)

| Priority | Recommendation | Effort | Risk | Impact | Status |
|----------|----------------|--------|------|--------|--------|
| **P0** | **Observability Phase 1** (logging + basic metrics) | 2-3 days | Low | CRITICAL | ✅ DONE |
| **P0** | **Observability Phase 2** (tracing) | 3-4 days | Low | CRITICAL | ✅ DONE |
| **P1** | **Schedule for retry** (replace manual backoff) | 1 day | Low | High | ✅ DONE |
| **P1** | **acquireRelease for SSE** (connection safety) | 2 days | Low | High | ✅ DONE |
| **P1** | **PubSub for n+1 subscribers** (fan-out + backpressure) | 1 day | Medium | High | ✅ DONE |

### Quality of Life (COMPLETED ✅)

| Priority | Recommendation | Effort | Risk | Impact | Status |
|----------|----------------|--------|------|--------|--------|
| **P2** | **SSEService extraction** | 1 day | Medium | Medium | ✅ DONE |
| **P2** | **Scope-based fiber management** | 2 hours | Low | Medium | ✅ DONE |
| **P2** | **Schedule.repeat for discovery** | 30 mins | Low | Low | ✅ DONE |
| **P2** | **Stream.asyncScoped for async iterator** | 4 hours | Low | Medium | ✅ DONE |

### Future Work (DEFER)

| Priority | Recommendation | Effort | Risk | Impact | Status |
|----------|----------------|--------|------|--------|--------|
| **P3** | **Observability Phase 4** (OTel integration) | 4-5 days | Medium | High | ❌ TODO |
| **P3** | **Observability Phase 5** (dashboards + alerts) | 3-4 days | Low | High | ❌ TODO |
| **P3** | **WorldStoreService extraction** | 4 hours | Medium | Medium | ❌ TODO |
| **P3** | **Unify atom definitions** (atoms.ts + derived.ts) | 2 hours | Low | Low | ❌ TODO |
| ~~P3~~ | ~~Delete sse-bridge.ts~~ | ~~15 mins~~ | ~~Low~~ | ~~Low~~ | ✅ DONE |
| ~~P3~~ | ~~Unify stream.ts and merged-stream.ts~~ | ~~1 hour~~ | ~~Low~~ | ~~Medium~~ | ✅ DONE |
| **P4** | **Stream.mapEffect** (bounded concurrency) | 2 hours | Low | Low | ❌ TODO |

---

## 3. Phased Migration Roadmap

### Phase 1: Observability Foundation (Week 1)

**Goal:** Add basic logging and metrics without changing business logic.

**Tasks:**
1. Add Effect.tap logging to SSE pipeline (`sse.ts`)
   - Connection lifecycle (start, stop, reconnect)
   - Discovery results (server count, verification)
   - Event counts per type

2. Add basic metrics (`atoms.ts`, `sse.ts`)
   - Gauges: `sse_connections_active`, `world_sessions_total`, `world_sessions_active`
   - Counters: `sse_events_total`, `sse_reconnections_total`, `binary_search_total`

3. Add structured logging with annotateLogs (all files)
   - Context: session IDs, event types, ports, directories
   - Log levels: Debug (discovery), Info (connections), Warning (errors)

**Deliverables:**
- Structured logs for debugging
- Real-time metrics for monitoring
- No breaking changes

**Estimated Effort:** 2-3 days  
**Risk:** Low - additive changes only

**Acceptance Criteria:**
- [ ] SSE connection lifecycle logged with context (port, URL)
- [ ] Discovery results logged (candidate count, server count)
- [ ] Event processing logged by type (session.created, message.sent, etc.)
- [ ] Basic gauges/counters exported (can scrape /metrics endpoint)
- [ ] No performance regression (benchmark before/after)

---

### Phase 2: Advanced Observability + PubSub (Week 2-3)

**Goal:** Add tracing, advanced metrics, and PubSub for n+1 subscribers.

**Tasks:**
1. Add Effect.withSpan to pipeline stages (Week 2)
   - SSE: connect → parse → extract → route → upsert → derive → emit
   - Database: query, save, load (cursor-store.ts, event-source.ts)
   - Discovery: lsof → verify → bootstrap

2. Add histograms for latency tracking (Week 2)
   - Event processing latency (1ms to 1s buckets)
   - Derivation latency by session count
   - Database query latency (P50/P95/P99)

3. Add conditional retry (Week 2-3)
   - Replace manual backoff with Schedule.exponential
   - Add jitter (Schedule.jittered)
   - Only retry transient errors (Schedule.whileInput)

4. Add acquireRelease for SSE connections (Week 3)
   - Wrap bootstrap + stream in acquireRelease
   - Remove manual fiber tracking
   - Test interruption cleanup

5. **Add PubSub for n+1 subscribers** (Week 3)
   - Replace direct WorldStore mutations with PubSub.publish
   - Create PubSub.bounded(32) for backpressure
   - Fork subscribers as background Fibers (WorldStore, Logger, Metrics)
   - Each subscriber gets independent queue (no blocking)

**Deliverables:**
- End-to-end tracing for SSE pipeline
- Latency histograms for hot paths
- Schedule-based retry with jitter
- Interruption-safe SSE connections
- **Type-safe event fan-out with backpressure**

**Estimated Effort:** 8-10 days  
**Risk:** Low-Medium (composition-based, no business logic changes)

**Acceptance Criteria:**
- [ ] Trace hierarchy visible: discovery → verify → bootstrap → connect → process_event
- [ ] Span attributes include port, event_type, session_id, db.operation
- [ ] Histograms track P50/P95/P99 for event processing, derivation, DB queries
- [ ] Retry uses Schedule (no manual backoff loops)
- [ ] SSE connections use acquireRelease (cleanup verified in tests)
- [ ] **PubSub delivers events to all subscribers (UI + TUI + debug tools)**
- [ ] **Backpressure works (slow subscriber doesn't block fast ones)**
- [ ] **Subscribers auto-cleanup on scope close**

---

### Phase 3: Production Readiness (Week 4-5)

**Goal:** Export observability to external stack, create dashboards, set up alerts.

**Tasks:**
1. OTel integration (Week 4)
   - Initialize OTel tracer provider (otel.ts)
   - Bridge Effect spans to OTel (effect-otel-bridge.ts)
   - Propagate trace context across services (W3C headers)

2. Grafana dashboards (Week 5)
   - 16 panels across 5 rows (see O11y audit section 7)
   - Auto-refresh every 10s
   - Prometheus scrape endpoint

3. Alerting (Week 5)
   - 5 SLO-based alerts (error rate, latency, connections, backpressure, discovery)
   - Alertmanager config (Slack + PagerDuty)

**Deliverables:**
- Spans exported to Jaeger/Zipkin/Honeycomb
- Grafana dashboard for at-a-glance health
- SLO-based alerts prevent outages

**Estimated Effort:** 7-9 days  
**Risk:** Medium - requires external observability stack

**Acceptance Criteria:**
- [ ] Spans visible in Jaeger UI (end-to-end trace from Next.js → Core → Backend)
- [ ] Grafana dashboard renders correctly (all 16 panels)
- [ ] Alerts fire/recover correctly (test with load)
- [ ] Runbooks documented for each alert

---

## 4. Risk & Effort Summary

### Total Effort Estimate

| Phase | Tasks | Effort (Days) | Risk Level | Dependencies |
|-------|-------|---------------|------------|--------------|
| **Phase 1** | Foundation logging + metrics | 2-3 | Low | None |
| **Phase 2** | Tracing + Schedule + acquireRelease + PubSub | 8-10 | Low-Medium | Phase 1 |
| **Phase 3** | OTel + dashboards + alerts | 7-9 | Medium | External stack |
| **TOTAL** | | **17-22** | **Medium** | **~4-5 weeks** |

### Optional Improvements (Post-MVP)

| Task | Effort | Risk | When to Do | Status |
|------|--------|------|-----------|--------|
| SSEService extraction | 1 day | Medium | After Phase 2 | ✅ DONE |
| WorldStoreService | 4 hours | Medium | After SSEService | ❌ TODO |
| Scope-based fiber mgmt | 2 hours | Low | After SSEService | ✅ DONE |
| Stream.asyncScoped | 4 hours | Low | After Phase 2 | ✅ DONE |
| Unify stream files | 1 hour | Low | Anytime | ✅ DONE |
| Delete sse-bridge.ts | 15 mins | Low | Anytime | ✅ DONE |
| Unify atom definitions | 2 hours | Low | Anytime | ❌ TODO |
| PubSub migration | **MOVED TO PHASE 2** | Medium | After O11y foundation | ✅ DONE |
| Schedule.repeat discovery | 30 mins | Low | Anytime | ✅ DONE |

### Risk Analysis

#### Performance Overhead

**Concern:** Observability instrumentation adds latency to hot paths.

**Mitigation:**
- Use `Effect.logDebug` (disabled in prod by default)
- Sample high-frequency events (10% sampling for parse/emit spans)
- Profile before/after with benchmarks
- Add instrumentation incrementally, measure impact

#### Breaking Effect Composition

**Concern:** Adding observability breaks existing Effect pipelines.

**Mitigation:**
- Use `Effect.tap` (doesn't change value flow)
- Layer instrumentation via `pipe()` (composable)
- Test instrumented vs uninstrumented paths
- Keep business logic pure, wrap at boundaries

#### Context Explosion

**Concern:** Too much context logging blows up log volume.

**Mitigation:**
- Use `Effect.annotateLogs` sparingly (session ID, event type only)
- Avoid logging full payloads (truncate to 100 chars)
- Use sampling for high-frequency events
- Configure log levels per environment (Debug in dev, Info in prod)

#### External Dependencies

**Concern:** OTel/Prometheus/Grafana stack required for Phase 3.

**Mitigation:**
- Phase 1-2 work standalone (Effect-TS built-in observability)
- Use Docker Compose for local stack setup
- Document infrastructure requirements
- Provide Grafana dashboard JSON for import

---

## 5. Quick Wins (Start Immediately)

These changes deliver immediate value with minimal effort/risk:

### Quick Win 1: Schedule for Retry (30 mins)

**Before:**
```typescript
// Manual exponential backoff
const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
yield* Effect.sleep(delay)
```

**After:**
```typescript
const sseRetrySchedule = Schedule.exponential("1 second")
  .pipe(Schedule.jittered)
  .pipe(Schedule.upTo("30 seconds"))
  .pipe(Schedule.recurs(10))

const connectionEffect = Effect.retry(connectEffect, sseRetrySchedule)
```

**Benefit:** Jitter prevents thundering herd, declarative policy.

---

### Quick Win 2: Delete sse-bridge.ts (15 mins)

**Rationale:** WorldSSE handles events directly. sse-bridge.ts is vestigial.

**Steps:**
1. Verify no imports: `rg "from.*sse-bridge" packages/`
2. Delete `packages/core/src/world/sse-bridge.ts`
3. Run tests

**Benefit:** -131 LOC, reduced maintenance burden.

---

### Quick Win 3: Basic Logging (1 hour)

**Add to SSE connection start:**
```typescript
Effect.runFork(
  Effect.log("WorldSSE starting").pipe(
    Effect.annotateLogs({
      serverUrl: this.config.serverUrl || "auto-discover",
      autoReconnect: this.config.autoReconnect
    })
  )
)
```

**Add to discovery results:**
```typescript
yield* Effect.logInfo("Discovery complete").pipe(
  Effect.annotateLogs({ serverCount: servers.length })
)
```

**Benefit:** Immediate debugging visibility, no performance impact.

---

### Quick Win 4: Unify Stream Files (1 hour)

**Before:** stream.ts and merged-stream.ts have 80 duplicate lines.

**After:**
```typescript
// stream.ts - delegates to merged-stream
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
  return createMergedWorldStream({ ...config, sources: [] })
}
```

**Benefit:** DRY, single source of truth.

---

### Quick Win 5: Basic Metrics (2 hours)

**Add gauges:**
```typescript
const sseConnectionsGauge = Metric.gauge("sse_connections_active")
const sessionCountGauge = Metric.gauge("world_sessions_total")

// In connectToServer()
yield* Metric.increment(sseConnectionsGauge)

// In deriveWorldState()
yield* Metric.set(sessionCountGauge, sessions.length)
```

**Benefit:** Real-time monitoring, Prometheus scrape endpoint.

---

## 6. Best Code Examples (Before/After)

### Example 1: SSE Event Processing with Tracing

**BEFORE (no instrumentation):**
```typescript
// sse.ts:171-244
export function connectToSSE(port: number): Stream.Stream<SSEEvent, Error> {
  return Stream.async<SSEEvent, Error>((emit) => {
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
  })
}
```

**AFTER (with tracing + logging):**
```typescript
export function connectToSSE(port: number): Stream.Stream<SSEEvent, Error> {
  return Stream.async<SSEEvent, Error>((emit) => {
    parser = createParser({
      onEvent: (event) => {
        Effect.runFork(
          Effect.gen(function* () {
            // Stage 1: Parse JSON
            const data = yield* Effect.try({
              try: () => JSON.parse(event.data),
              catch: (e) => new Error(`JSON parse failed: ${e}`)
            }).pipe(
              Effect.withSpan("sse.parse", {
                attributes: { "event.id": event.id }
              }),
              Effect.tapError(err => 
                Effect.logWarning("Malformed SSE event").pipe(
                  Effect.annotateLogs({ error: err.message })
                )
              )
            )
            
            // Stage 2: Emit event
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
            }
          }).pipe(
            Effect.withSpan("sse.process_event", {
              attributes: { port, "connection.url": url }
            })
          )
        )
      },
    })
  })
}
```

**Benefits:**
- End-to-end trace: sse.process_event → sse.parse → sse.emit
- Span attributes: port, event.id, payload.type
- Error logging for malformed events
- No business logic changes

---

### Example 2: SSE Connection with acquireRelease

**BEFORE (manual cleanup):**
```typescript
// sse.ts:369-409
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
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
        yield* Effect.sleep(delay)
      }
    }
  })
  
  const fiber = Effect.runFork(connectionEffect)
  this.connectionFibers.set(port, fiber)  // Manual tracking
}
```

**AFTER (with acquireRelease + Schedule):**
```typescript
const makeSSEConnection = (port: number, store: WorldStore) =>
  Effect.acquireRelease(
    // Acquire: Bootstrap + create stream
    Effect.gen(function* () {
      yield* Effect.logInfo("Connecting to SSE").pipe(
        Effect.annotateLogs({ port })
      )
      yield* bootstrapFromServer(port, store)
      return { port, stream: connectToSSE(port) }
    }),
    // Release: Guaranteed cleanup
    ({ port }) => Effect.sync(() => {
      console.log(`Closed SSE connection to port ${port}`)
    })
  )

// Retry schedule with jitter
const sseRetrySchedule = Schedule.exponential("1 second")
  .pipe(Schedule.jittered)
  .pipe(Schedule.upTo("30 seconds"))
  .pipe(Schedule.recurs(10))
  .pipe(Schedule.whileInput((error: Error) => isTransientError(error)))

// Usage
const connectionEffect = Effect.retry(
  Effect.scoped(
    Effect.gen(function* () {
      const conn = yield* makeSSEConnection(port, store)
      yield* Stream.runForEach(conn.stream, (event) =>
        Effect.sync(() => handleEvent(event))
      )
    })
  ),
  sseRetrySchedule
)

const fiber = Effect.runFork(connectionEffect)
// No manual tracking - Scope handles cleanup
```

**Benefits:**
- Guaranteed cleanup on interruption
- No manual fiber Map tracking
- Jitter prevents thundering herd
- Conditional retry (transient errors only)
- Composable with other Effects

---

### Example 3: State Derivation with Metrics

**BEFORE (no instrumentation):**
```typescript
// atoms.ts:197-294
private deriveWorldState(data: WorldStateData): WorldState {
  // Build message ID → parts map
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

**AFTER (with timing + metrics):**
```typescript
private deriveWorldState(data: WorldStateData): WorldState {
  const derivation = Effect.gen(function* () {
    yield* Effect.logDebug("Starting world derivation").pipe(
      Effect.annotateLogs({
        sessionCount: data.sessions.length,
        messageCount: data.messages.length,
        partCount: data.parts.length
      })
    )
    
    // Build parts index
    const partsByMessage = new Map<string, Part[]>()
    for (const part of data.parts) {
      const existing = partsByMessage.get(part.messageID) ?? []
      existing.push(part)
      partsByMessage.set(part.messageID, existing)
    }
    
    yield* Effect.logDebug("Built parts index").pipe(
      Effect.annotateLogs({ uniqueMessages: partsByMessage.size })
    )
    
    // ... enrichment logic (same 100 lines) ...
    
    const worldState: WorldState = { /* ... */ }
    
    yield* Effect.logDebug("Derivation complete").pipe(
      Effect.annotateLogs({
        enrichedSessions: worldState.sessions.length,
        activeCount: worldState.activeSessionCount
      })
    )
    
    // Update metrics
    yield* Effect.all([
      Metric.set(sessionCountGauge, worldState.sessions.length),
      Metric.set(activeSessionsGauge, worldState.activeSessionCount),
      Metric.increment(derivationCounter)
    ])
    
    return worldState
  }).pipe(
    Effect.withSpan("derive_world_state", {
      attributes: {
        "sessions.count": data.sessions.length,
        "messages.count": data.messages.length
      }
    })
  )
  
  return Effect.runSync(derivation)
}
```

**Benefits:**
- Logs derivation stages (start → index → complete)
- Metrics: gauge for session count, counter for derivations
- Tracing: span shows derivation timing
- No business logic changes (same 100 lines of enrichment)

---

## 7. Migration Dependencies

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY GRAPH                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Phase 1: O11y Foundation (2-3 days)                                   │
│    ├─ Add logging (Effect.tap, annotateLogs)                           │
│    ├─ Add basic metrics (gauges, counters)                             │
│    └─ No dependencies                                                  │
│                                                                        │
│  Phase 2: Advanced O11y + Safety (7-9 days)                            │
│    ├─ Add tracing (Effect.withSpan) ──────────┐                        │
│    ├─ Add histograms ─────────────────────────┼─ DEPENDS ON PHASE 1   │
│    ├─ Schedule for retry ─────────────────────┘                        │
│    ├─ acquireRelease for SSE                                           │
│    └─ No blocking dependencies (can parallelize)                       │
│                                                                        │
│  Phase 3: Production Stack (7-9 days)                                  │
│    ├─ OTel integration ───────────────────────┐                        │
│    ├─ Grafana dashboards ─────────────────────┼─ DEPENDS ON PHASE 1-2 │
│    ├─ Alerting ───────────────────────────────┘                        │
│    └─ External deps: Prometheus, Grafana, Jaeger                       │
│                                                                        │
│  Optional Improvements (can be done anytime)                           │
│    ├─ SSEService extraction ──────────────────┐                        │
│    ├─ Scope-based fiber mgmt ─────────────────┼─ AFTER SSEService      │
│    ├─ WorldStoreService ──────────────────────┘                        │
│    ├─ Stream.asyncScoped                                               │
│    ├─ Unify stream files                                               │
│    ├─ Delete sse-bridge.ts                                             │
│    └─ Unify atom definitions                                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Critical Path:** Phase 1 → Phase 2 → Phase 3 (sequential)  
**Parallelizable:** Quick wins (stream unification, sse-bridge deletion, Schedule.repeat)

---

## 8. Testing Strategy

### Unit Tests

**Observability:**
- [ ] Test Effect.tap preserves value flow
- [ ] Verify Metric.increment increments correctly
- [ ] Check Effect.annotateLogs adds context to logs
- [ ] Ensure Effect.withSpan creates spans with correct attributes

**Resource Safety:**
- [ ] Test acquireRelease cleanup runs on success
- [ ] Test acquireRelease cleanup runs on failure
- [ ] Test acquireRelease cleanup runs on interruption (Fiber.interrupt)
- [ ] Verify no resource leaks (fiber tracking, connections)

**Retry Logic:**
- [ ] Test Schedule.exponential backoff (1s, 2s, 4s, ...)
- [ ] Test Schedule.jittered adds randomness (±25%)
- [ ] Test Schedule.whileInput only retries transient errors
- [ ] Verify max attempts respected (Schedule.recurs)

### Integration Tests

**SSE Pipeline:**
- [ ] Test end-to-end trace: discovery → connect → parse → emit
- [ ] Verify span nesting: parent (process_event) → children (parse, emit)
- [ ] Check span attributes: port, event_type, session_id

**Metrics Export:**
- [ ] Test /metrics endpoint scrape (Prometheus format)
- [ ] Verify gauge values (sse_connections_active, world_sessions_total)
- [ ] Verify counter increments (sse_events_total)
- [ ] Verify histogram buckets (event_processing_seconds_bucket)

**OTel Integration:**
- [ ] Test OTel exporter sends spans to collector
- [ ] Verify trace context propagation (W3C headers)
- [ ] Check distributed trace across services (Next.js → Core → Backend)

### Performance Tests

**Benchmark:**
- [ ] Measure event processing latency before/after instrumentation
- [ ] Verify < 5% overhead from logging (Effect.logDebug disabled in prod)
- [ ] Test high throughput (1000 events/sec) with instrumentation enabled
- [ ] Check memory usage (no leaks from metric registries)

**Load Tests:**
- [ ] Simulate reconnection storm (10 connections reconnecting simultaneously)
- [ ] Verify jitter prevents thundering herd (connections spread over time)
- [ ] Test backpressure handling (slow subscriber, fast SSE stream)

---

## Conclusion

This is **fundamentally an observability project**. The core/world layer is a production-grade distributed streaming system that currently operates **blind**.

### The Most Important Decision: WHERE TO START

**START WITH OBSERVABILITY.** Without it:
- Can't debug production issues (no visibility into SSE pipeline)
- Can't monitor performance (no latency tracking for derivation, queries)
- Can't detect anomalies (no metrics for reconnections, error rates)
- Can't set SLOs (no data for availability, latency targets)

### Recommended Execution Order

**Week 1: Observability Foundation**
- Add logging (Effect.tap, annotateLogs)
- Add basic metrics (gauges, counters)
- Immediate debugging visibility, no breaking changes

**Week 2-3: Advanced O11y + Safety**
- Add tracing (Effect.withSpan) for end-to-end visibility
- Add histograms for latency tracking
- Replace manual retry with Schedule (jitter, conditional retry)
- Add acquireRelease for SSE connections (interruption safety)

**Week 4-5: Production Stack**
- OTel integration (export to Jaeger/Honeycomb)
- Grafana dashboards (16 panels, 5 rows)
- SLO-based alerts (Slack + PagerDuty)

**Post-MVP: Quality of Life**
- SSEService extraction (testability)
- Scope-based fiber management (no manual tracking)
- Stream.asyncScoped (cleaner async iterator)
- Code cleanup (unify stream files, delete sse-bridge.ts)

### Final Verdict

**State Management:** SOUND (keep as-is)  
**Event Broadcasting:** SUFFICIENT (PubSub only if multi-subscriber needed)  
**Resource Safety:** NEEDS WORK (add acquireRelease for SSE)  
**Retry Logic:** NEEDS WORK (replace with Schedule)  
**Observability:** **CRITICAL GAP (START HERE)**

**Total Effort:** 16-21 days (4 weeks) for Phases 1-3  
**Total Impact:** TRANSFORMATIONAL (blind → fully observable system)

The migration is **incremental** - each phase delivers value independently. Start with O11y foundation (quick wins), then layer on advanced observability, then production-ready tooling.

**This is THE most important work** because observability is the foundation for debugging, monitoring, and operating a distributed system. Without it, we're flying blind.

---

## Appendix: Related Resources

### Source Audits
- [State Management Audit](./EFFECT_PATTERNS_STATE_AUDIT.md) - Current architecture SOUND
- [Event/Stream Layer Audit](./EFFECT_PATTERNS_EVENTS_AUDIT.md) - Fiber improvements, PubSub defer
- [Runtime/Lifecycle Audit](./EFFECT_PATTERNS_RUNTIME_AUDIT.md) - acquireRelease gaps, Schedule opportunities
- [O11y Audit](./EFFECT_PATTERNS_O11Y_AUDIT.md) - ZERO instrumentation, 5-phase migration plan

### ADRs
- [ADR-016: Core Layer Responsibility](../adr/016-core-layer-responsibility.md) - Smart boundary pattern
- [ADR-018: Reactive World Stream](../adr/018-reactive-world-stream.md) - Push-based state with effect-atom

### Effect-TS Resources
- Effect observability docs: https://effect.website/docs/observability/introduction
- Effect tracing guide: https://effect.website/docs/observability/tracing
- Effect metrics guide: https://effect.website/docs/observability/metrics
- Schedule API: https://effect.website/docs/scheduling

---

**Generated:** 2026-01-02 by CoolWind (opencode-next--xts0a-mjx3stf7zj9)
