---
title: Provider Nuances
description: Feature differences between Claude Code, OpenAI Codex, and OpenCode providers.
icon: puzzle
---

Each AI provider has unique capabilities and limitations. Maestro adapts its UI based on what each provider supports.

## Claude Code

| Feature | Support |
|---------|---------|
| Image attachments | ✅ New and resumed sessions |
| Session resume | ✅ `--resume` flag |
| Read-only mode | ✅ `--permission-mode plan` |
| Slash commands | ⚠️ Batch-mode commands only ([details](/slash-commands#agent-native-commands)) |
| Cost tracking | ✅ Full cost breakdown |
| Model selection | ✅ `--model` flag (via custom CLI args) |

## OpenAI Codex

| Feature | Support |
|---------|---------|
| Image attachments | ⚠️ New sessions only (not on resume) |
| Session resume | ✅ `exec resume <id>` |
| Read-only mode | ✅ `--sandbox read-only` |
| Slash commands | ⚠️ Interactive TUI only (not in exec mode) |
| Cost tracking | ❌ Token counts only (no pricing) |
| Model selection | ✅ `-m, --model` flag |

**Notes**:
- Codex's `resume` subcommand doesn't accept the `-i/--image` flag. Images can only be attached when starting a new session. Maestro hides the attach image button when resuming Codex sessions.
- Codex has [slash commands](https://github.com/openai/codex/blob/main/docs/slash_commands.md) (`/compact`, `/undo`, `/diff`, etc.) but they only work in interactive TUI mode, not in `exec` mode which Maestro uses.

## OpenCode

| Feature | Support |
|---------|---------|
| Image attachments | ✅ New and resumed sessions |
| Session resume | ✅ `--session` flag |
| Read-only mode | ✅ `--agent plan` |
| Slash commands | ❌ Not investigated |
| Cost tracking | ✅ Per-step costs |
| Model selection | ✅ `--model provider/model` |

**Note**: OpenCode uses the `run` subcommand which auto-approves all permissions (similar to Codex's YOLO mode).
