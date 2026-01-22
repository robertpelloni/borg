# Research: Browser Connectivity

**Objective:** Connect the borg Hub to the Web Browser (Chrome/Firefox) to allow agents to read/write browser content and interact with web pages.

**Primary Reference:** `references/MCP-SuperAssistant`

## Current State
- The Hub (`packages/core`) runs a Socket.io server and an MCP server (SSE/Stdio).
- We have no direct browser integration yet.

## Contenders / Approaches

### 1. MCP-SuperAssistant (Extension Bridge)
- **Architecture:** A Chrome Extension that connects to a local WebSocket server.
- **Mechanism:**
    - The extension injects a content script into pages.
    - It communicates with the local server via WebSocket.
    - The local server exposes this as an MCP tool (e.g., `browser_get_content`, `browser_click`).
- **Pros:**
    - Direct control over the browser.
    - Can inject UI overlays (e.g., "Agent is working...").
    - Leverages existing `MCP-SuperAssistant` codebase.
- **Cons:**
    - Requires installing a custom extension.
    - Security implications of allowing local server to control browser.

### 2. Playwright / Puppeteer (Headless/Headed)
- **Architecture:** The Hub spawns a Playwright instance (headless or headed).
- **Mechanism:**
    - The Agent uses `playwright` tools to navigate and interact.
- **Pros:**
    - Full control, no extension needed.
    - Standard automation API.
- **Cons:**
    - Separate browser instance (not the user's actual browser).
    - Heavy resource usage.
    - User cannot easily "see" or "intervene" in the same session (unless headed mode is managed carefully).

### 3. Debugging Protocol (CDP)
- **Architecture:** Connect to the user's running Chrome instance via Chrome DevTools Protocol (remote debugging port).
- **Mechanism:**
    - User starts Chrome with `--remote-debugging-port=9222`.
    - Hub connects to `localhost:9222`.
- **Pros:**
    - Controls the *actual* user browser.
    - No extension needed (just a flag).
- **Cons:**
    - Requires restarting Chrome with flags.
    - Security risks (open debugging port).
    - Flaky connection management.

## Recommendation
**Adopt Approach 1 (MCP-SuperAssistant Extension Bridge).**
- It aligns with the "borg" vision of integrating with the user's environment.
- It allows for a seamless UX (Agent sees what User sees).
- We can fork/adapt `MCP-SuperAssistant` to connect specifically to our Hub's Socket.io server.

## Implementation Plan
1.  **Analyze `references/MCP-SuperAssistant`:** Understand its WebSocket protocol.
2.  **Create `packages/browser-extension`:** Port the extension code into our monorepo.
3.  **Update Hub:** Add a WebSocket handler in `packages/core` to accept connections from the extension.
4.  **Expose Tools:** Register `browser_*` tools in the Hub that route commands to the connected extension.
