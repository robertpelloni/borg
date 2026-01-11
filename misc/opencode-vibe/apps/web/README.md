# OpenCode Web

Next.js 16 rebuild of the OpenCode web application with React Server Components.

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:8423](http://localhost:8423) with your browser to see the result.

---

## Multi-Server Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           YOUR MACHINE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│   │   TUI :4056  │     │   TUI :4057  │     │   TUI :4058  │   ...          │
│   │  ~/project-a │     │  ~/project-b │     │  ~/project-c │                │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│          │                    │                    │                         │
│          │ SSE events         │ SSE events         │ SSE events              │
│          │                    │                    │                         │
│          ▼                    ▼                    ▼                         │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                    MultiServerSSE                            │           │
│   │  ┌─────────────────────────────────────────────────────┐    │           │
│   │  │  directoryToPort Map                                 │    │           │
│   │  │  ~/project-a → 4056                                  │    │           │
│   │  │  ~/project-b → 4057                                  │    │           │
│   │  │  ~/project-c → 4058                                  │    │           │
│   │  └─────────────────────────────────────────────────────┘    │           │
│   └─────────────────────────────────────────────────────────────┘           │
│          │                                                                   │
│          │ Aggregated events                                                 │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                 Next.js Web App :8423                        │           │
│   │  ┌─────────────────────────────────────────────────────┐    │           │
│   │  │  Zustand Store                                       │    │           │
│   │  │  directories: {                                      │    │           │
│   │  │    "~/project-a": { sessions, messages, parts... }   │    │           │
│   │  │    "~/project-b": { sessions, messages, parts... }   │    │           │
│   │  │  }                                                   │    │           │
│   │  └─────────────────────────────────────────────────────┘    │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works

**The Problem:** OpenCode can run multiple TUI instances, each managing a different project directory. Each TUI runs its own HTTP server on a different port. The web UI needs to:

1. See sessions from ALL running TUIs
2. Send messages to the CORRECT TUI (the one managing that session's directory)

**The Solution:** Multi-Server SSE with Smart Routing

#### Server Discovery

Every 5 seconds, the web app discovers running OpenCode servers via `/api/opencode-servers`, which uses `lsof` to find processes and verifies they're OpenCode instances by checking `/project/current`.

#### SSE Aggregation

Maintains persistent SSE connections to ALL discovered servers. Events include the directory they came from and are forwarded to the Zustand store, keyed by directory.

#### Smart Request Routing

When sending a message, the client routes to the correct server by looking up which port handles that directory. Requests go through Next.js API proxy routes (`/api/opencode/{port}` and `/api/sse/{port}`) for CORS and mobile compatibility.

---

## Features

### Slash Commands (`/`)

Type `/` to execute actions with autocomplete dropdown. Navigate with arrow keys or Tab, press Enter to select.

### File References (`@`)

Type `@` to reference files as context with fuzzy search. Selected files appear as removable pills and are included in message metadata.

---

## Tech Stack

- **Next.js 16** - App Router, React Server Components, Turbopack
- **Bun** - Runtime and package manager
- **TypeScript** - Strict type checking
- **@opencode-vibe/core** - SDK and service layer (extracted package)
- **@opencode-vibe/react** - React hooks and providers (extracted package)
- **Effect-TS** - Typed async operations, services
- **Zustand** - State management (per-directory stores)
- **Tailwind CSS** - Styling
- **Streamdown** - Markdown rendering with streaming support
- **TDD** - 119+ tests

See [AGENTS.md](../../AGENTS.md) for full architecture documentation.
