# CLI Harnesses

**Purpose**: Command-line AI coding tools (OpenCode, Claude Code, Codebuff, Codex, etc.)

## Overview

CLI harnesses are command-line tools that provide AI-powered coding capabilities. This category tracks all major CLI tools to achieve feature parity with Borg's own CLI/TUI/WebUI.

## Feature Parity Tracker

| Tool | Status | Progress | Last Checked |
|------|--------|----------|--------------|
| OpenCode | 🔄 In Progress | 60% | 2026-01-17 |
| Claude Code | 🔄 In Progress | 70% | 2026-01-17 |
| Codebuff | ❓ Not Started | 0% | - |
| Codex | ❓ Not Started | 0% | - |
| Copilot CLI | ❓ Not Started | 0% | - |
| Crush | ❓ Not Started | 0% | - |
| Factory | ❓ Not Started | 0% | - |
| Gemini CLI | ❓ Not Started | 0% | - |
| Goose CLI | ❓ Not Started | 0% | - |
| Grok Build | ❓ Not Started | 0% | - |
| Kilo Code | ❓ Not Started | 0% | - |
| Kimi CLI | ❓ Not Started | 0% | - |
| Mistral Vibe | ❓ Not Started | 0% | - |
| Qwen Code | ❓ Not Started | 0% | - |
| Warp | ❓ Not Started | 0% | - |
| Trae | ❓ Not Started | 0% | - |

---

## Known CLI Tools

### Primary Targets

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| claude-code | https://github.com/anthropics/claude-code | 📖 Fully Researched | Anthropic's CLI |
| copilot-cli | https://github.com/github/copilot-cli | ❓ Not Started | GitHub's CLI |
| qwen-code | https://github.com/QwenLM/qwen-code | 📖 Fully Researched | Alibaba's CLI |
| code | https://github.com/just-every/code | ❓ Not Started | "just-every" CLI |
| codebuff | https://github.com/CodebuffAI/codebuff | ❓ Not Started | Codebuff CLI |
| crush | https://github.com/charmbracelet/crush | 📖 Fully Researched | Charm's tool |
| goose | https://github.com/block/goose | ❓ Not Started | Goose CLI |
| aichat | https://github.com/sigoden/aichat | ❓ Not Started | Universal AI CLI |
| kimi-cli | https://github.com/MoonshotAI/kimi-cli | ❓ Not Started | Moonshot's CLI |
| gemini-cli | https://github.com/google-gemini/gemini-cli | 📖 Fully Researched | Google's CLI |
| grok-cli | https://github.com/superagent-ai/grok-cli | ❓ Not Started | xAI's CLI |
| kilocode | https://github.com/Kilo-Org/kilocode | ❓ Not Started | Kilo's CLI |

### Extensions & Routers

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| claude-code-router | https://github.com/musistudio/claude-code-router | 📖 Fully Researched | Routing layer |
| devin.cursorrules | https://github.com/grapeot/devin.cursorrules | ❓ Not Started | Cursor rules |
| cc-switch | https://github.com/farion1231/cc-switch | ❓ Not Started | Switch tools |
| ccs | https://github.com/kaitranntt/ccs | ❓ Not Started | Code assistant |
| Lynkr | https://github.com/vishalveerareddy123/Lynkr | ❓ Not Started | Link management |
| emdash | https://github.com/generalaction/emdash | ❓ Not Started | Command runner |
| code-assistant-manager | https://github.com/Chat2AnyLLM/code-assistant-manager | ❓ Not Started | Tool manager |
| CodeNomad | https://github.com/NeuralNomadsAI/CodeNomad | ❓ Not Started | Nomad CLI |
| openai-gemini | https://github.com/PublicAffairs/openai-gemini | ❓ Not Started | Proxy |
| gemini-openai-proxy | https://github.com/zuisong/gemini-openai-proxy | ❓ Not Started | Proxy |
| vercel-ai-proxy | https://github.com/Hk-Gosuto/vercel-ai-proxy | ❓ Not Started | Proxy |
| gemini-cli-router | https://github.com/Jasonzhangf/gemini-cli-router | ❓ Not Started | Router |
| ccproxy | https://github.com/starbased-co/ccproxy | ❓ Not Started | Proxy |
| GoogleGeminiRouter | https://github.com/Dhatchinamoorthy/GoogleGeminiRouter | ❓ Not Started | Router |
| cc-switch-cli | https://github.com/SaladDay/cc-switch-cli | ❓ Not Started | Switch CLI |

---

## Integration Strategy

1. **Add as submodules** for reference and code inspection
2. **Identify unique features** of each tool
3. **Extract reusable patterns** and utilities
4. **Create wrappers** where beneficial (direct code calls)
5. **Implement feature parity** for core functionality
6. **Migrate unique features** to Borg CLI

---

## Borg CLI Architecture

Borg CLI should provide:
- **Universal provider support** (OpenAI, Anthropic, Google, xAI, etc.)
- **Multi-model routing** with intelligent selection
- **Session management** with history and export/import
- **File operations** (read, write, edit, search)
- **Code execution** in sandboxed environments
- **LSP integration** for intelligent edits
- **Diff visualization** and streaming
- **TUI mode** for terminal interfaces
- **Web UI mode** for browser access
- **Mobile access** for remote control
- **Autopilot mode** for autonomous execution

---

## Research Tasks

- [ ] Document unique features of each CLI
- [ ] Extract common patterns (diff editing, file ops, etc.)
- [ ] Study provider integration approaches
- [ ] Analyze session management implementations
- [ ] Research TUI frameworks used
- [ ] Document mobile access patterns
- [ ] Create feature matrix comparison
- [ ] Implement missing features in Borg CLI

---

## Related

- [Skills](../skills/README.md)
- [Multi-Agent](../multi-agent/README.md)
