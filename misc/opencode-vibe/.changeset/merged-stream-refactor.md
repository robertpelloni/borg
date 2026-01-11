---
"@opencode-vibe/core": minor
---

refactor(core): unify SSE streaming into merged-stream

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🌊  STREAM UNIFICATION  🌊                            ║
║                                                           ║
║         sse-bridge.ts    ┐                                ║
║                          │                                ║
║         merged-stream.ts ├──►  merged-stream.ts           ║
║                          │       (unified)                ║
║         stream.ts        ┘                                ║
║                                                           ║
║     THREE FLOWS → ONE ELEGANT STREAM                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

> "If you find the same pattern of code repeated over and over,
> see if you can reorganize the code to eliminate the repetition.
> One approach is to factor the repeated code into a new function."
> — John Ousterhout, A Philosophy of Software Design

**Refactoring Summary:**

- **DELETED** `sse-bridge.ts` - merged functionality into `merged-stream.ts`
- **DRYed** SSE event handling logic (was duplicated across 3 files)
- **Simplified** `stream.ts` via delegation to unified `merged-stream`
- **Added** comprehensive tests for discovery, world stream, and watch command
- **Improved** CLI output formatting with better throttling

**Files Changed:**

Core Package:
- `packages/core/src/world/merged-stream.ts` - unified SSE handling
- `packages/core/src/world/stream.ts` - simplified via delegation
- `packages/core/src/world/sse-bridge.ts` - DELETED
- `packages/core/src/discovery/discovery.test.ts` - added tests
- `packages/core/src/types/domain.ts` - type updates

Swarm CLI:
- `apps/swarm-cli/src/commands/watch.ts` - improved throttling
- `apps/swarm-cli/src/output.ts` - better formatting
- `apps/swarm-cli/STREAMING_EXAMPLE.md` - updated docs

**Breaking Changes:** None - external API unchanged.
