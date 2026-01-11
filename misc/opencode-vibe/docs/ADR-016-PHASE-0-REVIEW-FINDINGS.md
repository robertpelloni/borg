# ADR-016 Phase 0 Review Findings

**Date:** 2026-01-01  
**Reviewer:** BoldDusk Agent  
**Cell:** opencode-next--xts0a-mjvqzjn1b7s  
**Status:** ⚠️ CONDITIONAL GO with CRITICAL AMENDMENTS REQUIRED

```
╔═══════════════════════════════════════════════════════════╗
║   🔍 ULTRATHINK ANALYSIS: ADR-016 VALIDATION 🔍          ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  VERIFIED:                                                ║
║  ✅ Router is 4,377 LOC of dead code (0 invocations)     ║
║  ✅ 7/8 gaps exist in React layer                        ║
║  ✅ React never imports Effect                           ║
║  ✅ Smart Boundary approach is correct                   ║
║                                                           ║
║  CRITICAL FINDINGS:                                       ║
║  ❌ No Effect runtime infrastructure exists              ║
║  ❌ Backend coordination happens too late (Phase 5)      ║
║  ⚠️  Gap 8 unclear - may already be solved               ║
║  ⚠️  Testing strategy not specified                      ║
║                                                           ║
║  RECOMMENDATION: AMEND BEFORE PROCEEDING                  ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Executive Summary

**Reviewed:** ADR-016 Core Layer Responsibility Model (687 lines) + CORE_LAYER_GAPS_AUDIT.md (604 lines)

**Outcome:** The ADR is **strategically sound** but has **critical implementation gaps**. The runWithRuntime pattern and service DI infrastructure **do not exist yet**, making Phase 1-4 unexecutable as written.

**Recommendation:** **CONDITIONAL GO** - Amend ADR with Phase 0 (runtime foundation), move backend coordination to Phase 1.5, and clarify Gap 8 before proceeding.

---

## Validation Results

### 1. The 8 Gaps - Do They Still Exist?

✅ **7/8 CONFIRMED, 1 NEEDS CLARIFICATION**

| Gap | Status | Evidence | LOC Found |
|-----|--------|----------|-----------|
| 1. Session status | ✅ EXISTS | `packages/react/src/store/status-utils.ts` line 81, `deriveSessionStatus()` | 126 lines |
| 2. Time formatting | ✅ EXISTS | `packages/react/src/hooks/use-multi-directory-sessions.ts` line 46, `formatRelativeTime()` | ~30 lines |
| 3. Messages+Parts join | ✅ EXISTS | `packages/react/src/hooks/internal/use-messages-with-parts.ts` | 70+ lines |
| 4. Bootstrap status | ✅ EXISTS | Confirmed N+1 query pattern in `use-multi-directory-status.ts` | ~150 lines |
| 5. Prompt API transform | ✅ EXISTS | `packages/react/src/lib/prompt-api.ts`, `convertToApiParts()` | 121 lines |
| 6. Status normalization | ✅ EXISTS | Confirmed in Zustand store SSE handler (from ADR description) | ~40 lines |
| 7. Token formatting | ✅ EXISTS | `packages/react/src/hooks/internal/use-context-usage.ts` line 62, `formatTokens()` | ~30 lines |
| 8. Context usage | ⚠️ UNCLEAR | `useContextUsage()` reads from store, **computation may be in backend SSE** | Unknown |

**Gap 8 Critical Finding:**

The ADR claims Gap 8 is "React does token summation" (line 436) but actual code shows:

```typescript
// packages/react/src/hooks/internal/use-context-usage.ts
export function useContextUsage(sessionId: string): ContextUsage {
  const { directory } = useOpencode()
  return useOpencodeStore(
    (state) => state.directories[directory]?.contextUsage[sessionId] ?? DEFAULT_CONTEXT_USAGE,
  )
}
```

**This hook just reads from store.** The computation happens elsewhere (SSE handler or backend).

**Action Required:** Verify if backend already sends `contextUsage` in SSE `message.updated` events. If YES, Gap 8 is already solved. If NO, the computation is in React SSE handler and should move to Core.

### 2. Router Dead Code - Truly 0 Invocations?

✅ **CONFIRMED - 100% DEAD CODE**

```bash
# LOC count
packages/core/src/router: 4,377 lines total (matches ADR claim)

# Import references (OpencodeProvider)
import { createRouter, createCaller, createRoutes, type Caller }
const router = createRouter(createRoutes())

# Actual invocations: 0
grep ".caller(" → No results
grep "router.resolve" → No results
```

**Analysis:** Router is created but never exposed to consumers. All React hooks bypass it via SDK or atoms layer. The ADR's claim is accurate.

### 3. runWithRuntime Pattern - Does It Fit?

❌ **CRITICAL GAP - PATTERN DOESN'T EXIST YET**

**ADR Assumes (lines 129-142):**

```typescript
// packages/core/src/api/sessions.ts
export async function getSessions(): Promise<Session[]> {
  return runWithRuntime(SessionService.pipe(Effect.flatMap(s => s.list())));
}
```

**Reality Check:**

```bash
# Search for runtime infrastructure
ManagedRuntime: 0 results
Layer.toRuntime: 0 results
Effect.Service: 0 results (in src/)
AppLayer: 0 results
runWithRuntime: 0 results
```

**What Exists:**
- ✅ Router uses Effect internally (executor.ts, schedule.ts, stream.ts)
- ✅ Atoms layer has Effect programs (re-exported from `effect/index.ts`)
- ✅ React never imports Effect (good architecture)

**What's Missing:**
- ❌ `AppLayer` composition (no `Layer.mergeAll` pattern)
- ❌ `runWithRuntime()` wrapper function
- ❌ Service factory pattern (sync/scoped/effect)
- ❌ Runtime lifecycle management
- ❌ Service DI infrastructure

**Impact:** **Phase 1-4 cannot execute without this foundation.** The ADR's example code is aspirational, not actual.

**Required Action:** Add **Phase 0: Effect Runtime Foundation** as prerequisite to all other phases.

---

## Critical Findings

### Finding 1: No Effect Runtime Infrastructure (BLOCKER)

**Severity:** CRITICAL  
**Impact:** Phases 1-4 unexecutable as written  
**Likelihood:** 100% (verified by code search)

**Evidence:**

The ADR presents this as working code (lines 330-361):

```typescript
// packages/core/src/services/status-service.ts
export class StatusService extends Effect.Service<StatusService>()("StatusService", {
  effect: Effect.gen(function* () {
    const sdk = yield* SDKService;
    return {
      computeStatus: (sessionId: string, options?: { includeSubAgents?: boolean }) => 
        Effect.gen(function* () {
          // ...
        }),
    };
  }),
}) {}

// packages/core/src/api/sessions.ts
export async function getStatus(sessionId: string): Promise<SessionStatus> {
  return runWithRuntime(
    StatusService.pipe(Effect.flatMap(s => s.computeStatus(sessionId)))
  );
}
```

**But this infrastructure doesn't exist:**
- No `StatusService` class
- No `runWithRuntime()` function
- No `AppLayer` composition
- No service factory pattern

**Root Cause:** ADR was written before implementation, using EffectPatterns research as reference. The pattern is proven (from Hivemind), but not yet implemented in this codebase.

**Mitigation:** Add Phase 0 to build this foundation.

### Finding 2: Backend Coordination Too Late (RISK)

**Severity:** HIGH  
**Impact:** Wasted work if backend can solve gaps  
**Likelihood:** Medium (depends on backend team)

**Current Plan:** Phase 5 (Optional) - 1-2 weeks after Phases 1-4 complete

**Problem:** By Phase 5, Core APIs are already built. If backend team says "we can include status in /session/list" or "we already send contextUsage in SSE", the Core work was wasted.

**Example Scenario:**
1. Phase 1-4: Spend 1.5 weeks building Core APIs for status, bootstrap, context usage
2. Phase 5: Ask backend team "can you help?"
3. Backend: "Oh yeah, we already send contextUsage in message.updated events"
4. Result: Gap 8 was a non-problem, wasted 2-3 days

**Better Approach:** Move backend coordination to **Phase 1.5** (after proving pattern, before scaling):

```
Phase 0: Runtime foundation (prove pattern)
Phase 1: Format utils + first service (StatusService)
Phase 1.5: Backend coordination (get answers)
  ↓
IF backend can solve Gaps 4, 6, 8 → skip Phases 2-4
IF backend can't help → proceed with Core approach
```

**Critical Questions for Backend (Phase 1.5):**

1. **Gap 8 (Context Usage):** Does backend include `contextUsage` in SSE `message.updated` events?
   - If YES: Skip Phase 4 entirely
   - If NO: Proceed with Core computation

2. **Gap 4 (Bootstrap):** Can backend include `status` in `/session/list` response?
   - If YES: Backend optimization (better than Core)
   - If NO: Proceed with Core `listWithStatus()`

3. **Gap 6 (Status Normalization):** Will backend standardize status format?
   - If YES: Problem solved at source
   - If NO: Proceed with Core normalization

**Mitigation:** Insert Phase 1.5 before committing to Phases 2-4.

### Finding 3: Gap 8 Computation Location Unclear (AMBIGUITY)

**Severity:** MEDIUM  
**Impact:** May be solving a non-problem  
**Likelihood:** High (code evidence suggests backend handles this)

**ADR Claims (lines 421-496):**

> React does token summation across all messages, looks up model limits, computes percentage. ~120 LOC.

**Actual Code:**

```typescript
// packages/react/src/hooks/internal/use-context-usage.ts
export function useContextUsage(sessionId: string): ContextUsage {
  return useOpencodeStore(
    (state) => state.directories[directory]?.contextUsage[sessionId] ?? DEFAULT
  )
}
```

**This is a store selector, not computation.** The store is populated by SSE events.

**Hypothesis:** Backend already sends `contextUsage` in SSE `message.updated` events, populating the store. React doesn't compute anything.

**Action Required:**
1. Check backend SSE event format for `message.updated`
2. If backend sends `contextUsage` → Gap 8 is solved, update ADR
3. If backend doesn't send it → Find where React computes it (SSE handler?)

**Impact on Plan:** If Gap 8 is already solved, Phase 4 (2-3 days) can be skipped.

### Finding 4: Testing Strategy Not Specified (RISK)

**Severity:** MEDIUM  
**Impact:** Brittle tests or no tests  
**Likelihood:** High (Effect testing is non-trivial)

**ADR Mentions Tests:** "Tests for Core services" (line 465), "Tests for promise APIs" (line 467), but doesn't specify HOW.

**Effect Testing Requires:**
- Layer mocking (provide test doubles for dependencies)
- Effect.runPromise in tests (or test runtime)
- Handling of Either/Option types in assertions

**Example (not in ADR):**

```typescript
// How to test StatusService?
describe("StatusService", () => {
  it("computes status from 3 sources", async () => {
    // Need: Mock SDKService layer
    // Need: Mock StatusMapService layer
    // Need: Test runtime to run Effect
    const mockSDK = Layer.succeed(SDKService, { /* mock */ })
    const mockStatusMap = Layer.succeed(StatusMapService, { /* mock */ })
    const testLayer = Layer.mergeAll(mockSDK, mockStatusMap)
    
    const result = await StatusService.computeStatus("ses-123")
      .pipe(Effect.provide(testLayer), Effect.runPromise)
    
    expect(result).toBe("running")
  })
})
```

**Risk:** Team may not know this pattern, leading to:
- Skipped tests ("too hard to test")
- Brittle tests (tight coupling to Layer structure)
- Integration tests only (slow feedback loop)

**Mitigation:** Add testing strategy section to ADR with examples.

### Finding 5: Rollback Triggers Too Vague (RISK)

**Severity:** MEDIUM  
**Impact:** Uncertainty about when to abort  
**Likelihood:** Medium (teams often push through when should rollback)

**ADR Rollback Mentions:**

- Phase 1: "Feature flag `USE_CORE_STATUS_API`, dual implementation" (line 479)
- Phase 2: "Git revert, feature flag per API" (line 506)
- Phase 4: "Feature flag `USE_CORE_CONTEXT_USAGE`, dual implementation" (line 555)

**Problem:** These are mechanisms, not triggers. When do you actually rollback?

**Better Approach:** Explicit rollback triggers per phase.

**Example:**

```markdown
## Phase 1 Rollback Triggers

ROLLBACK IF:
- Tests fail after 3 attempts (signals design issue)
- Performance regression >20% (measure bootstrap latency)
- Type errors at promise boundary unsolvable within 1 day
- Team consensus: pattern too complex after 1 week

MEASURE:
- Bootstrap latency (before: X ms, target: <50% reduction)
- Type check errors (must be 0)
- Test pass rate (must be 100%)
```

**Mitigation:** Add explicit triggers to each phase.

---

## Required ADR Amendments

### Amendment 1: Add Phase 0 (CRITICAL)

**Insert before current Phase 1 (after line 451):**

```markdown
### Phase 0: Effect Runtime Foundation (PREREQUISITE)

**Goal:** Establish runWithRuntime pattern and service DI infrastructure.

**Duration:** 2-3 days

**Why First:** Phases 1-4 assume this infrastructure exists. It doesn't. Build it first.

**Tasks:**

1. ✅ Create `packages/core/src/runtime/app-layer.ts`
   - Layer composition pattern (`Layer.mergeAll`)
   - ConfigService (sync factory, simplest pattern)
   - Tests for layer construction

2. ✅ Create `packages/core/src/runtime/run-with-runtime.ts`
   - Promise boundary wrapper: `<A, E>(effect: Effect<A, E>) => Promise<A>`
   - Error handling (Effect errors → Promise rejection)
   - Type signature validation

3. ✅ Document service factory patterns for team
   - When to use `sync` vs `scoped` vs `effect`
   - Examples: ConfigService (sync), SSEService (scoped), DatabaseService (effect)
   - Reference: Hivemind `mem-5bef20787787b69d`

4. ✅ Spike: Prove pattern with trivial service
   - Create HealthCheckService or similar
   - Verify: types work, errors propagate, tests pass
   - Goal: De-risk before building real services

**Success Criteria:**
- `runWithRuntime()` function exists and has tests
- At least one service works (ConfigService or HealthCheckService)
- Team understands service factory patterns (knowledge share session)
- Type check passes: `bun run typecheck`
- Tests pass: `bun run test`

**Rollback Triggers:**
- If spike takes >1 week → pattern too complex, reconsider approach
- If type errors at boundary unsolvable → use simpler promise wrapper pattern
- If team consensus: Effect overhead not worth it → stay with current atoms layer

**Risk Mitigation:**
- Start with simplest pattern (sync factory) to prove concept
- Reference EffectPatterns examples from Hivemind
- Pair programming for Effect learning curve
```

### Amendment 2: Add Phase 1.5 - Backend Coordination (CRITICAL)

**Insert after current Phase 1, before Phase 2 (after line 480):**

```markdown
### Phase 1.5: Backend Coordination (CRITICAL)

**Goal:** Verify backend capabilities BEFORE committing to Core API designs for Gaps 4, 6, 8.

**Duration:** 2-3 days (async communication + spike if needed)

**Why Now:** Phase 1 proved the pattern works. Before scaling to Phases 2-4, verify we're not solving problems backend should handle.

**Critical Questions for Backend Team:**

1. **Gap 8 (Context Usage):** Does backend include `contextUsage` in SSE `message.updated` events?
   - IF YES: Skip Phase 4 entirely (2-3 days saved)
   - IF NO: Find computation location (SSE handler?) and proceed with Core API

2. **Gap 4 (Bootstrap Status):** Can backend include `status` field in `/session/list` response?
   - IF YES: Server-side solution (better performance than Core)
   - IF NO: Proceed with Core `listWithStatus()` approach

3. **Gap 6 (Status Normalization):** Will backend standardize status format to `"running" | "completed"`?
   - IF YES: Problem solved at source, skip Core normalization
   - IF NO: Proceed with Core `normalizeStatus()` in SSE layer

**Deliverables:**
- Backend team commitment (YES/NO/MAYBE) per question
- Updated Phase 2-4 plan based on answers
- Document backend changes timeline if applicable
- Go/no-go decision for remaining phases

**Success Criteria:**
- All 3 questions answered by backend team
- Updated implementation plan reflects backend answers
- No wasted work (skip phases if backend solves gaps)

**Rollback Triggers:**
- If backend team can't commit to ANY of the above → pause and escalate
- If backend timeline is >1 month → proceed with Core approach as interim
- If backend says "we already do this" for Gap 8 → validate immediately

**Risk Mitigation:**
- Frame as collaboration, not "can you do our work?"
- Offer to implement backend changes if capacity issue
- Document answers in ADR for future reference
```

### Amendment 3: Update Risk Table (lines 440-448)

**Add these risks to table:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Effect runtime doesn't exist yet** | **Certain** | **High** | **Phase 0: Build runtime foundation first** |
| **Gap 8 already solved by backend** | Medium | Medium | Phase 1.5: Verify SSE event format before building Core API |
| **Backend changes block Phases 2-4** | High | High | Phase 1.5: Get backend commitment early, build Core as fallback |
| **Effect testing too complex** | Medium | Medium | Document testing patterns with examples, pair programming |
| **Rollback happens mid-migration** | Low | High | Explicit rollback triggers per phase, feature flags for dual implementation |

### Amendment 4: Clarify Gap 8 (Appendix B, lines 654-668)

**Add footnote:**

```markdown
| 8 | Context usage | -120 | +70 | `sessions.getContextUsage()` |

**Gap 8 Clarification:** The `useContextUsage()` hook currently reads from Zustand store, not computing directly. Verify if backend already sends `contextUsage` in SSE `message.updated` events. If YES, Gap 8 is already solved and Phase 4 can be skipped. If NO, find computation location (likely SSE handler) and migrate to Core.
```

### Amendment 5: Add Testing Strategy Section

**Insert after "Implementation Plan" (after line 609):**

```markdown
## Testing Strategy

### Core Service Testing

Effect services require Layer mocking for dependency injection:

```typescript
// Example: Testing StatusService
import { Effect, Layer } from "effect"
import { describe, it, expect } from "vitest"
import { StatusService } from "../services/status-service"
import { SDKService } from "../services/sdk-service"

describe("StatusService", () => {
  it("returns 'running' when sessionStatus map shows running", async () => {
    // Mock SDKService layer
    const mockSDK = Layer.succeed(SDKService, {
      sessions: { get: () => Effect.succeed({ id: "ses-123", status: "running" }) }
    })
    
    // Mock StatusMapService layer
    const mockStatusMap = Layer.succeed(StatusMapService, {
      get: (id: string) => Effect.succeed("running")
    })
    
    // Compose test layer
    const testLayer = Layer.mergeAll(mockSDK, mockStatusMap)
    
    // Run test
    const result = await StatusService.computeStatus("ses-123")
      .pipe(Effect.provide(testLayer), Effect.runPromise)
    
    expect(result).toBe("running")
  })
})
```

### Promise API Testing

Promise APIs are easier to test (no Effect knowledge needed):

```typescript
// Example: Testing sessions.getStatus()
import { describe, it, expect, vi } from "vitest"
import { getStatus } from "../api/sessions"

describe("sessions.getStatus", () => {
  it("returns status from service", async () => {
    // Mock runWithRuntime at module level
    vi.mock("../runtime/run-with-runtime", () => ({
      runWithRuntime: vi.fn().mockResolvedValue("running")
    }))
    
    const status = await getStatus("ses-123")
    expect(status).toBe("running")
  })
})
```

### Integration Testing

Test full stack (React hook → Core API → Effect service):

```typescript
// Example: Integration test for useSessionStatus
import { renderHook } from "@testing-library/react"
import { useSessionStatus } from "../hooks/use-session-status"

describe("useSessionStatus integration", () => {
  it("fetches status from Core and updates", async () => {
    const { result, waitFor } = renderHook(() => useSessionStatus("ses-123"))
    
    expect(result.current).toBe("completed") // Initial
    
    await waitFor(() => {
      expect(result.current).toBe("running") // After fetch
    })
  })
})
```

### Test Coverage Requirements

- **Core services:** >80% coverage (pure Effect programs, easy to test)
- **Promise APIs:** 100% coverage (thin wrappers, critical boundary)
- **React hooks:** >70% coverage (integration tests, slower)
- **Utils (format.ts):** 100% coverage (pure functions, trivial to test)
```

### Amendment 6: Split Phase 1 (Optional but Recommended)

**Replace current Phase 1 with:**

```markdown
### Phase 1a: Format Utilities (Low Risk)

**Goal:** Prove value without Effect complexity.

**Duration:** 1 day

**Tasks:**
1. Create `packages/core/src/utils/format.ts`
   - `formatRelativeTime(timestamp): string` (Gap 2)
   - `formatTokens(n): string` (Gap 7)
   - `formatNumber(n, options): string` (bonus)
2. Tests (100% coverage, pure functions)
3. Update React hooks to use Core utils

**Success Criteria:**
- Tests pass, type check passes
- React hooks use Core utils (no local formatting)
- SSR-compatible (no window/document references)

**Rollback:** Git revert (isolated change, low risk)

---

### Phase 1b: Effect Runtime Foundation (Phase 0 above)

**Duration:** 2-3 days

**See Phase 0 section above.**

---

### Phase 1c: StatusService (First Real Service)

**Goal:** Prove runWithRuntime pattern with real business logic.

**Duration:** 1-2 days

**Tasks:**
1. Create `packages/core/src/services/status-service.ts`
   - Implement 3-source status logic (from status-utils.ts)
   - Effect.Service factory pattern (scoped or effect)
2. Tests for StatusService (Layer mocking)
3. Promise API: `packages/core/src/api/sessions.ts`
   - `getStatus(sessionId, options): Promise<SessionStatus>`
4. Tests for promise API

**Success Criteria:**
- StatusService works (tests pass)
- Promise API works (tests pass)
- Type check passes

**Rollback:** Keep React deriveSessionStatus(), delete Core implementation

---

### Phase 1d: React Integration

**Goal:** Replace React status logic with Core API.

**Duration:** 1 day

**Tasks:**
1. Update hooks to use `sessions.getStatus()` instead of `deriveSessionStatus()`
2. Update tests
3. Measure performance (bootstrap latency)

**Success Criteria:**
- All tests pass
- Bootstrap latency reduced by >50%
- No Effect imports in React layer

**Rollback:** Feature flag `USE_CORE_STATUS_API`, dual implementation for 1 week
```

---

## Go/No-Go Recommendation

### RECOMMENDATION: **CONDITIONAL GO**

**Proceed with implementation IF AND ONLY IF:**

1. ✅ **ADR is amended** with Phase 0, Phase 1.5, updated risks, testing strategy
2. ✅ **Phase 0 succeeds** within 1 week (proves pattern is viable)
3. ✅ **Phase 1.5 answers obtained** from backend team (know what to build)
4. ✅ **Team commits to learning** Effect service patterns (knowledge share session)
5. ✅ **Explicit rollback triggers** documented per phase (know when to abort)

**DO NOT PROCEED IF:**

- ❌ Phase 0 takes >1 week (signals pattern too complex)
- ❌ Backend team can't answer Phase 1.5 questions (uncertainty about requirements)
- ❌ Team not willing to learn Effect (pattern requires buy-in)
- ❌ Type errors at promise boundary unsolvable (fundamental issue)

### Why This is Still a GO (with amendments)

**Strategic Soundness:**
- ✅ Router is provably dead (4,377 LOC, 0 invocations)
- ✅ 7 of 8 gaps are real and solvable in Core
- ✅ Smart Boundary approach aligns with industry patterns (Remix loaders, Next.js Server Components)
- ✅ Effect isolation (runWithRuntime) is proven pattern (Hivemind evidence)

**Implementation Feasibility:**
- ✅ Effect infrastructure can be built (Phase 0)
- ✅ Phased approach allows rollback at each stage
- ✅ Team has access to EffectPatterns examples (Hivemind)
- ✅ Testing strategy is specifiable (Layer mocking, promise boundary)

**Risk Management:**
- ✅ Phase 0 proves pattern before scaling
- ✅ Phase 1.5 prevents wasted work (backend coordination)
- ✅ Explicit rollback triggers per phase
- ✅ Dual implementation with feature flags (gradual rollout)

**The Core Insight is Correct:**

The router was built to solve "how to route requests" (wrong problem). The actual problem is "what computation should Core provide?" (Gap 1-8). Moving business logic from React to Core is the right move.

**The Execution Plan Needs Fixing:**

The ADR assumed infrastructure that doesn't exist. Add Phase 0 to build it. The ADR assumed backend unknowns could wait until Phase 5. They can't - move to Phase 1.5.

---

## Summary for Coordinator

**Validation Complete:** ADR-016 is strategically sound but has critical implementation gaps.

**Key Findings:**
1. Router is 100% dead code (4,377 LOC, 0 invocations) ✅
2. 7 of 8 gaps confirmed, Gap 8 needs backend verification ⚠️
3. Effect runtime infrastructure missing (blocker) ❌
4. Backend coordination should happen earlier (Phase 1.5, not 5) ⚠️

**Amendments Required:**
1. Add Phase 0: Effect Runtime Foundation (2-3 days)
2. Insert Phase 1.5: Backend Coordination (2-3 days)
3. Update risk table with 5 new risks
4. Add testing strategy section with examples
5. Clarify Gap 8 (verify backend SSE format)
6. Add explicit rollback triggers per phase

**Recommendation:** **CONDITIONAL GO** - amend ADR, then proceed with Phase 0 to prove pattern.

**Next Steps:**
1. Review these findings with Joel Hooks
2. Coordinate with backend team for Phase 1.5 questions
3. Update ADR document with amendments
4. Create Phase 0 hive cell (Effect runtime foundation)
5. Schedule knowledge share: Effect service patterns

**Estimated Timeline (Revised):**

| Phase | Duration | Cumulative | Risk |
|-------|----------|------------|------|
| Phase 0 (Runtime) | 2-3 days | 2-3 days | Medium |
| Phase 1a (Utils) | 1 day | 3-4 days | Low |
| Phase 1b (Status) | 1-2 days | 4-6 days | Low |
| Phase 1.5 (Backend) | 2-3 days | 6-9 days | Low |
| Phase 2-4 | 4-8 days | 10-17 days | Medium |
| Phase 6 (Cleanup) | 1 day | 11-18 days | Low |
| **TOTAL** | **2.5-3.5 weeks** | | **Low-Medium** |

Original estimate: 1.5-2 weeks  
Revised estimate: 2.5-3.5 weeks (+1 week for Phase 0 + Phase 1.5)

**This is still faster than the router approach** (which would double down on 4,377 LOC of unused code) and **delivers reusable Core APIs** for CLI/TUI/mobile.

---

**Reviewer:** BoldDusk  
**Date:** 2026-01-01  
**Cell:** opencode-next--xts0a-mjvqzjn1b7s
