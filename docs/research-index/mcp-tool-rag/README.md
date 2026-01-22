# MCP Tool RAG / Disclosure

**Purpose**: Dynamic tool loading, semantic search, progressive disclosure for MCP tools

## Overview

MCP Tool RAG and disclosure systems reduce context usage by only exposing relevant tools to models at runtime. This category tracks implementations of semantic tool search, progressive tool disclosure, and MCP aggregation.

## Known Systems

### MCP Routers & Aggregators

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| mcpproxy | https://github.com/Dumbris/mcpproxy | 📖 Fully Researched | MCP proxy/aggregator |
| meta-mcp-proxy | https://github.com/nullplatform/meta-mcp-proxy | 📖 Fully Researched | Meta proxy |
| mcp-router | https://github.com/mcp-router/mcp-router | 📖 Fully Researched | MCP routing |
| mcp-gateway | https://github.com/microsoft/mcp-gateway | ❓ Not Started | Microsoft gateway |
| agent-mcp-gateway | https://github.com/roddutra/agent-mcp-gateway | ❓ Not Started | Agent gateway |
| mcp-proxy | https://github.com/TBXark/mcp-proxy | 📖 Fully Researched | Proxy |
| mcpproxy-go | https://github.com/smart-mcp-proxy/mcpproxy-go | 📖 Fully Researched | Go proxy |
| mcphub | https://github.com/samanhappy/mcphub | 📖 Fully Researched | Hub/registry |

### Tool RAG & Discovery

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| ToolRAG | https://github.com/antl3x/ToolRAG | ❓ Not Started | Tool retrieval |
| mcp-linker | https://github.com/milisp/mcp-linker | ❓ Not Started | Tool linking |
| mcp-funnel | https://github.com/chris-schra/mcp-funnel | ❓ Not Started | Tool aggregation |
| mcp-tool-chainer | https://github.com/thirdstrandstudio/mcp-tool-chainer | 📖 Fully Researched | Tool chaining |
| Zypher Agent | https://github.com/corespeed-io/zypher-agent | ❓ Not Started | Tool orchestration |

### Progressive Disclosure

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| claude-lazy-loading | https://github.com/machjesusmoto/claude-lazy-loading | 📖 Fully Researched | Lazy tool loading |
| lootbox | https://github.com/jx-codes/lootbox | ❓ Not Started | Progressive disclosure |
| Switchboard | https://github.com/George5562/Switchboard | 📖 Fully Researched | Tool routing |
| lazy-mcp | https://github.com/voicetreelab/lazy-mcp | ❓ Not Started | Lazy MCP |
| Polymcp | https://github.com/poly-mcp/Polymcp | 📖 Fully Researched | Polyglot MCP |

### Code Mode & Tool Calling

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| code-executor-MCP | https://github.com/aberemia24/code-executor-MCP | ❓ Not Started | Code executor |
| code-mode | https://github.com/universal-tool-calling-protocol/code-mode | ❓ Not Started | Code mode spec |
| utcp-mcp | https://github.com/universal-tool-calling-protocol/utcp-mcp | ❓ Not Started | UTCP implementation |
| codemode-unified | https://github.com/danieliser/codemode-unified | ❓ Not Started | Unified code mode |
| mcp-server-code-execution-mode | https://github.com/elusznik/mcp-server-code-execution-mode | 📖 Fully Researched | Code execution |

### Tool Discovery & Search

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| toolscript | https://github.com/mKeRix/toolscript | ❓ Not Started | Tool scripting |
| mcp-json-yaml-toml | https://github.com/bitflight-devops/mcp-json-yaml-toml | ❓ Not Started | Config tools |
| hypertool-mcp | https://github.com/toolprint/hypertool-mcp | ❓ Not Started | Tool aggregation |
| toolbox | https://smithery.ai/server/@smithery/toolbox | ❓ Not Started | Toolbox MCP |
| Programmatic Tool Calling SDK | https://github.com/cameronking4/programmatic-tool-calling-ai-sdk | ❓ Not Started | SDK |

### Documentation & Specs

| Resource | URL | Status | Notes |
|----------|-----|--------|-------|
| Code Execution with MCP | https://www.anthropic.com/engineering/code-execution-with-mcp | 📖 Fully Researched | Anthropic docs |
| Advanced Tool Use | https://www.anthropic.com/engineering/advanced-tool-use | 📖 Fully Researched | Anthropic docs |
| Programmatic Tool Calling | https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling | 📖 Fully Researched | Claude docs |
| Tool Search Tool | https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool | 📖 Fully Researched | Claude docs |
| 100x Token Reduction | https://www.speakeasy.com/blog/100x-token-reduction-dynamic-toolsets | ❓ Not Started | Article |

---

## Integration Strategy

1. **Add as submodules** for reference
2. **Study progressive disclosure algorithms**
3. **Extract semantic search implementations**
4. **Analyze tool chaining patterns**
5. **Implement tool RAG system** in Borg
6. **Build universal MCP router/aggregator**
7. **Add traffic inspection** and logging

---

## Borg Tool Disclosure Architecture

Borg should implement:
- **Semantic tool search**: Find relevant tools by query
- **Progressive disclosure**: Only expose N tools at a time
- **Tool RAG**: Vector embeddings of tool descriptions
- **Tool chaining**: Automatic composition of tools
- **Tool groups/namespaces**: Organize tools logically
- **Dynamic loading**: Load/unload tools on demand
- **Traffic inspection**: Monitor all MCP tool calls
- **Latency tracking**: Measure tool response times
- **Keep-alive system**: Prevent server timeouts
- **Master MCP config**: Universal configuration management

---

## Research Tasks

- [ ] Study mcpproxy architecture
- [ ] Analyze ToolRAG implementation
- [ ] Research Tool Search Tool spec
- [ ] Study progressive disclosure patterns
- [ ] Analyze tool chaining implementations
- [ ] Design semantic search system
- [ ] Build tool embedding pipeline
- [ ] Implement progressive disclosure
- [ ] Create universal MCP router
- [ ] Add traffic inspection

---

## Related

- [MCP Directories](../mcp-directories/README.md)
- [Multi-Agent](../multi-agent/README.md)
