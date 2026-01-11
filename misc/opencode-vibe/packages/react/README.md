# @opencode-vibe/react

React bindings for OpenCode — a thin layer connecting Core APIs to UI components.

## Philosophy

**Core owns computation. React binds UI.**

```
┌─────────────────────────────────────────────────────────────┐
│                      React Layer                            │
│  - Hooks consume from World Stream                          │
│  - Components render state                                  │
│  - UI state in Zustand (selected session, flags)            │
│  - NO business logic, NO data derivation                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Layer                             │
│  - World Stream (push-based reactive state)                 │
│  - Status computation, data derivation                      │
│  - Promise APIs for mutations                               │
│  - Effect runtime (internal)                                │
└─────────────────────────────────────────────────────────────┘
```

React hooks call Core promise APIs. They never import Effect directly. All business logic lives in Core — React just binds it to the DOM.

See [@opencode-vibe/core](../core/README.md) for details on the unified World Stream architecture (SSE + pluggable event sources).

## Install

```bash
bun add @opencode-vibe/react
```

**Peer dependencies:** Next.js 15/16, React 18/19

## Quick Start

Wrap your app with `OpencodeProvider`:

```tsx
import { OpencodeProvider } from "@opencode-vibe/react/providers"

export default function RootLayout({ children }) {
  return (
    <OpencodeProvider baseUrl="http://localhost:3000">
      {children}
    </OpencodeProvider>
  )
}
```

Use hooks to consume world state:

```tsx
import { useWorld, useSession, useSessionMessages } from "@opencode-vibe/react"

export function ChatUI({ sessionId }: { sessionId: string }) {
  // Get entire world state (rarely needed)
  const world = useWorld()

  // Get specific session (derived from world)
  const session = useSession(sessionId)

  // Get messages for session
  const messages = useSessionMessages(sessionId)

  return (
    <div>
      <h1>{session?.title}</h1>
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

## Hooks

### World Stream (Primary)

Hooks that consume from the reactive World Stream:

- `useWorld()` — Entire world state (use sparingly)
- `useSession(sessionId)` — Single session data
- `useSessionMessages(sessionId)` — Messages for a session
- `useSessionList()` — All sessions
- `useProjects()` — Available projects
- `useCurrentProject()` — Active project
- `useProviders()` — AI providers and models
- `useServers()` — OpenCode server discovery

### Actions

Mutations call Core promise APIs:

- `useSendMessage()` — Send messages to AI
- `useCreateSession()` — Create new sessions
- `useCommands()` — Execute slash commands

### Utilities

- `useFileSearch(options)` — Fuzzy file search
- `useContextUsage()` — Token usage tracking
- `useSubagents()` — Subagent task management

## Provider

```tsx
import { OpencodeProvider } from "@opencode-vibe/react/providers"

<OpencodeProvider baseUrl="http://localhost:3000">
  {children}
</OpencodeProvider>
```

The provider:
- Creates the World Stream connection
- Manages SSE internally (no separate SSEProvider needed)
- Provides context for all hooks

## Store (UI State Only)

Zustand is used for **UI state only**, not world data:

```tsx
import { useOpencodeStore } from "@opencode-vibe/react/store"

// UI state - selection, flags, preferences
const selectedSessionId = useOpencodeStore((state) => state.selectedSessionId)
const setSelectedSession = useOpencodeStore((state) => state.setSelectedSession)

// NOT for world data - use hooks instead
// Bad:  useOpencodeStore((state) => state.messages)
// Good: useSessionMessages(sessionId)
```

## SSR Plugin (Next.js)

Provider-free architecture for server components:

```tsx
// next.config.ts
import { OpencodeSSRPlugin } from "@opencode-vibe/react"

export default {
  plugins: [OpencodeSSRPlugin({ apiUrl: process.env.OPENCODE_API_URL })],
}
```

```tsx
// app/layout.tsx
import { generateOpencodeHelpers } from "@opencode-vibe/react"

const { useSession } = generateOpencodeHelpers()
```

## Dependencies

- `@opencode-vibe/core` — World Stream, APIs, business logic
- `effect-atom` — Reactive state binding
- `zustand` — UI state only
