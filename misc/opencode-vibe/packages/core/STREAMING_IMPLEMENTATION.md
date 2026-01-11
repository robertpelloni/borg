# CLI-Compatible SSE Streaming Implementation

## Summary

Added CLI-compatible SSE streaming functions to `@opencode-vibe/core/world` that work in Bun/Node.js environments (where browser-only `EventSource` API is unavailable).

## What Was Added

### New Types

```typescript
// Injected discovery function for server discovery
export type DiscoverServers = () => Promise<Array<{ port: number; directory: string }>>
```

### New Functions

1. **`connectToServerSSE(port: number)`** - Low-level SSE stream to single server
   - Uses `fetch` with streaming (not browser `EventSource`)
   - Parses SSE with `eventsource-parser` package
   - Returns `Stream.Stream<GlobalEvent, Error>`

2. **`tailEventsDirect(discover: DiscoverServers, offset?: EventOffset)`** - Live event stream
   - Discovers servers via injected function
   - Connects to all servers in parallel
   - Merges streams with `Stream.mergeAll`
   - Converts `GlobalEvent` → `WorldEvent` with monotonic offsets
   - Auto-retries with exponential backoff

3. **`catchUpEventsDirect(discover: DiscoverServers, offset?: EventOffset)`** - Historical events
   - Fetches `/session/list` and `/session/status` from all servers
   - Converts to synthetic `WorldEvent[]`
   - Marks last event with `upToDate: true`

4. **`resumeEventsDirect(discover: DiscoverServers, savedOffset?: EventOffset)`** - Catch-up + Live
   - Combines catch-up (bounded) + tail (unbounded)
   - Implements Durable Streams resume pattern
   - Returns `Stream.Stream<WorldEvent, Error>`

## Key Differences: Web vs CLI

| Aspect | Web (Browser) | CLI (Bun/Node) |
|--------|--------------|----------------|
| SSE Library | `EventSource` (browser API) | `fetch` + `eventsource-parser` |
| Discovery | `MultiServerSSE` (Next.js proxy) | Injected `DiscoverServers` function |
| Connection | Proxied via `/api/sse/[port]` | Direct to `http://127.0.0.1:{port}/global/event` |
| Functions | `tailEvents()`, `resumeEvents()` | `tailEventsDirect()`, `resumeEventsDirect()` |

## Implementation Details

### SSE Parsing

Uses `eventsource-parser` (already in dependencies) to parse Server-Sent Events:

```typescript
import { createParser } from "eventsource-parser"

const parser = createParser({
  onEvent: (event) => {
    const globalEvent = JSON.parse(event.data) as GlobalEvent
    emit.single(globalEvent)
  }
})

// Feed chunks to parser
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value, { stream: true })
  parser.feed(chunk)
}
```

### Multi-Server Merging

Uses Effect `Stream.mergeAll` to combine multiple server streams:

```typescript
const serverStreams = servers.map((server) =>
  connectToServerSSE(server.port).pipe(
    Stream.retry(Schedule.exponential("1 second"))
  )
)

return Stream.mergeAll(serverStreams, { concurrency: "unbounded" })
```

### Offset Tracking

Uses `Stream.scan` to generate monotonic offsets:

```typescript
Stream.scan(
  { offsetCounter: 0, event: null },
  (state, globalEvent) => ({
    offsetCounter: state.offsetCounter + 1,
    event: globalEvent
  })
)
```

## Dependency Injection Pattern

Discovery is injected so CLI can provide its own implementation:

```typescript
// CLI provides lsof-based discovery
import { discoverServers } from "./discovery.js"

const stream = resumeEventsDirect(discoverServers)

// Or custom discovery
const customDiscover: DiscoverServers = async () => {
  return [{ port: 4056, directory: "/project" }]
}

const stream = resumeEventsDirect(customDiscover)
```

## Testing

Comprehensive tests in `stream-direct.test.ts`:

- Empty discovery handling
- Type safety validation
- Error handling (invalid ports)
- Stream lifecycle

All tests pass with Vitest.

## Files Modified

- **`packages/core/src/world/stream.ts`** - Added 4 new functions (220 lines)
- **`packages/core/src/world/index.ts`** - Exported new functions and types
- **`packages/core/src/world/stream-direct.test.ts`** - New test file (145 lines)

## Files Created

- **`packages/core/src/world/DIRECT_STREAMING_USAGE.md`** - Comprehensive usage guide
- **`apps/swarm-cli/STREAMING_EXAMPLE.md`** - CLI integration examples

## Build Verification

- ✅ TypeScript compilation succeeds
- ✅ Type definitions generated correctly
- ✅ All new tests pass
- ✅ No breaking changes to existing code
- ✅ Exports properly configured

## Next Steps for swarm-cli Integration

1. **Implement watch command** - Use `resumeEventsDirect()` for real-time monitoring
2. **Add offset persistence** - Save/load offset for resumable streaming
3. **Format CLI output** - Pretty-print events with colors
4. **Add filtering** - Filter by event type (session.*, worker.*, etc.)

## Usage Example

```typescript
import { Effect, Stream } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"

const stream = resumeEventsDirect(discoverServers)

await Effect.runPromise(
  Stream.runForEach(stream, (event) =>
    Effect.sync(() => {
      console.log(event.type, event.payload)
      if (event.upToDate) {
        console.log("Caught up! Now streaming live...")
      }
    })
  )
)
```

## References

- **ADR-018**: Reactive World Stream architecture
- **eventsource-parser**: https://github.com/rexxars/eventsource-parser
- **Effect Streams**: https://effect.website/docs/guides/streaming/streams
- **Discovery Pattern**: `apps/swarm-cli/src/discovery.ts`
