# Skills

**Purpose**: Collection of skill definitions, hooks, slash commands, agent configurations

## Overview

Skills are reusable prompt templates, agent behaviors, and configurations that can be applied across different AI tools (Claude Code, OpenCode, Copilot, etc.). This category tracks skill repositories for integration into Borg's universal skill library.

## Known Skill Repositories

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| dotfiles (claude-code/skills) | https://github.com/TheNoeTrevino/dotfiles/tree/main/claude-code/skills | ❓ Not Started | Personal Claude Code skills |
| OpenAI Skills | https://developers.openai.com/codex/skills/ | ❓ Not Started | Official OpenAI skills |
| Anthropic Skills | https://github.com/anthropics/skills | 📖 Fully Researched | Official Anthropic skills |
| OpenAI GitHub Skills | https://github.com/openai/skills | ❓ Not Started | OpenAI skills on GitHub |
| Gemini-Claude Skills | https://github.com/stared/gemini-claude-skills | ❓ Not Started | Cross-platform skills |
| Skills (bkircher) | https://github.com/bkircher/skills | ❓ Not Started | Alternative skill collection |
| Claude Code Tips | https://github.com/ykdojo/claude-code-tips | ❓ Not Started | Tips and best practices |

---

## Integration Strategy

1. **Add as submodules** for reference
2. **Extract skill definitions** (YAML, JSON, or markdown format)
3. **Normalize formats** to Borg standard skill format
4. **Categorize skills** by purpose (coding, debugging, refactoring, etc.)
5. **Create skill search and rating** system
6. **Enable skill conversion** between tool formats

---

## Borg Skill Architecture

Borg should support:
- **Universal skill format** that works with all models/providers
- **Skill chaining** and composition
- **Skill versioning** and updates
- **Skill marketplace** for sharing
- **Skill auto-improvement** using LLMs
- **Skill RAG** for semantic discovery

---

## Research Tasks

- [ ] Research each skill repository structure
- [ ] Identify skill formats used by each tool
- [ ] Create universal skill format specification
- [ ] Build skill conversion utilities
- [ ] Implement skill search and rating
- [ ] Create skill import/export functionality

---

## Related

- [Subagents](../multi-agent/README.md)
- [CLI Harnesses](../cli-harnesses/README.md)
