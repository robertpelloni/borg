# ADR 005: OpenCode Vibe Package Extraction

**Status:** Proposed  
**Date:** 2025-12-29  
**Authors:** AI Swarm (Claude Code)  
**Epic:** opencode-next--xts0a-mjrn4xx251c

---

## Context

The `opencode-next` project contains a **framework-agnostic Effect-based router** and **React bindings** that are decoupled from OpenCode-specific logic. This represents reusable patterns for any Effect-based API client.

### Current Pain Points

1. **No reuse** - Router and React patterns locked in single app
2. **No versioning** - Can't track breaking changes to internal APIs
3. **Hard to test in isolation** - Router tests run alongside app tests
4. **Maintenance burden** - Changes require full app rebuild/deploy

### What We're Extracting

**Core Router** (`apps/web/src/core/router/`):

- 17 production files, 16 test files (100% coverage)
- Zero React dependencies
- Zero Next.js dependencies (adapters are optional)
- Zero OpenCode-specific dependencies (SDK injected via context)

**React Bindings** (`apps/web/src/react/`, `apps/web/src/atoms/`):

- 20+ hooks consuming router and Zustand store
- 9 atom modules (Phase 1 interim, may evolve to effect-atom)
- 2 Zustand stores (one for reactive state, one for UI state)

### Why Extract Now?

- **Router is stable** - 4-layer architecture, no circular deps
- **React hooks are mature** - Proven patterns, no major changes expected
- **Migration is clean** - Import path changes only, zero API changes
- **TDD complete** - 100% test coverage, safe to extract

---

## Decision

Extract into **two packages**:

1. **`@opencode-vibe/router`** - Framework-agnostic Effect core
2. **`@opencode-vibe/react`** - React bindings, depends on router

### Why Two Packages?

- **Router is universal** - Works in browser, Node, Bun, Deno, CLI, desktop (Tauri)
- **React is specific** - Only useful for React apps
- **Version independence** - Router can evolve faster than React bindings
- **Clear boundaries** - Router has zero React imports

---

## Package Designs

### @opencode-vibe/router

**Purpose**: Framework-agnostic Effect-based router with streaming, retry, and middleware.

#### Package Structure

```
@opencode-vibe/router/
├── src/
│   ├── index.ts           # Public API
│   ├── builder.ts         # Fluent route builder
│   ├── router.ts          # Router factory & resolution
│   ├── executor.ts        # Route execution engine
│   ├── stream.ts          # Streaming support
│   ├── types.ts           # Core types
│   ├── errors.ts          # Tagged errors
│   ├── schedule.ts        # Duration parsing, retry schedules
│   ├── routes.ts          # Example routes (OPTIONAL)
│   └── adapters/
│       ├── direct.ts      # RSC/CLI direct caller
│       └── next.ts        # Next.js handlers & Server Actions
├── dist/                  # Unbundled ESM build
├── package.json
├── tsconfig.json
└── README.md
```

#### Public API

```typescript
// Core router
export { createRouter, createOpencodeRoute };

// Adapters
export { createCaller } from "./adapters/direct";
export { createNextHandler, createAction } from "./adapters/next";

// Example routes (users can define their own)
export { createRoutes } from "./routes";

// Error types
export {
  ValidationError,
  TimeoutError,
  HandlerError,
  StreamError,
  HeartbeatTimeoutError,
  MiddlewareError,
  RouteNotFoundError,
} from "./errors";

// Utilities
export { parseDuration, buildSchedule } from "./schedule";

// Types
export type {
  Duration,
  RetryConfig,
  RouteConfig,
  HandlerContext,
  HandlerFn,
  MiddlewareFn,
  Route,
  RouteBuilder,
};
```

#### Dependencies

```json
{
  "peerDependencies": {
    "effect": "^3.19.0"
  },
  "devDependencies": {
    "effect": "^3.19.13",
    "typescript": "^5.7.3",
    "@types/bun": "latest"
  }
}
```

**Zero runtime dependencies** beyond Effect (peer dependency).

#### Distribution

**Unbundled ESM** (no bundler):

- TypeScript compiles `.ts` → `.mjs` + `.d.mts`
- Source maps for debugging
- Tree-shakeable (consumers import only what they need)
- Works everywhere (Bun, Node 18+, browsers, Deno)

#### Usage Example

```typescript
import {
  createOpencodeRoute,
  createRouter,
  createCaller,
} from "@opencode-vibe/router";
import { Schema } from "effect";

// Define routes
const o = createOpencodeRoute();

const routes = {
  session: {
    get: o({ timeout: "30s" })
      .input(Schema.Struct({ id: Schema.String }))
      .handler(async ({ input, sdk }) => {
        return await sdk.session.get({ path: { id: input.id } });
      }),

    list: o({ timeout: "10s" }).handler(async ({ sdk }) => {
      return await sdk.session.list();
    }),
  },
};

// Create router
const router = createRouter(routes);

// Invoke routes directly (RSC, CLI, desktop)
const caller = createCaller(router, { sdk: createClient() });
const session = await caller("session.get", { id: "ses_123" });
```

---

### @opencode-vibe/react

**Purpose**: React bindings for OpenCode router with Zustand state management.

#### Package Structure

```
@opencode-vibe/react/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── providers/
│   │   ├── index.ts                # Provider exports
│   │   ├── opencode-provider.tsx   # OpencodeProvider
│   │   └── sse-provider.tsx        # SSEProvider
│   ├── hooks/
│   │   ├── index.ts                # Hook exports
│   │   ├── use-opencode.ts         # Context hook
│   │   ├── use-sse.ts              # SSE context hook
│   │   ├── use-session.ts          # Session selector
│   │   ├── use-messages.ts         # Messages selector
│   │   ├── use-session-status.ts   # Status selector
│   │   ├── use-compaction-state.ts # Compaction selector
│   │   ├── use-context-usage.ts    # Context usage selector
│   │   ├── use-messages-with-parts.ts # Derived messages+parts
│   │   ├── use-send-message.ts     # Send message action
│   │   ├── use-create-session.ts   # Create session action
│   │   ├── use-providers.ts        # Provider list action
│   │   ├── use-file-search.ts      # File search action
│   │   ├── use-commands.ts         # Commands list action
│   │   └── use-multi-server-sse.ts # Multi-server SSE
│   ├── store/
│   │   ├── index.ts                # Store exports (internal)
│   │   ├── store.ts                # Zustand store
│   │   └── binary.ts               # Binary search utilities
│   └── types/
│       ├── index.ts                # Type exports
│       ├── session.ts              # Session types
│       ├── message.ts              # Message types
│       ├── provider.ts             # Provider types
│       └── events.ts               # SSE event types
├── package.json
├── tsconfig.json
└── README.md
```

#### Public API

```typescript
// Providers
export { OpencodeProvider, SSEProvider } from "./providers";

// Context Hooks
export { useOpencode, useSSE } from "./hooks";

// Data Hooks (Selectors)
export { useSession, useSessions } from "./hooks";
export { useMessages, useMessagesWithParts } from "./hooks";
export { useSessionStatus, useCompactionState, useContextUsage } from "./hooks";

// Action Hooks
export { useSendMessage, useCreateSession } from "./hooks";
export { useProviders, useFileSearch, useCommands } from "./hooks";

// Multi-Server
export { useMultiServerSSE } from "./hooks";

// Types
export type { Session, Message, Part, SessionStatus };
export type { Provider, Model, SlashCommand };
export type { GlobalEvent, EventPayload };
export type { UseSendMessageOptions, UseSendMessageReturn };
// ... more types
```

**Internal (NOT exported)**:

- Zustand store (`useOpencodeStore`) - Accessed only via hooks
- Binary search utilities - Performance optimization detail
- Atoms (Phase 1 interim) - May change with effect-atom

#### Dependencies

```json
{
  "dependencies": {
    "@opencode-vibe/router": "workspace:*",
    "zustand": "^5.0.0",
    "immer": "^10.0.0",
    "eventsource-parser": "^3.0.0",
    "fuzzysort": "^3.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  }
}
```

#### Usage Example

```tsx
import {
  SSEProvider,
  OpencodeProvider,
  useSession,
  useSendMessage,
} from "@opencode-vibe/react";

// Setup (app/layout.tsx)
export default function RootLayout({ children }) {
  return (
    <SSEProvider url="http://localhost:4056">
      <OpencodeProvider
        url="http://localhost:4056"
        directory="/path/to/project"
      >
        {children}
      </OpencodeProvider>
    </SSEProvider>
  );
}

// Usage (app/session/[id]/page.tsx)
function SessionPage({ params }) {
  const session = useSession(params.id);
  const { sendMessage, isLoading } = useSendMessage({ sessionId: params.id });

  return (
    <div>
      <h1>{session?.title}</h1>
      <PromptInput
        onSubmit={(text) => sendMessage([{ type: "text", text }])}
        disabled={isLoading}
      />
    </div>
  );
}
```

---

## Migration Strategy

### Phase 1: Extract Router Package (4-6 hours)

#### Step 1: Create Package Scaffold

```bash
# In repo root
mkdir -p packages/router/src
cd packages/router

# Create package.json
cat > package.json <<EOF
{
  "name": "@opencode-vibe/router",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./adapters/direct": {
      "types": "./dist/adapters/direct.d.mts",
      "import": "./dist/adapters/direct.mjs"
    },
    "./adapters/next": {
      "types": "./dist/adapters/next.d.mts",
      "import": "./dist/adapters/next.mjs"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc --project tsconfig.build.json",
    "test": "bun test",
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "effect": "^3.19.0"
  },
  "devDependencies": {
    "effect": "^3.19.13",
    "typescript": "^5.7.3",
    "@types/bun": "latest"
  }
}
EOF
```

#### Step 2: Copy Router Files

```bash
# Copy all router files preserving structure
cp -r apps/web/src/core/router/* packages/router/src/

# Verify structure
ls -R packages/router/src/
# Output should show:
# index.ts, builder.ts, router.ts, executor.ts, stream.ts,
# types.ts, errors.ts, schedule.ts, routes.ts,
# adapters/direct.ts, adapters/next.ts
# + all .test.ts files
```

#### Step 3: Update Imports

**Pattern**: Relative imports use `.js` extensions (ESM requirement).

```typescript
// Keep this pattern
import type { Route } from "./types.js";
import { executeRoute } from "./executor.js";
```

**No changes needed** - Imports already use `.js` extensions.

#### Step 4: Create tsconfig.json

```bash
cat > tsconfig.json <<EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF
```

#### Step 5: Build & Test

```bash
# Build
bun run build

# Run tests
bun test

# Type check
bun run type-check
```

#### Step 6: Publish to npm

```bash
# Dry run
npm publish --dry-run

# Publish
npm publish --access public
```

---

### Phase 2: Extract React Package (6-8 hours)

#### Step 1: Create Package Scaffold

```bash
mkdir -p packages/react/src/{providers,hooks,store,types}
cd packages/react

cat > package.json <<EOF
{
  "name": "@opencode-vibe/react",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./providers": {
      "types": "./dist/providers/index.d.mts",
      "import": "./dist/providers/index.mjs"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.mts",
      "import": "./dist/hooks/index.mjs"
    }
  },
  "dependencies": {
    "@opencode-vibe/router": "^0.1.0",
    "zustand": "^5.0.0",
    "immer": "^10.0.0",
    "eventsource-parser": "^3.0.0",
    "fuzzysort": "^3.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  }
}
EOF
```

#### Step 2: Copy React Files

```bash
# Copy providers
cp apps/web/src/react/provider.tsx packages/react/src/providers/opencode-provider.tsx
cp apps/web/src/react/use-sse.tsx packages/react/src/providers/sse-provider.tsx

# Copy hooks
cp apps/web/src/react/use-*.ts packages/react/src/hooks/

# Copy store
cp apps/web/src/react/store.ts packages/react/src/store/
cp apps/web/src/lib/binary.ts packages/react/src/store/

# Copy types (extract from atoms/types)
# ... create type files from app types
```

#### Step 3: Update Imports

**Before**:

```typescript
import { createRouter } from "@/core/router";
import { useOpencodeStore } from "@/react/store";
```

**After**:

```typescript
import { createRouter } from "@opencode-vibe/router";
import { useOpencodeStore } from "../store"; // Internal only
```

#### Step 4: Create Index Files

```typescript
// src/index.ts
export * from "./providers";
export * from "./hooks";
export * from "./types";

// src/providers/index.ts
export { OpencodeProvider } from "./opencode-provider";
export { SSEProvider } from "./sse-provider";
export type { OpencodeProviderProps, SSEProviderProps };

// src/hooks/index.ts
export { useOpencode } from "./use-opencode";
export { useSSE } from "./use-sse";
export { useSession, useSessions } from "./use-session";
export { useMessages, useMessagesWithParts } from "./use-messages";
// ... all hooks
```

#### Step 5: Build & Test

```bash
bun run build
bun test
bun run type-check
```

#### Step 6: Publish

```bash
npm publish --access public
```

---

### Phase 3: Integrate in opencode-next (2-3 hours)

#### Step 1: Add Dependencies

```bash
cd apps/web
bun add @opencode-vibe/router@latest
bun add @opencode-vibe/react@latest
```

#### Step 2: Update Imports (Automated)

```bash
# Use find + sed to update all imports
find apps/web/src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's|@/core/router|@opencode-vibe/router|g' \
  -e 's|@/react/provider|@opencode-vibe/react|g' \
  -e 's|@/react/use-|@opencode-vibe/react/hooks/use-|g'
```

**Files affected**:

- `apps/web/src/app/api/router/route.ts` - Next.js handler
- `apps/web/src/app/actions.ts` - Server Actions
- All RSC pages using `createCaller`
- All components using hooks

#### Step 3: Remove Old Files

```bash
# After verifying everything works
rm -rf apps/web/src/core/router/
rm -rf apps/web/src/react/
```

**Keep in app** (OpenCode-specific):

- `apps/web/src/core/client.ts` - SDK client factory
- `apps/web/src/core/discovery.ts` - Browser discovery
- `apps/web/src/core/server-discovery.ts` - Node.js lsof discovery
- `apps/web/src/core/server-routing.ts` - Pure routing logic
- `apps/web/src/core/multi-server-sse.ts` - SSE manager
- `apps/web/src/atoms/` - Phase 1 interim (may extract later)

#### Step 4: Verify

```bash
# Type check
bun run typecheck

# Build
bun run build

# Run tests
bun test

# Start dev server
bun dev
```

---

## Breaking Changes

### For Consumers (None Expected)

**Zero breaking changes** - API surface is identical, only import paths change.

**Before**:

```typescript
import { createRouter } from "@/core/router";
import { useSession } from "@/react/use-session";
```

**After**:

```typescript
import { createRouter } from "@opencode-vibe/router";
import { useSession } from "@opencode-vibe/react";
```

### For Internal Implementation

1. **Store not exported** - `useOpencodeStore` is internal, use hooks instead
2. **Binary utilities not exported** - Internal optimization
3. **Atoms excluded** - Stay in app for now (Phase 1 interim)

---

## Consequences

### Positive

1. **Reusable patterns** - Router and React bindings can be used in other projects
2. **Versioning** - Can track breaking changes via semver
3. **Isolated testing** - Packages can be tested independently
4. **Faster CI** - Package tests run separately from app tests
5. **Documentation** - Force us to document public API
6. **Community** - Open source packages can get external contributions

### Negative

1. **Maintenance overhead** - Two packages to maintain instead of one
2. **Version coordination** - React package depends on router package
3. **Release process** - Need to publish packages before using in app
4. **Circular dev** - Changes require publish → update → test cycle

### Mitigations

1. **Workspace protocol** - Use `workspace:*` in monorepo for development
2. **Automated releases** - CI publishes on merge to main
3. **Changesets** - Use changesets for versioning and changelog
4. **Turborepo** - Caching prevents redundant builds

---

## Timeline

### Week 1: Router Package (Jan 29 - Feb 2)

- [x] ADR 005 (this document) - 4 hours
- [ ] Extract router package - 4 hours
- [ ] Test in isolation - 1 hour
- [ ] Publish to npm - 1 hour
- [ ] Documentation (README, API docs) - 2 hours

**Total: 12 hours**

### Week 2: React Package (Feb 3 - Feb 9)

- [ ] Extract React package - 6 hours
- [ ] Test in isolation - 2 hours
- [ ] Publish to npm - 1 hour
- [ ] Documentation (README, API docs, examples) - 3 hours

**Total: 12 hours**

### Week 3: Integration (Feb 10 - Feb 16)

- [ ] Integrate packages in opencode-next - 2 hours
- [ ] Update all imports (automated) - 1 hour
- [ ] Remove old files - 0.5 hours
- [ ] Verify build/tests - 0.5 hours
- [ ] Migration guide - 2 hours

**Total: 6 hours**

### Total Effort: 30 hours (1 week full-time or 2 weeks part-time)

---

## Success Criteria

Extraction is successful when:

1. ✅ **Zero breaking changes** - Existing opencode-next code works with new packages
2. ✅ **100% test coverage** - All tests pass in extracted packages
3. ✅ **Published to npm** - `@opencode-vibe/router@0.1.0` and `@opencode-vibe/react@0.1.0`
4. ✅ **Integrated in opencode-next** - App uses published packages
5. ✅ **Documentation complete** - README, API docs, migration guide, examples
6. ✅ **No React dependencies in router** - Truly framework-agnostic
7. ✅ **Works in multiple runtimes** - Bun, Node 18+, browsers, Deno

---

## References

### Internal Documentation

- [005-inventory-core.md](scratch/005-inventory-core.md) - Core router inventory (42KB)
- [005-inventory-react.md](scratch/005-inventory-react.md) - React layer inventory (30KB)
- [005-router-design.md](scratch/005-router-design.md) - Router package API design (33KB)
- [005-react-design.md](scratch/005-react-design.md) - React package API design (36KB)

### Related ADRs

- [ADR 001: Next.js Rebuild](001-nextjs-rebuild.md) - Why Next.js 16 over SolidJS
- [ADR 002: Effect Migration](002-effect-migration.md) - Effect-based architecture
- [ADR 004: Effect Atom Migration](004-effect-atom-migration.md) - Atoms pattern (Phase 1 interim)

### External References

- [Effect Documentation](https://effect.website) - Effect runtime and patterns
- [Zustand Documentation](https://zustand.docs.pmnd.rs) - State management
- [Turborepo Documentation](https://turbo.build/repo/docs) - Monorepo orchestration
- [Changesets](https://github.com/changesets/changesets) - Versioning and changelog

---

## Appendix: File Checklist

### Router Package Files to Extract

**Core**:

- [x] `router/index.ts` - Public API
- [x] `router/types.ts` - Core types
- [x] `router/errors.ts` - Tagged errors
- [x] `router/schedule.ts` - Duration parsing, retry schedules
- [x] `router/builder.ts` - Fluent route builder
- [x] `router/executor.ts` - Route execution engine
- [x] `router/stream.ts` - Streaming support
- [x] `router/router.ts` - Route resolution
- [x] `router/routes.ts` - Example route definitions

**Adapters**:

- [x] `router/adapters/direct.ts` - RSC direct caller
- [x] `router/adapters/next.ts` - Next.js handlers & Server Actions

**Tests** (16 total):

- [x] All `.test.ts` files corresponding to above

### React Package Files to Extract

**Providers**:

- [x] `react/provider.tsx` → `providers/opencode-provider.tsx`
- [x] `react/use-sse.tsx` → `providers/sse-provider.tsx`

**Hooks** (13 total):

- [x] `react/use-opencode.ts` → `hooks/use-opencode.ts`
- [x] `react/use-session.ts` → `hooks/use-session.ts`
- [x] `react/use-messages.ts` → `hooks/use-messages.ts`
- [x] `react/use-session-status.ts` → `hooks/use-session-status.ts`
- [x] `react/use-compaction-state.ts` → `hooks/use-compaction-state.ts`
- [x] `react/use-context-usage.ts` → `hooks/use-context-usage.ts`
- [x] `react/use-messages-with-parts.ts` → `hooks/use-messages-with-parts.ts`
- [x] `react/use-send-message.ts` → `hooks/use-send-message.ts`
- [x] `react/use-create-session.ts` → `hooks/use-create-session.ts`
- [x] `react/use-providers.ts` → `hooks/use-providers.ts`
- [x] `react/use-file-search.ts` → `hooks/use-file-search.ts`
- [x] `react/use-commands.ts` → `hooks/use-commands.ts`
- [x] `react/use-multi-server-sse.ts` → `hooks/use-multi-server-sse.ts`

**Store**:

- [x] `react/store.ts` → `store/store.ts` (internal)
- [x] `lib/binary.ts` → `store/binary.ts` (internal)

**Types**:

- [x] Extract types from atoms/types → `types/session.ts`, `types/message.ts`, etc.

### Files to KEEP in opencode-next App

**OpenCode-specific**:

- [x] `core/client.ts` - SDK client factory
- [x] `core/discovery.ts` - Browser-specific discovery
- [x] `core/server-discovery.ts` - Node.js lsof discovery
- [x] `core/server-routing.ts` - Pure routing logic
- [x] `core/multi-server-sse.ts` - SSE connection manager
- [x] `core/poc.ts` - CLI testing script
- [x] `core/README.md` - Multi-server SSE docs

**Atoms** (Phase 1 interim):

- [x] `atoms/sse.ts` - Effect.Stream SSE (experimental)
- [x] `atoms/sessions.ts` - SDK wrapper
- [x] `atoms/messages.ts` - SDK wrapper
- [x] `atoms/parts.ts` - SDK wrapper
- [x] `atoms/providers.ts` - SDK wrapper
- [x] `atoms/projects.ts` - SDK wrapper
- [x] `atoms/servers.ts` - Multi-server discovery
- [x] `atoms/subagents.ts` - Subagent state

**UI Stores**:

- [x] `stores/prompt-store.ts` - Prompt input UI state
- [x] `stores/subagent-store.ts` - Deprecated, replaced by `atoms/subagents.ts`

---

## Next Steps

After approval:

1. **Create feature branch**: `feat/swarmtools-extraction`
2. **Phase 1**: Extract router package (4-6 hours)
3. **Phase 2**: Extract React package (6-8 hours)
4. **Phase 3**: Integrate in opencode-next (2-3 hours)
5. **Documentation**: README, API docs, migration guide (4-6 hours)
6. **PR Review**: Get Joel's approval
7. **Publish**: Release `@opencode-vibe/router@0.1.0` and `@opencode-vibe/react@0.1.0`

**Total estimated time**: 20-30 hours (1 week full-time or 2 weeks part-time)
