# Effect Router Migration Guide

Migrate from manual async patterns to the Effect-based router for type-safe, composable request handling.

## Overview

The Effect router eliminates boilerplate and prevents entire classes of bugs:

| Problem            | Old Pattern                                     | New Pattern                      |
| ------------------ | ----------------------------------------------- | -------------------------------- |
| **Error handling** | Try-catch + manual state                        | Typed errors via Effect          |
| **Timeouts**       | `Promise.race()` everywhere                     | `.timeout("5s")` declarative     |
| **Retries**        | Custom exponential backoff (3+ implementations) | `.retry("exponential")` built-in |
| **Loading state**  | Manual `useState(isLoading)`                    | Derived from Effect execution    |
| **Streaming**      | EventSourceParserStream + manual batching       | Effect.Stream + heartbeat        |
| **Validation**     | Manual schema checks                            | `.input(Schema)` automatic       |
| **Cancellation**   | AbortController leak-prone                      | Effect interruption safe         |

**Effort estimate:** 2-3 days for full migration. Can be done incrementally.

## Before/After Comparison

### Error Handling

**BEFORE: Manual try-catch + state**

```typescript
// apps/web/src/react/use-session.ts (current pattern)
const [error, setError] = useState<Error | null>(null);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  setIsLoading(true);
  setError(null);

  client.session
    .get(sessionId)
    .then((session) => setSession(session))
    .catch((err) => {
      setError(err);
      toast.error("Failed to load session");
    })
    .finally(() => setIsLoading(false));
}, [sessionId]);
```

**AFTER: Typed errors via Effect**

```typescript
// apps/web/src/react/use-session.ts (Effect pattern)
import * as Effect from "effect/Effect";
import { ValidationError, TimeoutError, HandlerError } from "@/core/router";

const effect = caller("session.get", { id: sessionId }).pipe(
  Effect.catchTag("ValidationError", (err) => {
    toast.error(`Invalid input: ${err.issues[0].message}`);
    return Effect.fail(err);
  }),
  Effect.catchTag("TimeoutError", (err) => {
    toast.error(`Request timed out after ${err.duration}`);
    return Effect.fail(err);
  }),
  Effect.catchTag("HandlerError", (err) => {
    toast.error("Failed to load session");
    return Effect.fail(err);
  }),
);

const result = await Effect.runPromise(effect);
```

**Key differences:**

- Errors are **typed** (not `unknown`)
- Error handling is **composable** (pipe operators)
- No manual state management needed
- Toast notifications are **co-located** with error handling

### Timeout Handling

**BEFORE: Manual Promise.race**

```typescript
// apps/web/src/app/page.tsx (current pattern)
const sessionsResponse = await Promise.race([
  client.session.list(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000),
  ),
]);
```

**AFTER: Declarative timeout**

```typescript
// apps/web/src/app/page.tsx (Effect pattern)
const route = o({ timeout: "5s" })
  .input(Schema.Struct({ limit: Schema.Number }))
  .handler(async ({ input, sdk }) => sdk.session.list());

// Timeout is automatic - no manual Promise.race needed
```

### Retry Logic

**BEFORE: Custom exponential backoff (3+ implementations)**

```typescript
// apps/web/src/core/multi-server-sse.ts (current pattern)
const MAX_RETRIES = 10;
const BASE_DELAY = 3000;
let retries = 0;

while (retries < MAX_RETRIES) {
  try {
    const response = await fetch(url);
    if (response.ok) return response;
  } catch (error) {
    retries++;
    const delay = Math.min(BASE_DELAY * Math.pow(2, retries), 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```

**AFTER: Built-in retry presets**

```typescript
// apps/web/src/core/router/routes.ts (Effect pattern)
const route = o({ retry: "exponential" }) // 100ms base, 2x, 3 retries
  .input(Schema.Struct({ url: Schema.String }))
  .handler(async ({ input, sdk }) => fetch(input.url));

// Or custom retry:
const route = o({
  retry: {
    maxAttempts: 10,
    delay: "3s",
    backoff: 2, // exponential multiplier
  },
});
```

### Loading State

**BEFORE: Manual useState**

```typescript
// apps/web/src/app/session/[id]/session-layout.tsx (current pattern)
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
  setIsLoading(true)
  client.session.get(sessionId)
    .then(setSession)
    .finally(() => setIsLoading(false))
}, [sessionId])

return isLoading ? <Spinner /> : <SessionView session={session} />
```

**AFTER: Derived from Effect execution**

```typescript
// apps/web/src/app/session/[id]/session-layout.tsx (Effect pattern)
const [result, setResult] = useState<Result<Session>>({ state: "loading" })

useEffect(() => {
  const effect = caller("session.get", { id: sessionId })

  Effect.runPromiseExit(effect).then(exit => {
    if (Exit.isSuccess(exit)) {
      setResult({ state: "success", data: exit.value })
    } else {
      setResult({ state: "error", error: Cause.failureOption(exit.cause).value })
    }
  })
}, [sessionId])

return result.state === "loading" ? <Spinner /> : <SessionView session={result.data} />
```

### Streaming

**BEFORE: EventSourceParserStream + manual batching**

```typescript
// apps/web/src/core/multi-server-sse.ts (current pattern)
const events = await client.global.event();
const parser = new EventSourceParserStream();

let eventQueue: Event[] = [];
let debounceTimer: NodeJS.Timeout;

for await (const event of parser.parse(events.stream)) {
  eventQueue.push(event);

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    eventQueue.forEach((e) => store.handleEvent(e));
    eventQueue = [];
  }, 16); // Manual 16ms batching
}
```

**AFTER: Effect.Stream with heartbeat**

```typescript
// apps/web/src/core/router/routes.ts (Effect pattern)
const route = o({
  stream: true,
  heartbeat: "30s", // Automatic heartbeat timeout
}).handler(async function* ({ sdk }) {
  const events = await sdk.global.event();

  for await (const event of events.stream) {
    yield event; // Effect.Stream handles batching automatically
  }
});
```

## Migration Strategy

### Phase 1: Define Routes (Day 1)

Create `apps/web/src/core/router/routes.ts` with all routes:

```typescript
import { createOpencodeRoute } from "./builder";
import * as Schema from "effect/Schema";

const o = createOpencodeRoute();

export const routes = {
  "session.get": o({ timeout: "30s" })
    .input(Schema.Struct({ id: Schema.String }))
    .handler(async ({ input, sdk }) => sdk.session.get(input.id)),

  "session.list": o({ timeout: "10s" }).handler(async ({ sdk }) =>
    sdk.session.list(),
  ),

  "session.prompt": o({
    timeout: "5m",
    retry: "exponential",
    stream: true,
    heartbeat: "30s",
  })
    .input(Schema.Struct({ sessionId: Schema.String, prompt: Schema.String }))
    .handler(async function* ({ input, sdk }) {
      const response = await sdk.session.prompt({
        sessionId: input.sessionId,
        prompt: input.prompt,
      });

      for await (const part of response.stream) {
        yield part;
      }
    }),
};
```

### Phase 2: Set Up Router (Day 1)

Create `apps/web/src/core/router/routes-config.ts`:

```typescript
import { createRouter } from "./router";
import { routes } from "./routes";

export const router = createRouter(routes);
```

### Phase 3: Create Adapters (Day 1)

**For Next.js API routes:**

```typescript
// apps/web/src/app/api/router/route.ts
import { createNextHandler } from "@/core/router/adapters/next";
import { router } from "@/core/router/routes-config";
import { createClient } from "@/core/client";

const handler = createNextHandler({
  router,
  createContext: async (req) => ({
    sdk: createClient(),
  }),
});

export { handler as GET, handler as POST };
```

**For Server Actions:**

```typescript
// apps/web/src/core/router/actions.ts
"use server";

import { createAction } from "@/core/router/adapters/next";
import { router } from "@/core/router/routes-config";
import { createClient } from "@/core/client";

export const callRoute = createAction({
  router,
  createContext: async () => ({
    sdk: createClient(),
  }),
});
```

**For Server Components (RSC):**

```typescript
// apps/web/src/app/session/[id]/page.tsx
import { createCaller } from "@/core/router/adapters/direct"
import { router } from "@/core/router/routes-config"
import { createClient } from "@/core/client"

export default async function SessionPage({ params }) {
  const caller = createCaller(router, {
    sdk: createClient(params.directory),
  })

  const session = await caller("session.get", { id: params.id })

  return <SessionView session={session} />
}
```

### Phase 4: Migrate Hooks (Day 2)

Migrate `useSession`, `useMessages`, `useSendMessage` to use the router:

```typescript
// apps/web/src/react/use-session.ts (AFTER)
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Cause from "effect/Cause";
import { useCallback, useEffect, useState } from "react";
import { useOpencode } from "./use-provider";

export function useSession(sessionId: string) {
  const { caller } = useOpencode();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const effect = caller("session.get", { id: sessionId });

    Effect.runPromiseExit(effect).then((exit) => {
      if (Exit.isSuccess(exit)) {
        setSession(exit.value);
      } else {
        const err = Cause.failureOption(exit.cause).value;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      setIsLoading(false);
    });
  }, [sessionId, caller]);

  return { session, error, isLoading };
}
```

### Phase 5: Remove Old Patterns (Day 2-3)

Delete:

- Manual `Promise.race` timeout logic
- Custom exponential backoff implementations
- Manual loading state management
- Try-catch error handling boilerplate

## Pattern Mapping

### Error Handling: try-catch → Typed Errors

| Old Pattern                     | New Pattern                                     | Benefit                   |
| ------------------------------- | ----------------------------------------------- | ------------------------- |
| `try { ... } catch (e) { ... }` | `Effect.catchTag("ErrorType", ...)`             | Type-safe, composable     |
| `error: unknown`                | `error: ValidationError \| TimeoutError \| ...` | Exhaustive error handling |
| Manual error state              | Derived from Effect Exit                        | No state sync bugs        |

**Example:**

```typescript
// OLD
try {
  const session = await client.session.get(id);
  setSession(session);
} catch (error) {
  if (error instanceof ValidationError) {
    setError("Invalid input");
  } else if (error instanceof TimeoutError) {
    setError("Request timed out");
  } else {
    setError("Unknown error");
  }
}

// NEW
const effect = caller("session.get", { id }).pipe(
  Effect.catchTag("ValidationError", (err) => {
    console.error("Invalid input:", err.issues);
    return Effect.fail(err);
  }),
  Effect.catchTag("TimeoutError", (err) => {
    console.error("Request timed out:", err.duration);
    return Effect.fail(err);
  }),
  Effect.catchTag("HandlerError", (err) => {
    console.error("Handler failed:", err.cause);
    return Effect.fail(err);
  }),
);

const result = await Effect.runPromise(effect);
```

### Loading State: Manual → Derived

| Old Pattern           | New Pattern            | Benefit                |
| --------------------- | ---------------------- | ---------------------- |
| `useState(isLoading)` | `Exit.isSuccess(exit)` | Single source of truth |
| Manual try-finally    | Effect execution       | Guaranteed cleanup     |
| Race conditions       | Effect guarantees      | No stale state         |

**Example:**

```typescript
// OLD
const [isLoading, setIsLoading] = useState(false);
const [data, setData] = useState(null);
const [error, setError] = useState(null);

useEffect(() => {
  setIsLoading(true);
  client
    .fetch(id)
    .then(setData)
    .catch(setError)
    .finally(() => setIsLoading(false));
}, [id]);

// NEW
const [result, setResult] = useState<Exit<Data, Error>>();

useEffect(() => {
  const effect = caller("fetch", { id });
  Effect.runPromiseExit(effect).then(setResult);
}, [id]);

const isLoading = result === undefined;
const data = Exit.isSuccess(result) ? result.value : null;
const error = Exit.isFailure(result)
  ? Cause.failureOption(result.cause).value
  : null;
```

### Retry: Manual → Built-in

| Old Pattern              | New Pattern             | Benefit              |
| ------------------------ | ----------------------- | -------------------- |
| Custom backoff loop      | `.retry("exponential")` | Standardized, tested |
| Manual delay calculation | Duration parsing        | Type-safe, readable  |
| Retry count tracking     | Built-in schedule       | No off-by-one errors |

**Example:**

```typescript
// OLD
const MAX_RETRIES = 3;
const BASE_DELAY = 100;

async function fetchWithRetry(url: string) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === MAX_RETRIES - 1) throw error;
      const delay = BASE_DELAY * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// NEW
const route = o({
  retry: {
    maxAttempts: 3,
    delay: "100ms",
    backoff: 2,
  },
}).handler(async ({ input }) => fetch(input.url));
```

### Timeout: Promise.race → Declarative

| Old Pattern                        | New Pattern        | Benefit                 |
| ---------------------------------- | ------------------ | ----------------------- |
| `Promise.race([request, timeout])` | `.timeout("5s")`   | Readable, composable    |
| Manual timeout error               | Typed TimeoutError | Exhaustive handling     |
| Timeout per request                | Route-level config | Consistent across calls |

**Example:**

```typescript
// OLD
const result = await Promise.race([
  client.session.get(id),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000),
  ),
]);

// NEW
const route = o({ timeout: "5s" })
  .input(Schema.Struct({ id: Schema.String }))
  .handler(async ({ input, sdk }) => sdk.session.get(input.id));
```

### Streaming: EventSourceParserStream → Effect.Stream

| Old Pattern             | New Pattern         | Benefit                    |
| ----------------------- | ------------------- | -------------------------- |
| EventSourceParserStream | Effect.Stream       | Backpressure handling      |
| Manual event batching   | Built-in batching   | Correct by default         |
| Manual heartbeat        | `.heartbeat("30s")` | Prevents stale connections |

**Example:**

```typescript
// OLD
const events = await client.global.event();
const parser = new EventSourceParserStream();

let eventQueue: Event[] = [];
let debounceTimer: NodeJS.Timeout;

for await (const event of parser.parse(events.stream)) {
  eventQueue.push(event);

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    eventQueue.forEach((e) => store.handleEvent(e));
    eventQueue = [];
  }, 16);
}

// NEW
const route = o({
  stream: true,
  heartbeat: "30s",
}).handler(async function* ({ sdk }) {
  const events = await sdk.global.event();

  for await (const event of events.stream) {
    yield event; // Effect.Stream handles batching + heartbeat
  }
});
```

## Testing

### Testing Routes

Use Effect's test utilities:

```typescript
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { describe, it, expect } from "bun:test";
import { createCaller } from "@/core/router/adapters/direct";
import { router } from "@/core/router/routes-config";

describe("session.get route", () => {
  it("returns session on success", async () => {
    const mockSdk = {
      session: {
        get: async (id: string) => ({ id, title: "Test" }),
      },
    };

    const caller = createCaller(router, { sdk: mockSdk });
    const result = await caller("session.get", { id: "ses_123" });

    expect(result).toEqual({ id: "ses_123", title: "Test" });
  });

  it("handles validation errors", async () => {
    const mockSdk = {
      /* ... */
    };
    const caller = createCaller(router, { sdk: mockSdk });

    const exit = await Effect.runPromiseExit(
      caller("session.get", { id: 123 }), // Wrong type
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const error = Cause.failureOption(exit.cause).value;
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("respects timeout", async () => {
    const mockSdk = {
      session: {
        get: async () => new Promise((resolve) => setTimeout(resolve, 10000)),
      },
    };

    const caller = createCaller(router, { sdk: mockSdk });
    const exit = await Effect.runPromiseExit(
      caller("session.get", { id: "ses_123" }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const error = Cause.failureOption(exit.cause).value;
    expect(error).toBeInstanceOf(TimeoutError);
  });
});
```

### Testing Hooks

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "@/react/use-session";

describe("useSession hook", () => {
  it("loads session on mount", async () => {
    const { result } = renderHook(() => useSession("ses_123"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session).toBeDefined();
  });

  it("handles errors", async () => {
    const { result } = renderHook(() => useSession("invalid"));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

## Gotchas

### 1. Effect.runPromise vs Effect.runPromiseExit

**Wrong:**

```typescript
// This throws on error - no error handling
const result = await Effect.runPromise(effect);
```

**Right:**

```typescript
// This returns Exit - safe error handling
const exit = await Effect.runPromiseExit(effect);
if (Exit.isSuccess(exit)) {
  // handle success
} else {
  // handle error
}
```

### 2. Middleware Execution Order

Middleware executes **left to right** in the chain:

```typescript
const route = o()
  .middleware(authMiddleware) // Runs first
  .middleware(loggingMiddleware) // Runs second
  .handler(async ({ ctx }) => {
    // ctx has both auth and logging context
  });
```

### 3. Streaming Routes Return AsyncIterable

Streaming routes don't return the data directly - they return an async iterable:

```typescript
// WRONG
const parts = await caller("session.prompt", { ... })
console.log(parts) // AsyncIterable, not array

// RIGHT
const parts = await caller("session.prompt", { ... })
for await (const part of parts) {
  console.log(part)
}
```

### 4. Schema Validation is Strict

Effect Schema is stricter than Zod by default:

```typescript
// This will fail validation - extra properties not allowed
const input = { id: "123", extra: "field" };
await caller("session.get", input); // ValidationError

// Use Schema.Struct with optional fields
const schema = Schema.Struct({
  id: Schema.String,
  extra: Schema.optional(Schema.String),
});
```

### 5. AbortSignal Cleanup

Routes automatically handle AbortSignal, but cleanup is your responsibility:

```typescript
const route = o().handler(async ({ signal, sdk }) => {
  const controller = new AbortController();
  signal.addEventListener("abort", () => controller.abort());

  // Now controller.signal will abort when route is cancelled
  return fetch(url, { signal: controller.signal });
});
```

### 6. Heartbeat Timeout is Strict

If a streaming route doesn't yield within the heartbeat interval, it fails:

```typescript
const route = o({
  stream: true,
  heartbeat: "30s", // Must yield every 30 seconds
})
  .handler(async function* ({ sdk }) {
    // This will timeout if no yield for 30s
    const result = await sdk.session.prompt({ ... })

    for await (const part of result.stream) {
      yield part // Resets heartbeat timer
    }
  })
```

## Rollback Plan

If you need to revert:

1. **Keep old patterns in parallel** - Don't delete old code immediately
2. **Feature flag routes** - Use environment variable to switch between old/new
3. **Gradual migration** - Migrate one route at a time, not all at once

**Example feature flag:**

```typescript
// apps/web/src/core/router/routes-config.ts
const useEffectRouter = process.env.NEXT_PUBLIC_USE_EFFECT_ROUTER === "true";

export const router = useEffectRouter
  ? createRouter(effectRoutes)
  : createRouter(legacyRoutes);
```

## Migration Checklist

- [ ] Create `apps/web/src/core/router/routes.ts` with all routes
- [ ] Create `apps/web/src/core/router/routes-config.ts` with router instance
- [ ] Create `apps/web/src/app/api/router/route.ts` (Next.js adapter)
- [ ] Create `apps/web/src/core/router/actions.ts` (Server Actions)
- [ ] Migrate `useSession` hook
- [ ] Migrate `useMessages` hook
- [ ] Migrate `useSendMessage` hook
- [ ] Update Server Components to use `createCaller`
- [ ] Delete old `Promise.race` timeout logic
- [ ] Delete custom exponential backoff implementations
- [ ] Delete manual loading state management
- [ ] Run full test suite
- [ ] Deploy with feature flag enabled
- [ ] Monitor error rates for 24 hours
- [ ] Remove feature flag and old code

## References

- **Effect documentation:** https://effect.website
- **Effect Schema:** https://effect.website/docs/schema/overview
- **Router implementation:** `apps/web/src/core/router/`
- **ADR 002:** `docs/adr/002-effect-migration.md`
