# opencode-vibe 🏄‍♂️

```
                                      _      │       _ _
  ___  _ __   ___ _ __   ___ ___   __| | ___ │__   _(_) |__   ___
 / _ \| '_ \ / _ \ '_ \ / __/ _ \ / _` |/ _ \│\ \ / / | '_ \ / _ \
| (_) | |_) |  __/ | | | (_| (_) | (_| |  __/│ \ V /| | |_) |  __/
 \___/| .__/ \___|_| |_|\___\___/ \__,_|\___│  \_/ |_|_.__/ \___|
      |_|                                   │
```

Next.js 16 rebuild of the OpenCode web application. Real-time chat UI with streaming message display, SSE sync, and React Server Components.

> **Warning:** This project uses Next.js 16 canary - bleeding edge, expect rough edges. Catppuccin-themed because we're not savages.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3+ (required - we don't use npm/pnpm)
- [OpenCode CLI](https://github.com/sst/opencode) running locally

### 1. Install Dependencies

```bash
bun install
```

### 2. Start OpenCode (Any Mode)

The web UI discovers running OpenCode processes automatically. Use whatever mode you want:

```bash
# TUI mode (interactive terminal)
cd /path/to/your/project
opencode

# Or serve mode (headless)
opencode serve
```

Run as many as you want, in different directories. The web UI finds them all.

### 3. Start the Web UI

```bash
# From the opencode-next root directory
bun dev
```

This starts the Next.js dev server on **port 8423**.

### 4. Open in Browser

Navigate to: **http://localhost:8423**

You should see the OpenCode web interface with your sessions.

---

## Features

- **Multi-server discovery** - Finds all running OpenCode processes (TUIs, serves) automatically via `lsof`
- **Cross-process messaging** - Send from web UI, appears in your TUI. Routes to the server that owns the session
- **Real-time streaming** - Messages stream in as the AI generates them
- **SSE sync** - All updates pushed via Server-Sent Events, merged from all discovered servers
- **Slash commands** - Type `/` for actions like `/fix`, `/test`, `/refactor`
- **File references** - Type `@` to fuzzy-search and attach files as context
- **Catppuccin theme** - Latte (light) / Mocha (dark) with proper syntax highlighting

---

## Architecture

**Zero-config server discovery.** The web UI finds all running OpenCode processes automatically.

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR MACHINE                             │
│                                                                 │
│   Terminal 1          Terminal 2          Terminal 3            │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐            │
│   │opencode │        │opencode │        │opencode │            │
│   │  tui    │        │  tui    │        │ serve   │            │
│   │ :4096   │        │ :5123   │        │ :6421   │            │
│   │ ~/foo   │        │ ~/bar   │        │ ~/baz   │            │
│   └────┬────┘        └────┬────┘        └────┬────┘            │
│        │                  │                  │                  │
│        └──────────────────┼──────────────────┘                  │
│                           │                                     │
│                    ┌──────┴──────┐                              │
│                    │    lsof     │  discovers all               │
│                    │   + verify  │  opencode processes          │
│                    └──────┬──────┘                              │
│                           │                                     │
│                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                 WEB UI (:8423)                           │  │
│   │                                                          │  │
│   │   ~/foo sessions ──┐                                     │  │
│   │   ~/bar sessions ──┼── all projects, one view            │  │
│   │   ~/baz sessions ──┘                                     │  │
│   │                                                          │  │
│   │   send message → routes to server that owns the session  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### How Discovery Works

1. API route runs `lsof` to find processes listening on TCP with "bun" or "opencode" in the command
2. Hits `/project` endpoint on each candidate to verify it's actually OpenCode
3. Opens SSE stream to each verified server
4. Events include `directory` field → routes to correct project in the store

**The cool part:** Send a message from the web UI and it appears in your TUI. The web discovers which server owns the session and routes there.

---

## Configuration

Mostly unnecessary - discovery handles it. But if you need overrides:

```bash
# apps/web/.env.local

# Fallback URL if discovery finds nothing (default: http://localhost:4056)
NEXT_PUBLIC_OPENCODE_URL=http://localhost:4056

# Force a specific directory (optional)
NEXT_PUBLIC_OPENCODE_DIRECTORY=/path/to/your/project
```

---

## Development

### Project Structure

```
opencode-next/
├── apps/
│   └── web/                    # Next.js 16 application
│       ├── src/
│       │   ├── app/            # App Router pages
│       │   │   ├── page.tsx    # Session list
│       │   │   └── session/
│       │   │       └── [id]/   # Session detail view
│       │   ├── components/     # UI components
│       │   │   ├── ai-elements/  # Chat UI components
│       │   │   └── ui/           # Shared UI primitives
│       │   ├── core/           # SDK client setup
│       │   ├── lib/            # Utilities
│       │   └── react/          # React hooks & providers
│       │       ├── provider.tsx      # OpenCodeProvider
│       │       ├── store.ts          # Zustand store
│       │       ├── use-sse.tsx       # SSE connection hook
│       │       ├── use-session.ts    # Session data hook
│       │       ├── use-messages.ts   # Messages hook
│       │       └── use-send-message.ts # Send message hook
│       └── package.json
├── docs/
│   ├── adr/                    # Architecture Decision Records
│   └── guides/                 # Implementation guides
├── package.json                # Root package.json
└── turbo.json                  # Turborepo config
```

### Code Tour

**Start here to understand the codebase:**

#### 1. Server Discovery (`apps/web/src/app/api/opencode-servers/route.ts`)

The magic that finds all running OpenCode processes. Uses `lsof` to find TCP listeners, hits `/project` to verify they're OpenCode, returns the list. Called on page load.

#### 2. SSE Connection (`apps/web/src/react/use-multi-server-sse.ts`)

Opens SSE streams to ALL discovered servers simultaneously. Events include a `directory` field that routes updates to the correct project in the store. This is how TUI ↔ Web sync works.

#### 3. Zustand Store (`apps/web/src/react/store.ts`)

Central state management. Directory-scoped (each project has isolated state). Handles SSE events via `handleEvent()` which dispatches to specific handlers for sessions, messages, parts, etc. Uses Immer for immutable updates.

#### 4. Message Transform (`apps/web/src/lib/transform-messages.ts`)

Converts OpenCode SDK types → ai-elements UIMessage format. The SDK returns `{info, parts}` envelopes; this flattens them for rendering. Also handles tool state mapping.

#### 5. Session Page (`apps/web/src/app/session/[id]/page.tsx`)

Server Component that fetches initial data. Uses `limit=20` for fast initial load (pagination). Passes data to client components for hydration.

#### 6. Session Messages (`apps/web/src/app/session/[id]/session-messages.tsx`)

Client Component that renders the message list. Hydrates Zustand store on first render, then subscribes to real-time updates. Uses memoization to prevent re-renders during streaming.

#### 7. Prompt Input (`apps/web/src/components/prompt/PromptInput.tsx`)

The input box. Handles slash commands (`/`), file references (`@`), and message sending. Autocomplete powered by fuzzy search over commands and files.

#### 8. AI Elements (`apps/web/src/components/ai-elements/`)

Chat UI components: Message, Tool, Reasoning, Conversation, etc. Adapted from Vercel's ai-elements patterns. Each component handles its own streaming states.

### Available Scripts

```bash
# Development
bun dev                 # Start Next.js dev server (port 8423 = VIBE)
bun build               # Production build
bun start               # Start production server

# Code Quality
bun run typecheck       # TypeScript check (via turbo, checks all packages)
bun lint                # Run oxlint
bun format              # Format with Biome
bun format:check        # Check formatting

# Testing
bun test                # Run tests
bun test --watch        # Watch mode
```

### React Hooks

The web UI provides several hooks for interacting with OpenCode:

```tsx
import {
  useSession, // Get session data
  useMessages, // Get messages for a session
  useSendMessage, // Send a message
  useSessionStatus, // Get session status (idle/busy/error)
  useProviders, // List available AI providers
} from "@/react";

// Example: Display session messages
function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const messages = useMessages(sessionId);
  const { send, isPending } = useSendMessage(sessionId);
  const status = useSessionStatus(sessionId);

  return (
    <div>
      <h1>{session?.title}</h1>
      <div>Status: {status}</div>
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            send(e.currentTarget.value);
          }
        }}
        disabled={isPending}
      />
    </div>
  );
}
```

---

## Troubleshooting

### "No servers discovered"

```bash
# Check what's actually running
lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E 'bun|opencode'
```

Should show at least one process. If not, start OpenCode somewhere.

### "No sessions showing"

1. OpenCode needs to be running in a project directory
2. Check browser console for discovery/SSE errors
3. Try the discovery endpoint directly: `curl http://localhost:8423/api/opencode-servers`

### "Messages not updating"

Check SSE connections in DevTools → Network → filter by "event". Should see active streams to discovered servers.

---

## Tech Stack

| Layer          | Technology            | Why                                 |
| -------------- | --------------------- | ----------------------------------- |
| **Runtime**    | [Bun](https://bun.sh) | Fast all-in-one runtime             |
| **Framework**  | Next.js 16            | React Server Components, App Router |
| **Bundler**    | Turbopack             | Next-gen bundler                    |
| **Language**   | TypeScript 5+         | Type safety                         |
| **Linting**    | oxlint                | Fast Rust-based linter              |
| **Formatting** | Biome                 | Fast formatter                      |
| **Styling**    | Tailwind CSS          | Utility-first CSS                   |
| **State**      | Zustand               | Lightweight state management        |
| **SDK**        | @opencode-ai/sdk      | OpenCode API client                 |

---

## Documentation

- [ADR 001: Next.js Rebuild](docs/adr/001-nextjs-rebuild.md) - Architecture rationale
- [Sync Implementation Guide](docs/guides/SYNC_IMPLEMENTATION.md) - SSE sync details
- [Subagent Display Guide](docs/guides/SUBAGENT_DISPLAY.md) - Rendering subagent messages
- [Mobile Client Guide](docs/guides/MOBILE_CLIENT_IMPLEMENTATION.md) - Mobile considerations

---

## Contributing

1. Use Bun (not npm/pnpm)
2. Follow TDD: RED → GREEN → REFACTOR
3. Run `bun format` before committing
4. Check `bun lint` passes

---

## License

MIT
