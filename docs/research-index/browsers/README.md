# Browsers

**Purpose**: Browser extensions and browser-based AI interfaces

## Overview

Browser extensions enable AI assistants to interact with web-based AI interfaces (ChatGPT, Gemini, Claude, etc.) and provide memory, context, and control capabilities.

## Known Browser Extensions & Tools

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| MCP Chrome | https://github.com/hangwin/mcp-chrome | ❓ Not Started | Chrome MCP bridge |
| HyperBrowser MCP | https://github.com/hyperbrowserai/mcp | ❓ Not Started | Browser MCP |
| OpenWebUI MCPO | https://github.com/open-webui/mcpo | ❓ Not Started | OpenWebUI MCP |

---

## Borg Browser Extension Goals

Borg should provide a browser extension that enables:

### Memory & Context
- **Store memories** from web chat sessions
- **Universal memory** access from any web UI
- **Export browser sessions** to Borg
- **Import Borg context** to web UI
- **Auto-harvest** important information from chats

### Control & Automation
- **Browser-use** capabilities from web UI
- **Console access** for debugging
- **Page scraping** for RAG ingestion
- **History scraping** for context
- **Computer-use** bridge to desktop

### Integration
- **Connect to all AI interfaces**: ChatGPT, Gemini, Claude, Grok, Kimi, Deepseek
- **Provider dashboards**: Link to credit/balance pages
- **Account management**: OAuth, API key handling
- **Email integration**: Gmail access for RAG
- **Drive integration**: Google Drive for document storage

### Communication
- **Send local projects** to cloud dev
- **Receive remote projects** from cloud dev
- **Mobile control**: Control sessions from phone
- **Session sync** across devices

---

## Research Tasks

- [ ] Study browser extension architecture
- [ ] Research MCP-Web protocol
- [ ] Analyze existing AI browser extensions
- [ ] Design memory harvesting system
- [ ] Design computer-use bridge
- [ ] Study OAuth patterns
- [ ] Design mobile communication
- [ ] Implement browser extension
- [ ] Integrate with all AI web UIs

---

## Related

- [Computer Use](../computer-use/README.md)
- [Memory Systems](../memory-systems/README.md)
