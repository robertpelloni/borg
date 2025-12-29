# Conversation Explorer

A terminal UI application that scans local Claude Code and OpenCode conversation histories, displaying them in an interactive interface for browsing and analyzing conversations.

## Features

- **Split-pane interface**: Conversation list on top, detailed message view on bottom
- **Multi-source support**: Scans both Claude Code and OpenCode conversation histories  
- **Chronological organization**: Conversations sorted by last modified date
- **Message analysis**: Stacked bar visualization showing message timeline with color-coded types
- **Individual message browsing**: Navigate through messages with syntax highlighting and expansion
- **Text wrapping**: Long messages wrap properly in expanded view
- **Real-time filtering**: Press `/` to filter conversations by project name or session ID
- **Token estimation**: Shows estimated token counts alongside character counts
- **Export functionality**: Export conversations to Claude Code (.jsonl) or OpenCode (multi-file) format
- **Keyboard-driven**: Full keyboard navigation with intuitive shortcuts
- **Message editing**: Delete messages with 'd' key (be careful!)
- **Caching**: Intelligent caching system to avoid re-parsing unchanged files

## Requirements

- **Bun runtime** (required for native FFI and OpenTUI)
- Node.js for TypeScript types

## Installation

```bash
# Install dependencies
bun install

# Run directly from source
bun index.ts

# Or build and run  
bun run build
bun run start

# Or use the npm script
bun run convx
```

## Usage

### Basic Usage

```bash
# Use default locations
bun index.ts

# Show help
bun index.ts --help

# Custom data locations
bun index.ts --claude-root ~/custom/claude/path --opencode-root ~/custom/opencode/path

# Size calculation modes
bun index.ts --size-mode tokens  # Use token estimates instead of character count

# Filter by date
bun index.ts --since 2025-01-01  # Only show sessions from 2025

# Enable debug overlay
bun index.ts --debug
```

### Keyboard Shortcuts

#### Conversation List (Top Pane)
- `↑/↓` or `j/k` - Navigate conversation list
- `Enter` - Select conversation to view messages
- `Esc` - Clear selection highlighting
- `Home/End` - Jump to first/last conversation

#### Message List (Bottom Pane)  
- `↑/↓` or `j/k` - Navigate messages (when focused)
- `Enter` - Expand/collapse selected message for full content
- `d` - Delete selected message (permanent!)
- `Home/End` - Jump to first/last message
- `Page Up/Down` - Scroll through messages or expanded content

#### Global Controls
- `Tab` - Toggle focus between conversation list and message list
- `/` - Enter filter mode to search conversations
- `e` - Export selected conversation to Claude Code or OpenCode format
- `Esc` - Exit filter mode or clear selection
- `r` - Refresh data (re-scan filesystem)
- `q` or `Ctrl+C` - Exit application

### Data Sources

The application automatically scans:

**Claude Code**: `~/.claude/projects/**/*.{json,jsonl,ndjson,log}`
- Supports both NDJSON streams and JSON arrays
- Extracts session ID, timestamps, project info from conversation logs

**OpenCode**: `~/.local/share/opencode/project/**/storage/session/`
- Reads session metadata from `info/ses_*.json` files  
- Parses messages from `message/ses_*/msg_*.json` files

### Message Classification

Messages are automatically classified into types with color coding:

- **U** (User) - User input messages (yellow)
- **A** (Assistant) - Assistant text responses (green)  
- **T** (Tool Call) - Assistant responses with tool calls (blue)
- **R** (Tool Result) - Tool execution results (pink/red)

In the message list, each message shows a colored letter indicator followed by token count and content preview. Use Enter to expand messages for full content with proper text wrapping.

### Export Feature

The application can export conversations to different formats:

1. **Select a conversation** in the conversation list
2. **Press `e`** to open the export dialog
3. **Choose format**:
   - **Claude Code**: Exports as a single JSONL file in the Claude Code projects directory
   - **OpenCode**: Exports as multi-file structure in the OpenCode project directory
4. **Press Enter** to export

Export creates files with proper structure:
- **Claude Code**: `{sessionId}.jsonl` with one JSON object per line
- **OpenCode**: Complete directory structure with session info, message files, and part files

### Size Calculation

- `--size-mode chars` (default): UTF-16 character count
- `--size-mode bytes`: Byte count (UTF-8 encoded)
- `--size-mode tokens`: Rough token estimate (~4 chars per token)

## Architecture

The application is built with:

- **@opentui/core**: Terminal UI framework with native rendering
- **Data layer**: File system scanners for Claude Code and OpenCode formats
- **State management**: Centralized store for UI state and data
- **Component system**: Custom renderables extending OpenTUI base classes
- **Caching**: Content-based caching to avoid re-parsing unchanged files

## Development

```bash
# Run in development mode
bun run dev

# Build for distribution  
bun run build

# The built executable will be in dist/index.js
```

## Troubleshooting

1. **"This application requires Bun runtime"**: Install Bun from https://bun.sh
2. **No data found**: Check that Claude Code/OpenCode have created conversation files in the expected locations
3. **Import errors**: Ensure you're running with `bun` not `node`
4. **Permission errors**: Check file permissions in the conversation data directories

## Contributing

The codebase is organized into:

- `src/data/` - File parsing and data processing
- `src/ui/` - Custom OpenTUI renderable components  
- `src/state/` - Application state management
- `src/App.ts` - Main application logic and layout
- `src/index.ts` - CLI entry point and argument parsing