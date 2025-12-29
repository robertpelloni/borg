# Multi-Server SSE

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
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │   lsof      │  "who's listening?"          │
│                    │   scan      │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │  /project   │  "are you opencode?"         │
│                    │   verify    │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    WEB UI                                │  │
│   │                                                          │  │
│   │   ~/foo sessions ──┐                                     │  │
│   │   ~/bar sessions ──┼── all in one view                   │  │
│   │   ~/baz sessions ──┘                                     │  │
│   │                                                          │  │
│   │   click any session → routes to the server that owns it  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## What This Does

You have OpenCode running in multiple terminals - TUIs, serve processes, whatever. The web UI finds them all automatically and merges their sessions into one view.

No config. No URLs to manage. Just works.

## How

1. **Discovery** - API route runs `lsof` to find processes listening on TCP ports with "bun" or "opencode" in the command
2. **Verification** - Hits `/project` endpoint on each candidate (500ms timeout) to confirm it's actually OpenCode
3. **Connection** - Opens SSE stream to each verified server's `/global/event` endpoint
4. **Routing** - Events include `directory` field, so we know which project they belong to
5. **Smart Send** - When you send a message, it routes to the server that owns that session

## The Cool Part

**Send messages to TUI sessions from the web.**

```
┌──────────────┐                    ┌──────────────┐
│   WEB UI     │                    │     TUI      │
│              │                    │              │
│  [send msg]──┼────────────────────┼──> appears   │
│              │   routes to :4096  │     here     │
│              │   (owns session)   │              │
└──────────────┘                    └──────────────┘
```

The web UI discovers which server owns a session and routes the prompt there. Your TUI picks it up and runs it. Real-time sync via SSE keeps both in sync.

## Files

- `multi-server-sse.ts` - Discovery + connection manager
- `route.ts` - `/api/opencode-servers` endpoint (runs lsof)
- `use-multi-server-sse.ts` - React hook that wires it to Zustand

## Why Not Just Config?

Config goes stale. Ports change. Processes die. You forget what's running.

`lsof` doesn't lie. It shows what's actually listening right now.
