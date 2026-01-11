# UploadThing DX Research

**Research Goal:** Analyze uploadthing's developer experience patterns for inspiration in building OpenCode's SDK/React integration.

**Key Question:** How does uploadthing achieve a simple, type-safe DX across server and client?

---

## 1. Top-Level Config Pattern

### Server-Side Router Definition

**Pattern:** Builder API with fluent chainable methods

```typescript
// examples/minimal-appdir/src/server/uploadthing.ts
import { createUploadthing, UTFiles } from "uploadthing/next";
import type { FileRouter } from "uploadthing/next";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.log("Error uploading file", err.message);
    return { message: err.message };
  },
});

export const uploadRouter = {
  videoAndImage: f({
    image: { maxFileSize: "32MB", maxFileCount: 4 },
    video: { maxFileSize: "16MB" },
  })
    .middleware(({ req, files }) => {
      // Auth checks, labeling
      const filesWithMyIds = files.map((file, idx) => ({
        ...file,
        customId: `${idx}-${randomUUID()}`,
      }));
      return { foo: "bar" as const, [UTFiles]: filesWithMyIds };
    })
    .onUploadComplete(({ file, metadata }) => {
      console.log("upload completed", file);
    }),
};

export type OurFileRouter = typeof uploadRouter;
```

**Key Insights:**

1. **Factory function per framework** - `createUploadthing` is exported from `uploadthing/next`, not generic package
2. **Builder pattern with type accumulation** - each method (`.input()`, `.middleware()`, `.onUploadComplete()`) returns new builder with updated types
3. **Export router type** - `typeof uploadRouter` becomes the source of truth for client-side typings
4. **Symbol-based markers** - `UTFiles` symbol for special metadata (custom IDs) without polluting user's metadata object
5. **Framework-specific adapter args** - Builder generic `<TAdapterFnArgs>` injects framework context (e.g., `{ req: NextRequest }`)

### Route Handler Registration

**Pattern:** Adapter creates framework-specific handlers

```typescript
// examples/minimal-appdir/src/app/api/uploadthing/route.ts
import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "~/server/uploadthing";

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
  config: {
    logLevel: "Debug",
  },
});
```

**Key Insights:**

1. **Framework adapter destructures exports** - `{ GET, POST }` for Next.js App Router conventions
2. **Minimal ceremony** - one function call, pass router, done
3. **Runtime config separate from route definition** - `logLevel` is operational, not part of the file route schema

---

## 2. Hook Exposure Pattern

### Client-Side Type Propagation

**Pattern:** `generateReactHelpers` factory with router type bound

```typescript
// examples/minimal-appdir/src/utils/uploadthing.ts
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "~/server/uploadthing";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
```

**Key Insights:**

1. **User creates their own typed exports** - not importing from `@uploadthing/react` directly
2. **Single type parameter** - `<OurFileRouter>` flows through entire client API
3. **Generic factory returns typed helpers** - `useUploadThing`, `uploadFiles`, `routeRegistry`
4. **Colocation encourages discoverability** - user file (`~/utils/uploadthing.ts`) is single import source

### Hook Usage

**Pattern:** Endpoint selection with callback for type inference

```typescript
// examples/minimal-appdir/src/app/page.tsx
const { startUpload, isUploading, routeConfig } = useUploadThing(
  "videoAndImage",
  {
    onBeforeUploadBegin: (files) => files,
    onUploadBegin: (name) => console.log("Beginning", name),
    onClientUploadComplete: (res) => console.log("Done", res),
    onUploadProgress: (p) => console.log("Progress", p),
  },
);
```

**Key Insights:**

1. **Endpoint as string literal** - TypeScript narrows to specific route
2. **Lifecycle callbacks are optional** - progressive enhancement, not all-or-nothing
3. **Type inference flows through** - `res` in `onClientUploadComplete` knows the route's output type
4. **Returns stable API** - `startUpload`, `isUploading`, `routeConfig` (not the whole store)

### Component Generation

**Pattern:** Similar factory for pre-built components

```typescript
export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
```

**Usage:**

```typescript
<UploadButton
  endpoint={(routeRegistry) => routeRegistry.videoAndImage}
  onClientUploadComplete={(res) => console.log(res)}
  config={{ appendOnPaste: true, mode: "manual" }}
/>
```

**Key Insights:**

1. **Callback receives route registry** - autocomplete shows all available endpoints
2. **Components have same lifecycle hooks** - consistent API between hook and component usage
3. **Config is separate prop** - UI behavior vs lifecycle logic

---

## 3. What Makes DX Feel Simple?

### Type Safety Without Verbosity

**Zero manual type annotations:**

```typescript
// Server
export const uploadRouter = { /* ... */ };
export type OurFileRouter = typeof uploadRouter; // ← Inference

// Client
export const { useUploadThing } = generateReactHelpers<OurFileRouter>(); // ← Generic bound once
const { startUpload } = useUploadThing("videoAndImage"); // ← String literal, fully typed
```

**Contrast with verbose alternatives:**

```typescript
// ❌ What uploadthing DOESN'T make you do:
const { startUpload } = useUploadThing<OurFileRouter, "videoAndImage">("videoAndImage");
```

### Progressive Disclosure

**Minimal example (3 files):**

```
src/server/uploadthing.ts      ← Define routes
src/app/api/uploadthing/route.ts ← Register handler
src/utils/uploadthing.ts        ← Generate helpers
```

**Advanced features opt-in:**

- Custom error formatting? Pass `errorFormatter` to `createUploadthing`
- Custom file IDs? Return `[UTFiles]` from middleware
- Input validation? Chain `.input(zodSchema)`
- SSR optimization? Add `<NextSSRPlugin>` to layout

### Single Source of Truth

**Router definition drives everything:**

```typescript
export const uploadRouter = {
  videoAndImage: f({ image: { maxFileSize: "32MB" } })
    .middleware(() => ({ userId: "123" }))
    .onUploadComplete(({ metadata }) => {
      metadata.userId; // ← Typed from middleware return
    }),
};
```

**Type flow:**

1. File route config → encoded in `FileRoute<TTypes>`
2. Middleware return → becomes `TMetadata` in `onUploadComplete`
3. `onUploadComplete` return → becomes hook's `res` type
4. Router object → extracted to `OurFileRouter` type
5. `OurFileRouter` → bound to `generateReactHelpers<T>`
6. Hook endpoint string → narrows to specific route's types

### Escape Hatches

**When you need lower-level access:**

```typescript
// Hook returns the uploader primitives too
const { uploadFiles, routeRegistry } = generateReactHelpers<OurFileRouter>();

// Use outside of React
await uploadFiles("videoAndImage", { files, input });
```

**SSR data prefetch:**

```typescript
// Server Component
const routeConfig = extractRouterConfig(uploadRouter);
<NextSSRPlugin routerConfig={routeConfig} />

// Client hook doesn't need to fetch config
const { routeConfig } = useUploadThing("videoAndImage"); // ← Reads from globalThis
```

---

## 4. Patterns We Can Steal

### ✅ Builder API with Type Accumulation

**What:** Fluent chainable methods that progressively build up types

**Apply to OpenCode:**

```typescript
// Instead of monolithic config object:
const client = createOpencodeClient({
  directory: "/path",
  onSessionUpdate: (session) => { /* ... */ },
  onMessageUpdate: (message) => { /* ... */ },
  // ... 15 more options
});

// Use builder:
const client = createOpencodeClient()
  .directory("/path")
  .onSessionUpdate((session) => { /* ... */ })
  .onMessageUpdate((message) => { /* ... */ });
```

**Benefits:**

- Each method call can update `TParams` generic (like uploadthing's `UploadBuilder<TParams>`)
- Better autocomplete (shows available methods based on current state)
- Optional configuration is truly optional (no `| undefined` everywhere)

### ✅ Framework-Specific Adapter Exports

**What:** Separate entry points per framework (`uploadthing/next`, `uploadthing/express`)

**Apply to OpenCode:**

```typescript
// packages/core/src/adapters/next.ts
export { createOpencodeClient } from "../client";
export { createRouteHandler } from "./next-handler";

// packages/core/src/adapters/express.ts
export { createOpencodeClient } from "../client";
export { createExpressMiddleware } from "./express-handler";
```

**Benefits:**

- Tree-shaking (Next.js apps don't bundle Express code)
- Framework-specific types injected at adapter level
- Clearer mental model (import from framework-specific path)

### ✅ generateReactHelpers Factory Pattern

**What:** User creates typed helper file, not direct imports

**Apply to OpenCode:**

```typescript
// apps/web/src/lib/opencode.ts
import { generateReactHelpers } from "@opencode/react";

export const {
  useSession,
  useMessages,
  useSSE,
  SessionProvider,
} = generateReactHelpers({
  baseUrl: "http://localhost:3000",
  directory: process.cwd(),
});
```

**Benefits:**

- Configuration bound once, not repeated at every hook call
- User controls what to export (can re-export subset)
- Easy to mock in tests (mock `~/lib/opencode` instead of `@opencode/react`)

### ✅ Symbol-Based Metadata Markers

**What:** Use symbols for "special" return values that don't pollute user's data

**Apply to OpenCode:**

```typescript
// Instead of reserved key names:
.middleware(() => ({
  userId: "123",
  __internalFiles: [...], // ← Conflicts if user has `__internalFiles` field
}))

// Use symbols:
import { UTFiles } from "@opencode/core";
.middleware(() => ({
  userId: "123",
  [UTFiles]: [...], // ← Guaranteed no conflict
}))
```

**Benefits:**

- No reserved key name collisions
- Clear intent (symbol imports signal "framework-level concern")
- TypeScript can omit symbols from user-facing types (`Omit<T, typeof UTFiles>`)

### ✅ SSR Plugin Pattern (globalThis Hydration)

**What:** Server-side plugin injects data into `globalThis`, hydrates to client via script tag

**Apply to OpenCode:**

```typescript
// Server Component (app/layout.tsx)
import { OpencodeSSRPlugin } from "@opencode/react/next-ssr-plugin";

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <OpencodeSSRPlugin config={{ directory: "/path" }} />
        {children}
      </body>
    </html>
  );
}

// Client Component
const { directory } = useOpencodeConfig(); // ← Reads from globalThis, no fetch needed
```

**Benefits:**

- Zero client fetches for static config
- Works with React Server Components (no client context needed)
- Progressive enhancement (hook falls back to fetch if globalThis not set)

### ✅ Endpoint Selection via Callback (for Components)

**What:** Components take callback that receives route registry for autocomplete

**Apply to OpenCode:**

```typescript
// Instead of string prop:
<SessionList session={(routes) => routes.currentSession} />

// Autocomplete shows all available sessions
```

**Benefits:**

- Better DX than string (autocomplete + type errors)
- Can validate at build time (TypeScript error if route doesn't exist)

### ⚠️ DON'T Steal: Effect-TS in Public API

**What uploadthing does:** Uses Effect-TS internally for config, adapters, error handling

**Why they can do it:**

- Effect is hidden behind adapters (users never see `Effect.gen`)
- Public API is plain Promises and callbacks

**Why we should avoid:**

- OpenCode is already Effect-heavy internally
- Risk: Effect leaking into user-facing API
- Better: Keep Effect in service layer, expose vanilla TS at SDK boundary

**If we use Effect internally:**

```typescript
// ✅ GOOD - Effect hidden
export async function createSession(opts: CreateSessionOpts): Promise<Session> {
  return Effect.runPromise(
    SessionService.create(opts).pipe(/* ... */)
  );
}

// ❌ BAD - Effect exposed
export function createSession(opts: CreateSessionOpts): Effect.Effect<Session, SessionError> {
  return SessionService.create(opts);
}
```

---

## Summary: Core Takeaways

1. **Builder pattern > config object** - Progressive type accumulation, better autocomplete
2. **Framework adapters at package boundaries** - `@opencode/next`, `@opencode/express`
3. **User-created helper file** - `generateReactHelpers()` binds config once
4. **Symbols for special metadata** - Avoid reserved key collisions
5. **SSR via globalThis hydration** - Zero client fetches for static config
6. **Type inference over annotations** - `typeof router` → generic bound once → string literals everywhere else
7. **Progressive disclosure** - Minimal example is 3 files, advanced features opt-in
8. **Keep Effect internal** - Don't let it leak into public SDK API

---

## Files Worth Reading

- `packages/uploadthing/src/_internal/upload-builder.ts` - Builder type accumulation magic
- `packages/react/src/use-uploadthing.ts` - `generateReactHelpers` implementation
- `packages/uploadthing/src/next.ts` - Framework adapter pattern
- `packages/react/src/next-ssr-plugin.tsx` - globalThis hydration technique
- `examples/minimal-appdir/` - Complete working example (3 files)

**Total uploadthing codebase insight: ~2 hours of exploration, patterns applicable to OpenCode's @opencode/core + @opencode/react split.**
