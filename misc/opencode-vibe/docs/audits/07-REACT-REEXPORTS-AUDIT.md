# Audit: React Re-exports vs packages/react

**Date**: 2025-12-30
**Agent**: BrightForest
**Cell**: opencode-next--xts0a-mjstkfzpllt

## Executive Summary

**Result**: `apps/web/src/react/` can be **DELETED ENTIRELY**.

It's a pure re-export layer with ZERO app-specific code. All hooks are implemented in `packages/react/`. The app layer adds no value and creates confusion.

## Findings

### 1. What's Duplicated?

**NOTHING is duplicated.** There's no code duplication - just a confusing re-export indirection.

**Current State**:

```typescript
// apps/web/src/react/index.ts (8 lines)
/**
 * React hooks for OpenCode
 *
 * Re-exports everything from @opencode-vibe/react package.
 * This ensures a single source of truth and avoids duplicate React contexts.
 */
export * from "@opencode-vibe/react"
```

**Reality**: This is a pointless middleman.

### 2. What's App-Specific vs Reusable?

| Location | Type | Status |
|----------|------|--------|
| `apps/web/src/react/` | Re-export layer | **DELETE IT** |
| `packages/react/` | All hooks + providers | **KEEP - Source of Truth** |

**App-specific code**: NONE. The app layer is empty.

**Evidence from codebase search**:

- Only 6 imports use `@opencode-vibe/react` directly
- All other imports use `@/react` (the re-export layer)
- The re-export adds ZERO value - just path indirection

### 3. Should apps/web/src/react/ Be Deleted?

**YES. Immediately.**

**Reasons**:

1. **Zero app-specific code** - it's just `export * from package`
2. **Confusing for developers** - two import paths for same thing:
   - `import { useSession } from "@opencode-vibe/react"` ✅ Direct
   - `import { useSession } from "@/react"` ❌ Unnecessary indirection
3. **Violates DRY** - maintenance burden with no benefit
4. **Migration Already Complete** - all hooks moved to package already

**What the README Promised (But Never Happened)**:

```markdown
# @opencode/react (future package)

This folder will be extracted to `packages/react` when patterns stabilize.

## Extraction Trigger

Extract to `packages/react` after **third use** of a pattern.
```

**Reality**: The extraction ALREADY HAPPENED. The folder is now just a zombie re-export layer.

## Detailed Inventory

### packages/react/src/index.ts (124 lines - SOURCE OF TRUTH)

**Exports ALL of these hooks** (organized by category):

#### Data Fetching (Core)
- `useSession` + types
- `useSessionList` + types
- `useSessionStatus` + types
- `useMessages` + types
- `useParts` + types
- `useMessagesWithParts` + types (composite hook)
- `useProjects`, `useCurrentProject` + types

#### Real-time (SSE)
- `useSSE` + types
- `useMultiServerSSE` + types

#### Subagents
- `useSubagents` + types
- `useSubagent` + types
- `useSubagentSync` + types

#### State Management
- `useContextUsage`, `formatTokens` + types
- `useCompactionState` + types

#### Actions
- `useSendMessage` + types
- `useCreateSession`
- `useProvider` + types
- `useProviders` + types
- `useCommands`

#### Utilities
- `useLiveTime`
- `useFileSearch` + types

#### Providers
- `OpencodeProvider` + types
- `useOpencode` + types
- `SSEProvider` + types

#### Re-exports from Core
- `Session`, `Message`, `Part` types from `@opencode-vibe/core/types`

#### Effect-based Hooks (Phase 3b)
- `useServers`, `useServersEffect`, `useCurrentServer` + types

### packages/react/src/hooks/index.ts (111 lines)

**Organized export structure** (better than main index):

```typescript
// === Generic Hooks ===
useFetch + types

// === Data Fetching ===
useSessionList, useSession, useSessionStatus, useMessages, useParts, 
useMessagesWithParts, useProjects, useCurrentProject, useServers, 
useCurrentServer, useProviders

// === Real-time (SSE) ===
useSSE, useMultiServerSSE, useSubscription

// === Subagents ===
useSubagents, useSubagent, useSubagentSync

// === State Management ===
useContextUsage, formatTokens, useCompactionState

// === Actions ===
useSendMessage, useCreateSession, useCommands

// === Utilities ===
useLiveTime, useFileSearch
```

### packages/react/src/providers/index.ts (13 lines)

```typescript
OpencodeProvider, useOpencode + types
SSEProvider, useSSE + types (WRONG - useSSE should be hook not provider export)
```

**BUG DETECTED**: `SSEProvider` exports `useSSE` but that's a hook, not provider context. This is naming confusion.

### apps/web/src/react/index.ts (8 lines - ZOMBIE)

```typescript
export * from "@opencode-vibe/react"
```

**Purpose**: NONE. Pure indirection.

**Justification in comments**: "ensures single source of truth" - but the source IS the package, not this re-export!

## Current Import Patterns (From Grep)

### Direct Package Imports (6 occurrences)
```typescript
// ✅ CORRECT - Direct from source
import { useServersEffect } from "@opencode-vibe/react"
import type { Message, Part } from "@opencode-vibe/react"
```

### Re-export Layer Imports (14+ occurrences)
```typescript
// ❌ UNNECESSARY INDIRECTION
import { useSession } from "@/react"
import { useSSE } from "@/react"
import { useProviders } from "@/react"
// ... etc
```

**Files Using Re-export Layer**:
- `apps/web/src/app/provider/[id]/provider-detail.tsx`
- `apps/web/src/app/projects-list.tsx`
- `apps/web/src/app/providers.tsx`
- `apps/web/src/app/session/[id]/*.tsx` (multiple)
- `apps/web/src/components/prompt/PromptInput.tsx`
- `apps/web/src/components/ai-elements/*.tsx` (multiple)

## Comparison to uploadthing DX

**uploadthing pattern**:
```typescript
// ONE import path
import { UploadButton, useUploadThing } from "@uploadthing/react"
```

**Current opencode pattern**:
```typescript
// TWO import paths (confusing!)
import { useSession } from "@opencode-vibe/react"  // Direct
import { useSession } from "@/react"              // Re-export (why?)
```

**Goal**: uploadthing-style DX = ONE import path, no confusion.

## Recommendation

### Phase 1: Delete Re-export Layer (IMMEDIATE)

1. **Delete**: `apps/web/src/react/` folder entirely
2. **Update**: All imports from `@/react` → `@opencode-vibe/react`
3. **Verify**: TypeScript compiles, tests pass

**Codemod Pattern**:
```bash
# Find all imports
rg "from \"@/react\"" apps/web/src -l

# Replace with direct package import
sed -i '' 's/from "@\/react"/from "@opencode-vibe\/react"/g' apps/web/src/**/*.{ts,tsx}
```

### Phase 2: Fix Provider Exports (FOLLOW-UP)

**Issue**: `packages/react/src/providers/index.ts` exports `useSSE` hook from `SSEProvider` module.

**Confusion**:
```typescript
// Current (confusing)
import { useSSE } from "./providers/sse-provider"  // Why is hook in provider file?

// Should be
import { useSSE } from "./hooks/use-sse"          // Hook belongs with hooks
```

**Fix**: Move `useSSE` export to hooks index, keep only context in provider exports.

### Phase 3: Clean Up packages/react/src/index.ts (OPTIONAL)

**Current**: 124 lines of explicit re-exports (verbose but clear)

**Option A**: Keep as-is (explicit is better than implicit)
**Option B**: Re-export from sub-indexes:
```typescript
export * from "./hooks"
export * from "./providers"
export type { Session, Message, Part } from "@opencode-vibe/core/types"
```

**Recommendation**: Option A (keep explicit). The current structure is self-documenting.

## Migration Checklist

- [ ] Delete `apps/web/src/react/` folder
- [ ] Update all `@/react` imports → `@opencode-vibe/react` (codemod)
- [ ] Update `tsconfig.json` paths config (remove `@/react` alias)
- [ ] Run `bun run typecheck` - verify no errors
- [ ] Run `bun test` - verify tests pass
- [ ] Update `docs/AGENTS.md` - remove `apps/web/src/react/` references
- [ ] Fix provider exports bug (move `useSSE` to hooks index)

## Files to Modify

### Delete Entirely
- `apps/web/src/react/index.ts`
- `apps/web/src/react/README.md`
- `apps/web/src/react/` (directory)

### Update Imports (14+ files)
```
apps/web/src/app/provider/[id]/provider-detail.tsx
apps/web/src/app/projects-list.tsx
apps/web/src/app/providers.tsx
apps/web/src/app/session/[id]/debug-panel.tsx
apps/web/src/app/session/[id]/session-layout.tsx
apps/web/src/app/session/[id]/session-status.tsx
apps/web/src/app/session/[id]/model-selector.tsx
apps/web/src/app/session/[id]/new-session-button.tsx
apps/web/src/app/session/[id]/session-messages.tsx
apps/web/src/app/session/[id]/context-usage.tsx
apps/web/src/app/session/[id]/compaction-indicator.tsx
apps/web/src/components/prompt/PromptInput.tsx
apps/web/src/components/ai-elements/tool.tsx
apps/web/src/components/ai-elements/part-renderer.tsx
```

### Update Config
- `tsconfig.json` - remove `@/react` path alias
- `apps/web/tsconfig.json` - remove `@/react` path alias (if exists)

## Benefits of Deletion

1. **Uploadthing-style DX** - ONE import path, no confusion
2. **Less maintenance** - fewer files to update
3. **Clearer architecture** - package is source of truth
4. **Faster onboarding** - no "why are there two import paths?" questions
5. **Matches actual usage** - extraction already happened, folder is dead code

## Risks

**NONE.** The folder contains zero custom code. It's pure re-export plumbing.

## Conclusion

The `apps/web/src/react/` folder is a **zombie re-export layer** that outlived its purpose. The extraction to `packages/react/` already happened. The app layer adds ZERO value and creates confusion with dual import paths.

**Delete it. TODAY.**

---

**Audit Status**: ✅ COMPLETE
**Recommendation**: 🔥 DELETE `apps/web/src/react/` IMMEDIATELY
**Complexity**: LOW (pure re-export, no custom code)
**Risk**: NONE (safe to delete)
**Benefit**: HIGH (uploadthing-style DX achieved)
