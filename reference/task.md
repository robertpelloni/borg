# Phase 16: SuperAI Browser Extension

## 1. Extension Scaffolding
- [x] **Manifest Setup:** Configure `manifest.json` (MV3) for Chrome/Edge.
- [x] **Build Pipeline:** Update `apps/extension/package.json` for extension building (Vite/Webpack).
- [x] **Core Connectivity:** Implement WebSocket client in background script to connect to `ws://localhost:3000` (Core Orchestrator).

## 2. MCP Injection (The Bridge)
- [x] **Content Script:** Inject script into `chatgpt.com`, `claude.ai`, `gemini.google.com`.
- [x] **Prompt Injection:** Add a "/" command menu or UI overlay to these pages to invoke local tools.
- [x] **Tool Execution:** Forward tool calls from the web page -> Extension -> Core -> Local Tool -> Back to Web.
- [x] **Universal MCP Host:** Basic `MCPServer` wrapper created.
- [x] **Router Logic:** Implement sub-MCP routing.
- [x] **Tool Aggregation:** `Router.ts` aggregates tools from connected sub-MCPs.
- [x] **Dashboard UI:** Connect WebUI to Core via tRPC/WebSockets.

## 3. Context & Memory
- [ ] **Page Scraping:** Implement "Read Page" tool (using `read_browser_page` equivalent logic locally or via extension API).
- [ ] **Chat Export:** Button to "Save to Borg Memory" (sends chat content to Vector Store).

## 4. Verification
- [ ] **E2E Test:** Verify a local tool (e.g., `list_files`) can be triggered from a web chat interface.

# Phase 20: Borg Core - Director & Swarm
- [x] **ModelSelector:** Quota management logic and **Automatic Fallback** (Priority).
- [ ] **Orchestration Loop:** Implement the `Director` agent logic to manage sub-agents.

# Phase 24: Borg Supervisor & Extension
- [x] **Scaffold:** Create `packages/borg-supervisor`.
- [x] **Detection Logic:** Implement logic to find Antigravity config paths (User Provided).
- [x] **Installer:** Implement `install_self` tool.
- [ ] **Watchdog:** Implement process monitoring and `nut.js` input injection.
- [ ] **Council Bridge:** Connect Supervisor to `borg-core` approval flow.

# Phase 25: Borg Standard Library
- [ ] **System Tools:** Port `filesystem`, `terminal`, `ripgrep` to Borg Core.
- [ ] **Memory Tools:** Implement RAG/Graph memory tools.
- [ ] **MCP Manager:** Implement Client Lifecycle & Traffic Inspector.

# Phase 26: Dashboard Mission Control
- [ ] **Config Editor:** Implement UI for Antigravity config.
- [ ] **Trace Viewer:** Visualize Supervisor actions.
- [ ] **Remote Access:** Implement Cloudflare Tunnel for mobile support.
