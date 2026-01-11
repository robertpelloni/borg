# CLI-Compatible SSE Streaming Usage

This guide shows how to use the direct server streaming functions in CLI environments (Bun, Node.js) where browser-only SSE libraries won't work.

## Key Differences: Web vs CLI

| Feature | Web (Browser) | CLI (Bun/Node) |
|---------|---------------|----------------|
| **SSE Library** | `EventSource` (browser API) | `fetch` + `eventsource-parser` |
| **Discovery** | `MultiServerSSE` (uses Next.js API routes) | Direct `lsof` + verification |
| **Functions** | `tailEvents`, `catchUpEvents`, `resumeEvents` | `tailEventsDirect`, `catchUpEventsDirect`, `resumeEventsDirect` |
| **Connection** | Proxied through Next.js | Direct to `http://127.0.0.1:{port}` |

## Basic Usage

### 1. Implement Discovery Function

The CLI needs to discover running OpenCode servers. Use `lsof` or similar:

```typescript
// apps/swarm-cli/src/discovery.ts (already exists)
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export interface DiscoveredServer {
  port: number
  pid: number
  directory: string
}

export async function discoverServers(): Promise<DiscoveredServer[]> {
  try {
    const { stdout } = await execAsync(
      `lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E 'bun|opencode' | awk '{print $2, $9}'`,
      { timeout: 2000 }
    )

    const candidates: { port: number; pid: number }[] = []
    const seen = new Set<number>()

    for (const line of stdout.trim().split("\n")) {
      if (!line) continue
      const [pid, address] = line.split(" ")
      const portMatch = address?.match(/:(\d+)$/)
      if (!portMatch) continue

      const port = parseInt(portMatch[1], 10)
      if (seen.has(port)) continue
      seen.add(port)

      candidates.push({ port, pid: parseInt(pid, 10) })
    }

    // Verify candidates
    const verified: DiscoveredServer[] = []
    for (const candidate of candidates) {
      const res = await fetch(`http://127.0.0.1:${candidate.port}/project/current`)
      if (res.ok) {
        const project = await res.json()
        verified.push({
          port: candidate.port,
          pid: candidate.pid,
          directory: project.worktree
        })
      }
    }

    return verified
  } catch {
    return []
  }
}
```

### 2. Stream Events with Effect

```typescript
import { Effect, Stream } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"

// Resume from saved offset (or start fresh)
const savedOffset = undefined // Or load from disk

const stream = resumeEventsDirect(discoverServers, savedOffset)

// Consume stream with Effect
await Effect.runPromise(
  Stream.runForEach(stream, (event) =>
    Effect.sync(() => {
      console.log(JSON.stringify(event, null, 2))
      
      // Track offset for resuming later
      if (event.offset) {
        saveOffsetToDisk(event.offset)
      }
    })
  )
)
```

### 3. Catch-Up Only (No Live Stream)

```typescript
import { Effect } from "effect"
import { catchUpEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"

const response = await Effect.runPromise(
  catchUpEventsDirect(discoverServers)
)

console.log(`Fetched ${response.events.length} historical events`)
console.log(`Next offset: ${response.nextOffset}`)
console.log(`Up to date: ${response.upToDate}`)

for (const event of response.events) {
  console.log(event.type, event.payload)
}
```

### 4. Live Stream Only (No Catch-Up)

```typescript
import { Effect, Stream } from "effect"
import { tailEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"

const stream = tailEventsDirect(discoverServers)

// Run forever, consuming live events
await Effect.runPromise(
  Stream.runForEach(stream, (event) =>
    Effect.sync(() => {
      console.log(`[${event.type}] ${event.offset}`, event.payload)
    })
  )
)
```

### 5. Connect to Single Server

```typescript
import { Effect, Stream } from "effect"
import { connectToServerSSE } from "@opencode-vibe/core/world"

const stream = connectToServerSSE(4056)

// Consume events from single server
await Effect.runPromise(
  Stream.runForEach(stream, (globalEvent) =>
    Effect.sync(() => {
      console.log(globalEvent.directory, globalEvent.payload.type)
    })
  )
)
```

## Advanced Patterns

### Multi-Server with Custom Discovery

```typescript
import { resumeEventsDirect, type DiscoverServers } from "@opencode-vibe/core/world"

// Custom discovery (e.g., from config file)
const customDiscover: DiscoverServers = async () => {
  return [
    { port: 4056, directory: "/project1" },
    { port: 4057, directory: "/project2" },
  ]
}

const stream = resumeEventsDirect(customDiscover)
```

### Error Handling with Effect

```typescript
import { Effect, Stream, Schedule } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"

const stream = resumeEventsDirect(discoverServers)

// Add retry logic
const resilientStream = stream.pipe(
  Stream.retry(
    Schedule.exponential("1 second").pipe(
      Schedule.union(Schedule.spaced("30 seconds")),
      Schedule.compose(Schedule.recurs(10)) // Max 10 retries
    )
  )
)

// Consume with error handling
await Effect.runPromise(
  Stream.runForEach(resilientStream, (event) =>
    Effect.sync(() => console.log(event))
  ).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error("Stream failed:", error)
        process.exit(1)
      })
    )
  )
)
```

### Offset Persistence

```typescript
import { Effect, Stream } from "effect"
import { resumeEventsDirect, type EventOffset } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"
import { readFileSync, writeFileSync } from "fs"

// Load saved offset
let savedOffset: EventOffset | undefined
try {
  savedOffset = readFileSync(".offset", "utf-8") as EventOffset
} catch {
  // No saved offset - start from beginning
}

const stream = resumeEventsDirect(discoverServers, savedOffset)

// Save offset every 10 events
let eventCount = 0
await Effect.runPromise(
  Stream.runForEach(stream, (event) =>
    Effect.sync(() => {
      console.log(event.type)
      
      eventCount++
      if (eventCount % 10 === 0) {
        writeFileSync(".offset", event.offset)
      }
    })
  )
)
```

### Stream to File (JSON Lines)

```typescript
import { Effect, Stream } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "./discovery.js"
import { createWriteStream } from "fs"

const output = createWriteStream("events.jsonl", { flags: "a" })

const stream = resumeEventsDirect(discoverServers)

await Effect.runPromise(
  Stream.runForEach(stream, (event) =>
    Effect.sync(() => {
      output.write(JSON.stringify(event) + "\n")
    })
  )
)

output.close()
```

## Event Types

```typescript
import type { WorldEvent } from "@opencode-vibe/core/world"

// WorldEvent is a discriminated union
type WorldEvent =
  | { type: "session.created"; offset: EventOffset; payload: { id: string; projectKey: string } }
  | { type: "session.updated"; offset: EventOffset; payload: { id: string; status: string } }
  | { type: "session.completed"; offset: EventOffset; payload: { id: string; exitCode: number } }
  | { type: "worker.spawned"; offset: EventOffset; payload: { workerId: string; taskId: string } }
  | { type: "worker.progress"; offset: EventOffset; payload: { workerId: string; percent: number } }
  | { type: "worker.completed"; offset: EventOffset; payload: { workerId: string; success: boolean } }
  | { type: "worker.failed"; offset: EventOffset; payload: { workerId: string; error: string } }
  | { type: "message.sent"; offset: EventOffset; payload: { messageId: string; from: string; to: string } }
  | { type: "message.received"; offset: EventOffset; payload: { messageId: string; recipient: string } }
  | { type: "reservation.acquired"; offset: EventOffset; payload: { reservationId: string; agentId: string; path: string } }
  | { type: "reservation.released"; offset: EventOffset; payload: { reservationId: string } }
```

## Testing

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { catchUpEventsDirect, type DiscoverServers } from "@opencode-vibe/core/world"

describe("CLI streaming", () => {
  it("should handle empty discovery", async () => {
    const emptyDiscover: DiscoverServers = async () => []

    const response = await Effect.runPromise(
      catchUpEventsDirect(emptyDiscover)
    )

    expect(response.events).toHaveLength(0)
    expect(response.upToDate).toBe(true)
  })
})
```

## Troubleshooting

### "No servers discovered"

- Check that OpenCode servers are running: `lsof -iTCP -sTCP:LISTEN | grep bun`
- Verify `/project/current` endpoint returns valid JSON
- Check firewall/network settings for localhost access

### SSE connection failures

- Ensure server is listening on `127.0.0.1` (not just `localhost`)
- Check server logs for SSE endpoint errors
- Verify `/global/event` endpoint exists and returns `text/event-stream`

### Type errors with EventOffset

EventOffset is a branded string type. Don't construct it manually:

```typescript
// ❌ BAD
const offset: EventOffset = "12345" // Type error

// ✅ GOOD
const offset = undefined // Let the stream generate offsets
const offset = event.offset // Use offset from previous event
```

## Migration from Web Functions

| Web Function | CLI Function | Changes Required |
|--------------|--------------|------------------|
| `tailEvents()` | `tailEventsDirect(discover)` | Pass discovery function |
| `catchUpEvents()` | `catchUpEventsDirect(discover)` | Pass discovery function |
| `resumeEvents()` | `resumeEventsDirect(discover)` | Pass discovery function |

The CLI functions have identical signatures except for the additional `discover` parameter.

## See Also

- [ADR-018: Reactive World Stream](../../../docs/adr/018-reactive-world-stream.md)
- [Effect Streams Documentation](https://effect.website/docs/guides/streaming/streams)
- [eventsource-parser](https://github.com/rexxars/eventsource-parser)
