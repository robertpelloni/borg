# Borg Research Initiative - Summary & Next Steps

**Status**: Infrastructure established, research in progress
**Last Updated**: 2026-01-17

---

## What I've Set Up

### 1. Research Infrastructure ✅
Created organized directory structure under `docs/research-index/`:
- `mcp-directories/` - MCP server listings
- `skills/` - Skill repositories and formats
- `multi-agent/` - Orchestration frameworks and SDKs
- `cli-harnesses/` - CLI tools for feature parity
- `memory-systems/` - Memory backends and vector stores
- `mcp-tool-rag/` - Progressive tool disclosure
- `rag-systems/` - Document parsing and retrieval
- `computer-use/` - Computer control and browser automation
- `code-indexing/` - Code understanding and AST analysis
- `browsers/` - Browser extensions
- `routers-providers/` - API gateways and providers
- `misc/` - Uncategorized resources

### 2. Master Index ✅
Created `docs/research-index/MASTER_INDEX.md` with:
- Central tracking of all resources
- Relevance rating system
- Feature parity tracker for CLI tools
- Integration priority matrix
- Changelog and notes

### 3. Category READMEs ✅
Created detailed README files for each category with:
- Repository lists with status tracking
- Integration strategies
- Borg architecture goals
- Research task lists

### 4. Background Research Tasks 🔄
Launched parallel research tasks:
- `bg_be39dc34`: MCP Tool RAG systems (RUNNING)
- Other 4 tasks had launch issues but can be retried

### 5. Submodule Updates 🔄
Attempted to add missing submodules:
- `bkircher/skills` ✅ Added
- Some others had git conflicts/timeouts

---

## Immediate Next Steps

### High Priority

1. **Check on background research tasks** and collect findings
2. **Add missing submodules** incrementally (smaller batches)
3. **Process research findings** into documentation
4. **Create JSON database** of all resources with metadata

### Medium Priority

5. **Launch remaining research tasks**:
   - MCP Registries (pulsemcp, playbooks, Docker)
   - RAG Systems (llama_index, ragie, pinecone)
   - Computer-use (CUA, FARA, browser tools)
   - Code Indexing (Brokk, CodeWeaver, etc.)
   - Routers/Providers (OpenRouter, LiteLLM)

6. **Deduplicate links** across all sources
7. **Rate relevance** of each resource to Borg goals

### Low Priority

8. **Create documentation templates** for submodule integration
9. **Build master index** with descriptions and ratings
10. **Update AGENTS.md** with findings and patterns

---

## Resource Deduplication Status

### Already Submodules ✅
Many of the resources you listed are already submodules in Borg:
- All major MCP directories (punkpeye, appcypher, wong2)
- Skills repos (anthropics/skills, openai/skills)
- Multi-agent (metamcp, OpenHands, A2A, TaskSync)
- CLI harnesses (claude-code, qwen-code, gemini-cli, crush)
- Memory systems (mem0, letta, supermemory, zep, chroma, qdrant)
- MCP servers (many already indexed in references/mcp_repos/)

### Need to Add ⏳
- bkircher/skills ✅ Added
- A2A (attempted, had conflicts)
- agentdepot-agents (attempted, already exists)
- pydantic-deepagents (attempted, had conflicts)
- Many CLI tools (codebuff, goose, grok-cli, etc.)
- Various proxies and routers

---

## Implementation Strategy

For each researched resource, Borg should:

### 1. Add as Submodule
- For reference and ongoing updates
- Source code inspection
- Track upstream changes

### 2. Deep Research
- Documentation (README, docs, website)
- Source code analysis (architecture, patterns)
- Issues and feature requests
- Community discussions (Reddit, HN, etc.)

### 3. Document Findings
- Create JSON entry in resource database
- Document unique features and patterns
- Assess relevance to Borg goals
- Rate usefulness (🟢 Critical, 🟡 High, etc.)

### 4. Integration Decision
Choose one of:
- **Wrap**: Create thin wrapper calling code directly
- **MCP Client**: Use via MCP protocol when beneficial
- **Reimplement**: Port functionality into Borg core
- **Reference Only**: Keep for documentation without integration

### 5. Implement
- For critical/high-relevance resources
- Add feature parity tracking
- Document implementation decisions
- Add to changelog

---

## Borg Core Systems to Implement

Based on your vision, Borg needs these core systems:

### 1. Ultimate MCP Router/Aggregator
- Combines many MCP servers into one "master" MCP
- Handles session lifecycle, auto-start, restart
- Single instance, multiple clients
- Latency monitoring, health checks
- Tool grouping/namespaces
- Progressive tool disclosure
- Semantic tool search/RAG
- Traffic inspection and logging
- Tool chaining, TOON format, code mode

### 2. Memory System with Multi-Backend
- Pluggable architecture (Chroma, Qdrant, Mem0, Letta, etc.)
- Short/long/archival memory
- Auto-harvesting from sessions
- Compaction and pruning
- Semantic search and RAG
- Conversion between backends
- Import/export functionality
- Memory browser UI

### 3. Multi-Model Orchestration
- Agent council with debate
- Supervisor for task delegation
- Fallback and auto-switching
- Consensus for critical decisions
- Subagent registry and spawning
- Multi-model pair programming

### 4. CLI/TUI/WebUI
- Universal provider support (all models)
- Intelligent model selection
- Session management and history
- File operations (read, write, edit, search)
- Code execution sandboxing
- LSP integration and diff visualization
- TUI mode, WebUI mode, mobile access
- Autopilot mode for autonomous execution

### 5. Context Management
- Automatic harvesting
- Summarization and compaction
- Pruning strategies
- Session management
- Import/export capabilities

### 6. Browser Extension
- Store memories from web chats
- Universal memory access
- Export/import sessions
- Computer-use bridge
- Console access, page scraping
- Connect to all AI interfaces

---

## Recommended Workflow

For efficient progress, I recommend:

### Batch 1: Complete Current Research
1. Check on all 5 background tasks
2. Process findings into documentation
3. Create resource database entries

### Batch 2: Add Critical Submodules
1. Add A2A orchestration
2. Add codebuff, goose, grok-cli
3. Add pydantic-deepagents, agentic-playground
4. Retry failed submodule additions

### Batch 3: Launch More Research
1. MCP Registries (pulsemcp, playbooks, Docker)
2. RAG Systems (llama_index, ragie, pinecone)
3. Computer-use (CUA, FARA, browser tools)
4. Code Indexing (Brokk, CodeWeaver, etc.)

### Batch 4: Process & Document
1. Deduplicate all links
2. Rate relevance
3. Create master database
4. Update AGENTS.md with patterns

### Batch 5: Implementation Planning
1. Design universal MCP router
2. Design pluggable memory system
3. Design agent council system
4. Create implementation tasks

---

## File Locations

- Master Index: `docs/research-index/MASTER_INDEX.md`
- Category docs: `docs/research-index/[category]/README.md`
- Todo list: Available via todoread
- .gitmodules: `C:\Users\hyper\workspace\borg\.gitmodules`

---

## Commands to Check Progress

```bash
# Check background tasks
background_output --task_id=bg_be39dc34

# View todo list
todoread

# Check submodules
cat .gitmodules | grep submodule

# View research index
cat docs/research-index/MASTER_INDEX.md
```

---

## Notes

- Git submodules had some conflicts (index.lock, path collisions)
- Background tasks should be checked individually
- Some resources are already submodules (80+ tracked in .gitmodules)
- Focus on adding MISSING ones, not duplicating
- Many CLI tools already in submodules (check carefully before adding)

---

## Questions for User

1. Should I continue with incremental submodule additions or focus on research first?
2. Should I create an automated script to批量-add submodules?
3. Do you want me to prioritize certain categories over others?
4. Should I create a JSON database file for all resources?
5. How often should I check on background research tasks?

---

*This document will be updated as progress is made*
