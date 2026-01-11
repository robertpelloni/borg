# lib/ Layer Audit

**Date:** 2025-12-30  
**Cell:** opencode-next--xts0a-mjstkfzkfk0  
**Epic:** opencode-next--xts0a-mjstkfy3d1i  

---

## Executive Summary

The `apps/web/src/lib/` layer contains 4 files with **mixed concerns**. Two files are app-specific, one is redundant, and one is a generic utility.

**Recommendations:**

1. **client.ts** → **KEEP in web app** (Next-specific env vars, web-only usage)
2. **prompt-parsing.ts** → **DELETE** (pure re-export, no value)
3. **transform-messages.ts** → **KEEP in web app** (ai-elements-specific transform)
4. **utils.ts** → **KEEP** (standard shadcn/ui utility, belongs here)

---

## File Analysis

### 1. client.ts (65 lines)

**Purpose:** SDK client factory with smart routing via MultiServerSSE

**Current Location:** `apps/web/src/lib/client.ts`

**Dependencies:**
- `@opencode-ai/sdk/client` (createOpencodeClient)
- `@opencode-vibe/core/sse` (multiServerSSE)

**Exports:**
```typescript
export const OPENCODE_URL = process.env.NEXT_PUBLIC_OPENCODE_URL ?? "http://localhost:4056"
export function createClient(directory?: string, sessionId?: string): OpencodeClient
export const globalClient = createClient()
```

**Analysis:**

This file looks IDENTICAL to `packages/core/src/client/client.ts` (123 lines) BUT has a critical difference:

| File | Env Var | Routing |
|------|---------|---------|
| `apps/web/src/lib/client.ts` | `NEXT_PUBLIC_OPENCODE_URL` | Uses `multiServerSSE.getBaseUrlForSession()` |
| `packages/core/src/client/client.ts` | `NEXT_PUBLIC_OPENCODE_URL` | Uses `getClientUrl()` with `RoutingContext` param |

**Key Differences:**

1. **Web version** - Directly accesses `multiServerSSE` singleton (web-specific)
2. **Core version** - Accepts `RoutingContext` param (framework-agnostic)

**Usage:**
- `apps/web/src/app/projects-list.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/providers.tsx` (OPENCODE_URL only)
- `apps/web/src/app/session/[id]/page.tsx`

**Verdict:** ✅ **KEEP in web app**

**Reasoning:**
- Uses `process.env.NEXT_PUBLIC_OPENCODE_URL` (Next.js-specific env var)
- Directly accesses `multiServerSSE` singleton (web-only pattern)
- Only 4 usages, all within web app
- Core version exists for framework-agnostic use cases

**packages/core version** should be used by:
- CLI tools
- Desktop apps (Tauri)
- Non-Next.js React apps
- Server-side code that doesn't use multiServerSSE singleton

**web app version** should be used by:
- Next.js App Router components
- Next.js Client Components
- Anything that needs the multiServerSSE singleton

---

### 2. prompt-parsing.ts (16 lines)

**Purpose:** Re-export prompt parsing utilities from core

**Current Location:** `apps/web/src/lib/prompt-parsing.ts`

**Content:**
```typescript
export {
	parseFromDOM,
	getCursorPosition,
	setCursorPosition,
	renderPartsToDOM,
	detectAtTrigger,
	detectSlashTrigger,
} from "@opencode-vibe/core/utils"
```

**Analysis:**

This is a **pure re-export** with no added value. It exists for backward compatibility after prompt parsing utilities were moved to `packages/core/src/utils/prompt-parsing.ts`.

**Usage:** (checked via grep)
- No usages found in `apps/web/src`
- All consumers import directly from `@opencode-vibe/core/utils`

**Verdict:** 🗑️ **DELETE**

**Reasoning:**
- Zero added value (no transformations, no web-specific logic)
- No usages in web app (dead code)
- Consumers already import from `@opencode-vibe/core/utils`
- Adds an unnecessary indirection

**Migration:** None needed (no usages)

---

### 3. transform-messages.ts (245 lines)

**Purpose:** Transform OpenCode SDK types → ai-elements UIMessage types

**Current Location:** `apps/web/src/lib/transform-messages.ts`

**Dependencies:**
- `@opencode-ai/sdk/client` (Message, Part types)
- `ai` package (UIMessage type)

**Exports:**
```typescript
export type OpencodeMessage = { info: Message, parts: Part[] }
export type ExtendedUIMessage = UIMessage & { _opencode?: {...} }
export function transformPart(part: Part): SupportedUIPart | null
export function transformMessage(opencodeMsg: OpencodeMessage): ExtendedUIMessage
export function transformMessages(opencodeMessages: OpencodeMessage[]): UIMessage[]
```

**Analysis:**

This is a **view layer transform** specifically for the `ai` package's UIMessage format. It handles:

1. **Type mapping**: OpenCode Part types → ai-elements UIPart types
2. **Tool state mapping**: OpenCode tool states → ai-elements tool states
3. **Element name sanitization**: Tool names with invalid chars (< > &)
4. **Metadata preservation**: `_opencode` field for enhanced display
5. **Unsupported part filtering**: Returns `null` for parts that ai-elements can't render

**OpenCode-specific part types** (filtered out):
- `step-finish`, `snapshot`, `patch`, `agent`, `retry`, `compaction`
- These require custom components (not yet implemented)

**Usage:**
- `apps/web/src/app/session/[id]/session-messages.tsx`
- `apps/web/src/app/session/[id]/page.tsx`

**Verdict:** ✅ **KEEP in web app**

**Reasoning:**
- **ai-elements-specific** - Tightly coupled to `UIMessage` type from `ai` package
- **View layer concern** - Transforms data for rendering, not domain logic
- **App-specific decisions** - Which parts to show, how to sanitize, metadata to preserve
- **Not reusable** - Other apps using different UI libraries need different transforms

**Should this move to packages/?** 🚫 **NO**

A transform layer package would need to:
- Support multiple UI libraries (ai-elements, custom components, etc.)
- Be generic enough for different use cases
- Have stable APIs across apps

Current transform is **too specific** to:
- ai-elements UIMessage format
- Web app's display decisions
- Next.js rendering patterns

**Future:** If we build a desktop app (Tauri) or CLI that also uses ai-elements, THEN extract. Until then, YAGNI.

---

### 4. utils.ts (7 lines)

**Purpose:** Tailwind class merging utility (shadcn/ui standard)

**Current Location:** `apps/web/src/lib/utils.ts`

**Content:**
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
```

**Analysis:**

This is the **standard shadcn/ui utility** for merging Tailwind classes. It's in every shadcn/ui-based app.

**Usage:**
- Used throughout `apps/web/src/components/ui/*` (shadcn components)
- Used in app components for conditional styling

**Verdict:** ✅ **KEEP**

**Reasoning:**
- **Standard pattern** - Every shadcn/ui app has this exact file
- **App-specific concern** - Tied to Tailwind config, not a library utility
- **Stable location** - `lib/utils.ts` is the convention

**Should this move to packages/react?** 🚫 **NO**

This is a **web app styling utility**, not a React hook or reusable component. It depends on:
- Tailwind CSS config (app-specific)
- clsx and tailwind-merge versions (app-specific)

If we build a desktop app (Tauri), it will have its own `lib/utils.ts` with potentially different Tailwind config.

---

## Recommendations Summary

| File | Action | Reasoning |
|------|--------|-----------|
| `client.ts` | ✅ **KEEP** | Next.js-specific env vars, multiServerSSE singleton access |
| `prompt-parsing.ts` | 🗑️ **DELETE** | Pure re-export, zero usages, no value |
| `transform-messages.ts` | ✅ **KEEP** | ai-elements-specific transform, view layer concern |
| `utils.ts` | ✅ **KEEP** | Standard shadcn/ui utility, app-specific styling |

---

## Implementation Plan

### Step 1: Delete prompt-parsing.ts

**Files to delete:**
- `apps/web/src/lib/prompt-parsing.ts`

**Migration:** None needed (no usages found)

**Verification:**
```bash
# Should return 0 results
grep -r "from \"@/lib/prompt-parsing\"" apps/web/src
```

### Step 2: Document client.ts distinction

Add a comment to `apps/web/src/lib/client.ts` explaining when to use web version vs core version:

```typescript
/**
 * OpenCode SDK client factory for web app
 *
 * This is the NEXT.JS-SPECIFIC version that uses:
 * - process.env.NEXT_PUBLIC_OPENCODE_URL (Next.js env var)
 * - multiServerSSE singleton (web-only pattern)
 *
 * For framework-agnostic usage (CLI, desktop, non-Next apps),
 * use @opencode-vibe/core/client instead.
 *
 * Uses MultiServerSSE for smart routing to discovered servers.
 */
```

### Step 3: Document transform-messages.ts scope

Add a comment clarifying this is ai-elements-specific:

```typescript
/**
 * Transform layer: OpenCode SDK types → ai-elements UIMessage types
 *
 * This module is SPECIFIC to the ai-elements library.
 * If you're building a UI with different components, create your own transform.
 *
 * This module handles the conversion between OpenCode's {info, parts} message structure
 * and the ai-elements library's UIMessage format used for rendering.
 */
```

---

## Comparison to packages/core

### What's in packages/core/client?

`packages/core/src/client/client.ts` provides:

```typescript
export const OPENCODE_URL = process.env.NEXT_PUBLIC_OPENCODE_URL ?? "http://localhost:4056"

export interface RoutingContext {
	servers: ServerInfo[]
	sessionToPort?: Map<string, number>
}

export function getClientUrl(
	directory?: string,
	sessionId?: string,
	routingContext?: RoutingContext,
): string

export function createClient(directory?: string, sessionId?: string): OpencodeClient

export const globalClient = createClient()
```

**Key difference:** Core version requires `RoutingContext` to be passed explicitly, web version accesses `multiServerSSE` singleton.

**When to use core version:**
- CLI tools (no global state)
- Desktop apps (multiple windows, isolated contexts)
- Server-side code (no singleton access)
- Non-Next.js apps (different env var conventions)

**When to use web version:**
- Next.js App Router components
- Next.js Client Components
- Any code with access to `multiServerSSE` singleton

---

## Integration with uploadthing-style DX Goal

Epic goal: **uploadthing-style DX. Simple top-level config, no maze of imports.**

**Current state:**

```typescript
// Web app client (Next-specific)
import { createClient } from "@/lib/client"

// Core client (framework-agnostic)
import { createClient } from "@opencode-vibe/core/client"

// Transform (ai-elements-specific)
import { transformMessages } from "@/lib/transform-messages"

// Utils (shadcn standard)
import { cn } from "@/lib/utils"
```

**This IS uploadthing-style DX:**
- Top-level imports from `@/lib/*`
- Clear distinction between app-specific and core
- No deep nesting (`@/lib/client/web/next/index.ts` ❌)

**What uploadthing does:**
```typescript
import { createUploadthing } from "uploadthing/next"  // Next-specific
import { createUploadthing } from "uploadthing/server" // Generic
```

**What we do:**
```typescript
import { createClient } from "@/lib/client"              // Next-specific
import { createClient } from "@opencode-vibe/core/client" // Generic
```

**Pattern match:** ✅ Same pattern, different package names.

---

## Next Steps

1. **Delete** `apps/web/src/lib/prompt-parsing.ts` (dead code)
2. **Add docs** to `client.ts` explaining when to use web vs core version
3. **Add docs** to `transform-messages.ts` clarifying ai-elements specificity
4. **Keep** `utils.ts` as-is (standard shadcn pattern)

**No package extraction needed.** All files are correctly placed.
