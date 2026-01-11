# Swarm CLI

Terminal interface for OpenCode session visualization and swarm coordination.

```
╔═══════════════════════════════════════╗
║     🐝 SWARM CLI 🐝                   ║
╚═══════════════════════════════════════╝
```

## Features

- 📊 Session statistics (count, status distribution)
- 🪙 Token usage tracking (per-session and average)
- 🔄 Live SSE updates with auto-reconnect
- 🎨 Gradient color-coded sessions
- ⚡ Streaming message indicators
- 🖥️ Both visual and JSON output modes
- 🔍 Auto-discovery of running servers

## Quick Start

```bash
# Auto-discover and connect
swarm-cli status

# With specific server
swarm-cli status --url http://localhost:3000

# Live watch mode
swarm-cli watch
```

## Commands

```bash
# Status - show current world state
swarm-cli status              # Visual mode
swarm-cli status --json       # JSON output

# Watch - live updates
swarm-cli watch               # Live terminal UI
swarm-cli watch --json        # JSON stream

# Options
--url <url>                   # Custom backend URL
--help                        # Show help
```

## Display Output

The visualizer shows:

- **Connection status**: Connected/connecting/error with last update time
- **Session count**: Total sessions and active session count
- **Status distribution**: Running, completed, idle session counts
- **Token usage**: Average context usage percentage across all sessions
- **Session list**: Each session with:
  - Active indicator (● for active, ○ for inactive)
  - Title and directory
  - Message count, context %, and status
  - Streaming indicators for active messages

## Architecture

Uses `createWorldStream` from `@opencode-vibe/core/world` (unified streaming):

```
OpenCode Backend → SSE Events → Merged Stream → WorldStore (atoms) → CLI render
```

Key points:
- Uses `createWorldStream().subscribe()` for live updates
- Unified streaming layer combines SSE and pluggable event sources
- Uses `adaptCoreWorldState()` to convert Core WorldState to CLI format
- Auto-discovers servers via `discoverServers()`

## Progressive Discovery

The CLI implements progressive discovery (ADR-018):

- **Auto-discovery**: Scans common ports (1999, 3000, 3001) for running servers
- **Fallback chains**: Falls back gracefully when servers aren't found
- **Error messages that teach**: Connection errors include troubleshooting tips
- **Contextual hints**: Shows "what you can do next" based on current state

Example discovery flow:
```
1. Check --url flag (explicit override)
2. Scan default ports for OpenCode servers
3. Report found servers or show startup instructions
```

## Development

### Scripts

```bash
bun run dev           # Run CLI with default settings
bun run dev:mock      # Start mock backend server
bun run build         # Build distributable
bun run type-check    # TypeScript type checking
```

### Mock Backend

The included `mock-server.ts` provides a test backend that:
- Serves 3 sample sessions
- Simulates SSE events every 3 seconds
- Runs on `localhost:1999`

Routes:
- `GET /session` - List all sessions
- `GET /session/status` - Session status map
- `GET /events` - SSE event stream

## Error Handling

The CLI includes comprehensive error handling:

- Connection failures show troubleshooting tips
- Automatic detection of missing backend
- Graceful shutdown on Ctrl+C
- Network error recovery with auto-reconnect

## Technical Details

### Backend Integration

- Uses `createOpencodeClient({ baseUrl })` for CLI usage
- Supports both proxy URLs (Next.js) and direct URLs (CLI)
- Automatic baseUrl configuration from `--url` flag

### Session Data Flow

```
OpenCode Backend → SSE Events → Merged Stream → WorldStore → render() → Terminal
```

1. Bootstrap fetches initial data via REST API (`GET /session`, `GET /session/status`)
2. SSE connection established for live updates (via unified streaming layer)
3. `WorldStore` maintains sorted arrays with binary search updates
4. Render loop updates terminal display via `log-update`
