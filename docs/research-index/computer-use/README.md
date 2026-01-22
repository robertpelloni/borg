# Computer Use / Browser

**Purpose**: Computer control, browser automation, screen interaction systems

## Overview

Computer-use and browser automation systems enable AI agents to interact with GUIs, web pages, and desktop applications. This category tracks frameworks and MCP servers for Borg's computer-use capabilities.

## Known Systems

### Computer Use Frameworks

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| CUA | https://github.com/trycua/cua | 📖 Fully Researched | Computer Use Agent |
| FARA | https://github.com/microsoft/fara | ❓ Not Started | Microsoft's agent |
| Magentic UI | https://github.com/microsoft/magentic-ui | ❓ Not Started | UI automation |
| MCP-OODA-Computer | https://github.com/Mnehmos/MCP-OODA-Computer | ❓ Not Started | OODA computer use |
| GeneralAgents | https://github.com/generalagents/generalagents-python | ❓ Not Started | General purpose |
| FARA Research | https://www.microsoft.com/en-us/research/blog/fara-7b-an-efficient-agentic-model-for-computer-use/ | ❓ Not Started | FARA research |
| Spark-MCP | https://github.com/sensuslab/spark-mcp | 📖 Fully Researched | Spark MCP |
| ClickClickClick | https://github.com/instavm/clickclickclick | ❓ Not Started | Click automation |
| Algonius Browser | https://github.com/algonius/algonius-browser | ❓ Not Started | Browser automation |
| Kapture | https://github.com/williamkapke/kapture | ❓ Not Started | Screen recording |

### MCP Browser Servers

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| chrome-devtools-mcp | https://github.com/ChromeDevTools/chrome-devtools-mcp | 📖 Fully Researched | Chrome DevTools MCP |
| playwright-mcp | https://github.com/microsoft/playwright-mcp | 📖 Fully Researched | Playwright MCP |
| computer-control-mcp | https://github.com/AB498/computer-control-mcp | 📖 Fully Researched | Control MCP |
| DesktopCommanderMCP | https://github.com/wonderwhy-er/DesktopCommanderMCP | 📖 Fully Researched | Desktop control |
| spark-mcp | https://github.com/sensuslab/spark-mcp | 📖 Fully Researched | Spark browser |
| clickclickclick | https://github.com/instavm/clickclickclick | ❓ Not Started | Click automation |
| fara | https://github.com/microsoft/fara | ❓ Not Started | FARA MCP |
| generalagents-python | https://github.com/generalagents/generalagents-python | ❓ Not Started | General agents |
| algonius-browser | https://github.com/algonius/algonius-browser | ❓ Not Started | Algonius |
| cua | https://github.com/trycua/cua | ❓ Not Started | CUA MCP |

### Browser Extensions

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| Algonius Browser Extension | https://chromewebstore.google.com/detail/algonius-browser-mcp/fmcmnpejjhphnfdaegmdmahkgaccghem | ❓ Not Started | Chrome extension |

### Documentation & Tutorials

| Resource | URL | Status | Notes |
|----------|-----|--------|-------|
| Computer Use Demo | https://github.com/anthropics/claude-quickstarts/tree/main/computer-use-demo | 📖 Fully Researched | Anthropic tutorial |
| Puppeteer | https://github.com/puppeteer/puppeteer | 📖 Fully Researched | Browser automation |

---

## Integration Strategy

1. **Add as submodules** for reference
2. **Study computer-use patterns** (screen capture, clicking, typing)
3. **Implement browser automation** using Playwright
4. **Add desktop control** for native apps
5. **Create computer-use MCP** as universal server
6. **Build visual feedback** system (screenshots, recordings)

---

## Borg Computer-Use Architecture

Borg should provide:
- **Browser automation**: Control Chrome/Firefox via Playwright
- **Desktop control**: Click, type, drag on screen elements
- **Screen capture**: Real-time screenshots for visual context
- **Video streaming**: Live screen feed for models
- **Element identification**: AI-powered UI element detection
- **Natural language actions**: "Click the blue button", "Open settings"
- **Browser extension**: Inject into web pages for direct control
- **Console access**: Read debug console for errors
- **History scraping**: Extract browsing history
- **Session recording**: Save computer-use sessions for review

---

## Research Tasks

- [ ] Study CUA architecture
- [ ] Analyze FARA research
- [ ] Research computer-use MCP specs
- [ ] Study Playwright automation patterns
- [ ] Analyze screen capture methods
- [ ] Research element detection algorithms
- [ ] Study browser extension architecture
- [ ] Design universal computer-use MCP
- [ ] Implement Playwright integration
- [ ] Build visual feedback system

---

## Related

- [Browsers](../browsers/README.md)
- [MCP Tool RAG](../mcp-tool-rag/README.md)
