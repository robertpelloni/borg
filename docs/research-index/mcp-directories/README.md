# MCP Directories

**Purpose**: Aggregated lists of MCP servers for discovery, research, and installation

## Overview

MCP directories are curated lists of Model Context Protocol servers that serve as discovery mechanisms for finding new tools and capabilities. These directories are critical for building Borg's universal MCP registry.

## Known Directories

### GitHub Repositories

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| awesome-mcp-servers (punkpeye) | https://github.com/punkpeye/awesome-mcp-servers | 🔬 Research In Progress | Finance & Fintech focus |
| awesome-mcp-servers (appcypher) | https://github.com/appcypher/awesome-mcp-servers | ❓ Not Started | General MCP servers |
| awesome-mcp-servers (wong2) | https://github.com/wong2/awesome-mcp-servers | ❓ Not Started | Alternative curated list |

### Web Registries

| Registry | URL | Status | Notes |
|----------|-----|--------|-------|
| PulseMCP | https://www.pulsemcp.com/servers | ❓ Not Started | Web-based MCP server directory |
| Playbooks | https://playbooks.com/mcp | ❓ Not Started | MCP playbook collection |
| ToolSDK Registry | https://github.com/toolsdk-ai/toolsdk-mcp-registry | ❓ Not Started | Registry service |
| Docker MCP Catalog | https://hub.docker.com/mcp | ❓ Not Started | Docker image registry |

### Official Resources

| Resource | URL | Status | Notes |
|----------|-----|--------|-------|
| MCP Official | https://github.com/mcp | 📖 Fully Researched | Official MCP organization |

---

## Integration Strategy

1. **Add as submodules** for ongoing updates
2. **Parse README/registry data** programmatically to extract server URLs
3. **Deduplicate entries** across multiple directories
4. **Categorize servers** by functionality (memory, finance, browser, etc.)
5. **Rate relevance** to Borg goals
6. **Auto-install capability** for top-priority servers

---

## Research Tasks

- [ ] Parse punkpeye/awesome-mcp-servers for all server URLs
- [ ] Parse appcypher/awesome-mcp-servers for all server URLs
- [ ] Parse wong2/awesome-mcp-servers for all server URLs
- [ ] Scrape pulsemcp.com for server listings
- [ ] Scrape playbooks.com/mcp for server listings
- [ ] Scrape toolsdk-mcp-registry for server listings
- [ ] Scrape Docker Hub MCP catalog for server listings
- [ ] Cross-reference and deduplicate all servers
- [ ] Create master server list with metadata (name, URL, category, rating)
- [ ] Implement auto-installation capability

---

## Extracted Servers

*Servers will be listed here as they are extracted and researched*

---

## Related

- [MCP Tool RAG/Disclosure](../mcp-tool-rag/README.md)
- [MCP Hubs](../../mcp-hubs/)
