# Code Indexing

**Purpose**: Code understanding, AST analysis, semantic code search systems

## Overview

Code indexing systems provide deep understanding of codebases through parsing, AST analysis, and semantic search. This category tracks tools and frameworks for Borg's code understanding capabilities.

## Known Systems

### Code Understanding

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| Serena | https://github.com/oraios/serena | 📖 Fully Researched | Code context system |
| OctoCode | https://github.com/Muvon/octocode | 📖 Fully Researched | Code context |
| Brokk | https://github.com/BrokkAi/brokk | ❓ Not Started | Code understanding |
| Brokk AI | https://brokk.ai/login | ❓ Not Started | Brokk web app |
| ChunkHound | https://chunkhound.github.io/ | ❓ Not Started | Code chunking |
| ChunkHound How-To | https://chunkhound.github.io/how-to/ | ❓ Not Started | Chunking docs |
| Probe | https://github.com/probelabs/probe | 📖 Fully Researched | Code search |
| Code-to-Tree | https://github.com/micl2e2/code-to-tree | ❓ Not Started | AST to tree |
| CodeWeaver | https://github.com/tesserato/CodeWeaver | ❓ Not Started | Code indexing |
| DeepContext | https://wild-card.ai/deepcontext | ❓ Not Started | Deep context |

### AST & Parsing

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| ast-grep | https://github.com/ast-grep/ast-grep | 📖 Fully Researched | AST search |
| tree-sitter | https://github.com/tree-sitter/tree-sitter | 📖 Fully Researched | Parser generator |

### Code Search Tools

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| Bloop | https://github.com/BloopAI/bloop | 📖 Fully Researched | Code search |
| CodeMap | Reddit: https://www.reddit.com/r/ClaudeCode/comments/1pa64qy/codemap_a_cli_that_gives_claude_instant/ | ❓ Not Started | Code mapping tool |

### Documentation & Articles

| Resource | URL | Status | Notes |
|----------|-----|--------|-------|
| Lack Coding Knowledge | https://www.reddit.com/r/mcp/comments/1pl1gbu/ai_coding_agents_have_coding_knowledge_but_lack/ | ❓ Not Started | Discussion article |

---

## Integration Strategy

1. **Add as submodules** for reference
2. **Study code parsing** and AST analysis
3. **Implement semantic code search** with embeddings
4. **Create code graph** visualization
5. **Add LSP integration** for real-time understanding
6. **Build code summarization** and documentation generation

---

## Borg Code Indexing Architecture

Borg should provide:
- **AST parsing**: Parse code to abstract syntax trees
- **Semantic search**: Find code by meaning, not just keywords
- **Code graph**: Visualize codebase dependencies
- **Symbol extraction**: Functions, classes, variables, imports
- **Code summarization**: Auto-generate documentation
- **Cross-references**: Find usage of symbols across files
- **Diff understanding**: Understand code changes semantically
- **Language support**: All major programming languages
- **Real-time indexing**: Update on file changes
- **LSP integration**: Use existing LSP servers

---

## Research Tasks

- [ ] Study Serena architecture
- [ ] Analyze OctoCode implementation
- [ ] Research Brokk's code understanding
- [ ] Study Probe's search algorithm
- [ ] Analyze AST-grep patterns
- [ ] Research code embedding strategies
- [ ] Study code graph algorithms
- [ ] Analyze Bloop's search approach
- [ ] Design semantic search system
- [ ] Implement AST parsing
- [ ] Build code graph visualization
- [ ] Integrate LSP servers

---

## Related

- [Memory Systems](../memory-systems/README.md)
- [RAG Systems](../rag-systems/README.md)
