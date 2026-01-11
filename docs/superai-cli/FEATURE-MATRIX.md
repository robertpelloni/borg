# Feature Matrix - AI Coding Tools Comparison

> Comprehensive comparison of AI coding assistants researched for SuperAI CLI integration.

## Tool Overview

| Tool | Type | Language | Primary Focus |
|------|------|----------|---------------|
| **AIChat** | CLI | Rust | Multi-provider LLM REPL with RAG |
| **Aider** | CLI | Python | AI pair programming with git |
| **Claude Code** | CLI | TypeScript | Anthropic's official coding CLI |
| **OpenCode-Autopilot** | Plugin | TypeScript | Multi-model AI council |
| **Cursor** | Editor | TypeScript | AI-first code editor (VS Code fork) |
| **Continue.dev** | Extension | TypeScript | Open-source AI coding assistant |
| **Cline** | Extension | TypeScript | Autonomous AI agent for VS Code |
| **Cody** | Extension | TypeScript | Sourcegraph's AI assistant |
| **Copilot** | Extension | TypeScript | GitHub's AI pair programmer |
| **Claude-Squad** | CLI | Go | Multi-agent orchestrator with tmux |
| **MCP-CLI** | CLI | TypeScript | Universal MCP client |
| **Vibe-Kanban** | Web | Rust | Kanban board with MCP |

---

## LLM Provider Support

| Tool | OpenAI | Anthropic | Google | Azure | Ollama | AWS Bedrock | Custom |
|------|:------:|:---------:|:------:|:-----:|:------:|:-----------:|:------:|
| AIChat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (20+) |
| Aider | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (100+) |
| Claude Code | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| OpenCode-Autopilot | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Cursor | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (BYOK) |
| Continue.dev | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cody | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Copilot | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**Key Insight**: BYOK (Bring Your Own Key) is standard across modern tools. Local model support (Ollama) is increasingly important.

---

## MCP (Model Context Protocol) Support

| Tool | MCP Client | MCP Server | Transports | Notes |
|------|:----------:|:----------:|------------|-------|
| AIChat | ✅ | ❌ | stdio | Via agents system |
| Aider | ✅ | ❌ | stdio | Added May 2025, max 25 calls |
| Claude Code | ✅ | ✅ | stdio, SSE, HTTP | Full MCP support |
| Cursor | ✅ | ❌ | stdio, SSE | MCP marketplace at cursormcp.com |
| Continue.dev | ✅ | ❌ | stdio | Context provider integration |
| Cline | ✅ | ❌ | stdio, SSE | MCP marketplace at cline.bot |
| Cody | ❌ | ❌ | - | Uses Sourcegraph graph instead |
| Copilot | ✅ | ❌ | stdio | Preview feature |
| MCP-CLI | ✅ | ❌ | stdio, SSE, HTTP | Universal client |
| Vibe-Kanban | ❌ | ✅ | HTTP | Exposes 10+ agent schemas |

**Key Insight**: MCP is becoming the universal standard. stdio + SSE transports are required.

---

## Edit Formats & Code Application

| Tool | Diff | Whole File | Unified Diff | Patch | Architect | Search/Replace |
|------|:----:|:----------:|:------------:|:-----:|:---------:|:--------------:|
| Aider | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Claude Code | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cursor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Continue.dev | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cline | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

**Architect Mode** (Aider): Two-model approach where one reasons and another edits. Highly effective.

---

## Agent Mode & Autonomy

| Tool | Agent Mode | Plan/Act | Human-in-Loop | Auto-Approve | Checkpoints |
|------|:----------:|:--------:|:-------------:|:------------:|:-----------:|
| Claude Code | ✅ | ✅ | ✅ | ✅ (YOLO) | ✅ |
| Cursor | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cline | ✅ | ✅ | ✅ | ✅ | ✅ |
| Copilot | ✅ | ✅ | ✅ | ❌ | ❌ |
| OpenCode-Autopilot | ✅ | ✅ | ✅ | ✅ | ✅ |
| Claude-Squad | ✅ | ❌ | ✅ | ✅ (daemon) | ❌ |

**Plan/Act Pattern** (Cline): 
1. **Plan**: Break down task into steps
2. **Act**: Execute each step with tool calls
3. **Verify**: Check results before proceeding

---

## Multi-Agent Capabilities

| Tool | Multi-Agent | Parallel | Git Isolation | Communication | Aggregation |
|------|:-----------:|:--------:|:-------------:|:-------------:|:-----------:|
| OpenCode-Autopilot | ✅ | ✅ | ❌ | Democratic Debate | Weighted Voting |
| Claude-Squad | ✅ | ✅ | ✅ (worktree) | tmux sessions | Manual |
| SuperAI CLI (v0.5.0) | ✅ | ✅ | ❌ | MessageBus | First/All/Majority/Best/Merge/Consensus |

**Key Insight**: Git worktree isolation (Claude-Squad) prevents conflicts in parallel agent work.

---

## Configuration Systems

| Tool | Format | Location | Hot Reload | Workspace Override |
|------|--------|----------|:----------:|:------------------:|
| AIChat | YAML | ~/.config/aichat/ | ✅ | ❌ |
| Aider | YAML | ~/.aider.conf.yml | ❌ | ✅ (.aider.conf.yml) |
| Claude Code | JSON | ~/.claude/ | ✅ | ✅ (.claude/) |
| Cursor | MDC | .cursor/rules/*.mdc | ✅ | ✅ |
| Continue.dev | YAML | ~/.continue/config.yaml | ✅ | ✅ (.continue/) |
| Cline | JSON | Settings UI | ✅ | ✅ (Cline Rules) |

**MDC Format** (Cursor): Markdown with YAML frontmatter for rules.

---

## Extension Mechanisms

| Tool | Slash Commands | Plugins | Hooks | Skills | Custom Tools |
|------|:--------------:|:-------:|:-----:|:------:|:------------:|
| AIChat | ❌ | ❌ | ❌ | ❌ | ✅ (agents) |
| Aider | ✅ | ❌ | ❌ | ❌ | ❌ |
| Claude Code | ✅ | ✅ | ✅ (5 phases) | ✅ | ✅ |
| Cursor | ✅ | ❌ | ❌ | ❌ | ✅ (MCP) |
| Continue.dev | ✅ | ✅ | ❌ | ❌ | ✅ (context providers) |
| Cline | ✅ | ❌ | ❌ | ✅ | ✅ (MCP) |

**Context Providers** (Continue.dev): 13+ built-in (File, Code, Diff, Terminal, HTTP, etc.)

---

## Session Management

| Tool | Save/Load | Fork | Rewind | Checkpoint | Auto-Save | Export |
|------|:---------:|:----:|:------:|:----------:|:---------:|:------:|
| Claude Code | ✅ | ✅ | ✅ | ✅ | ✅ (5hr) | ✅ |
| Cursor | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Continue.dev | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cline | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| SuperAI CLI (v0.6.0) | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## RAG (Retrieval-Augmented Generation)

| Tool | Vector DB | Embeddings | Document Loaders | Reranking |
|------|:---------:|:----------:|:----------------:|:---------:|
| AIChat | ✅ (HNSW) | ✅ | ✅ | ✅ (BM25) |
| Aider | ❌ | ❌ | ❌ | ❌ |
| Cody | ✅ | ✅ | ✅ | ✅ |
| Continue.dev | ✅ | ✅ | ✅ | ❌ |

**AIChat RAG**: HNSW vector search + BM25 keyword reranking = hybrid search.

---

## Voice Input

| Tool | Speech-to-Text | Providers | Hotkey |
|------|:--------------:|-----------|--------|
| Aider | ✅ | Whisper API | `/voice` |
| SuperAI CLI (v1.4.0) | ✅ | Whisper, Google, Azure, Local | `V` |

---

## Git Integration

| Tool | Status | Commit | Auto-Commit | Worktree | Conflict Detection |
|------|:------:|:------:|:-----------:|:--------:|:------------------:|
| Aider | ✅ | ✅ | ✅ | ❌ | ✅ |
| Claude Code | ✅ | ✅ | ❌ | ❌ | ✅ |
| Claude-Squad | ✅ | ✅ | ❌ | ✅ | ✅ |
| SuperAI CLI (v1.1.0) | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## IDE/Editor Extensions

| Editor | Extension Type | Language | Key APIs |
|--------|----------------|----------|----------|
| **VS Code** | Extension | TypeScript | Chat Participants, Webview, TreeView, WorkspaceEdit |
| **JetBrains** | Plugin | Kotlin | Tool Windows, PSI, Actions, ACP/MCP |
| **Zed** | WASM Extension | Rust | Agent Server (ACP), Slash Commands |
| **Neovim** | Lua Plugin | Lua | nvim API, Telescope, plenary.nvim |
| **Cursor** | Fork + MCP | TypeScript | Same as VS Code + .cursor/rules |
| **Visual Studio** | VSIX | C# | Language Server Protocol |

---

## Feature Priority Matrix for SuperAI CLI

### Critical (Must Have)

| Feature | Source Inspiration | Target Version |
|---------|-------------------|----------------|
| Full MCP Client (stdio + SSE) | Cursor, Cline | v1.6.0 |
| YAML Config with Model Roles | Continue.dev | v1.6.0 |
| Agent Mode (Plan/Act/Verify) | Cline | v1.7.0 |
| Rules System (.superai/rules/*.mdc) | Cursor | v1.7.0 |
| VS Code Extension | Continue.dev, Cline | v2.0.0 |

### High (Should Have)

| Feature | Source Inspiration | Target Version |
|---------|-------------------|----------------|
| Context Providers | Continue.dev | v1.8.0 |
| Memory Bank | Cline | v1.8.0 |
| Architect Mode (Two-Model) | Aider | v1.9.0 |
| RAG System | AIChat, Cody | v1.9.0 |
| JetBrains Plugin | JetBrains ACP | v2.1.0 |
| Zed Extension | Zed ACP | v2.2.0 |

### Medium (Nice to Have)

| Feature | Source Inspiration | Target Version |
|---------|-------------------|----------------|
| Agent Council (Democratic) | OpenCode-Autopilot | v2.5.0 |
| Git Worktree Isolation | Claude-Squad | v2.5.0 |
| Neovim Plugin | avante.nvim | v2.3.0 |
| Custom Slash Commands | Claude Code | v1.8.0 |

---

## Architecture Patterns to Adopt

### 1. Three-Tier Architecture (Continue.dev)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Extension     │◄───►│      Core       │◄───►│       GUI       │
│  (IDE facade)   │     │ (business logic)│     │   (React UI)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 2. Plan/Act/Verify Loop (Cline)
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   Plan   │────►│   Act    │────►│  Verify  │
│ (break   │     │ (execute │     │ (check   │
│  down)   │     │  tools)  │     │  result) │
└──────────┘     └──────────┘     └────┬─────┘
      ▲                                │
      └────────────────────────────────┘
               (iterate if needed)
```

### 3. Helper Binary Pattern (Cody)
```
┌─────────────────┐
│   VS Code Ext   │ (thin facade)
└────────┬────────┘
         │ JSON-RPC
         ▼
┌─────────────────┐
│ Cody Client     │ (TypeScript + Rust)
│ Backend (CCB)   │ (shared across IDEs)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Sourcegraph API │
└─────────────────┘
```

### 4. Git Worktree Isolation (Claude-Squad)
```
main-repo/
├── .git/
├── worktrees/
│   ├── agent-1/  (isolated checkout)
│   ├── agent-2/  (isolated checkout)
│   └── agent-3/  (isolated checkout)
└── src/
```

---

## Recommended Technology Stack for Extensions

| Editor | Language | Framework | Key Dependencies |
|--------|----------|-----------|------------------|
| VS Code | TypeScript | VS Code API | vscode, @vscode/webview-ui-toolkit |
| JetBrains | Kotlin | IntelliJ Platform | intellij-gradle-plugin, coroutines |
| Zed | Rust | zed_extension_api | WASM compilation |
| Neovim | Lua | nvim-lua | plenary.nvim, nui.nvim |
| Cursor | TypeScript | VS Code API (fork) | Same as VS Code |
| Visual Studio | C# | VSIX | Microsoft.VisualStudio.SDK |

---

## Summary

SuperAI CLI should prioritize:

1. **MCP as Universal Protocol** - Full client implementation with marketplace integration
2. **YAML Configuration** - Following Continue.dev's migration from JSON
3. **Plan/Act/Verify Agent Mode** - Cline's proven autonomous workflow
4. **Rules System** - Cursor's .mdc format for project-specific instructions
5. **Multi-Editor Extensions** - VS Code first, then JetBrains, Zed, Neovim
6. **RAG Integration** - AIChat's hybrid HNSW + BM25 approach
7. **Architect Mode** - Aider's two-model reasoning+editing pattern

The goal is to become the "universal backend" that powers AI coding assistance across ALL editors, not just the TUI.
