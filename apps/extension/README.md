# Borg Browser Extension

This extension acts as a bridge between your browser (ChatGPT, Claude, etc.) and the Borg Core agent running on your machine.

## Features
- **Injects Context:** Allows web-based AI coding tools to see your local files.
- **Auto-Clicking:** Allows Borg Director to click "Accept" or "Apply" buttons on web pages.
- **Deep Linking:** Invokes local tools via a command menu.

## How to Install (Developer Mode)

1.  **Build the Extension:**
    Run this command in the repo root or `apps/extension` folder:
    ```bash
    pnpm build
    ```
    This creates a `dist` folder.

2.  **Load in Chrome/Edge:**
    1.  Open `chrome://extensions`.
    2.  Enable **"Developer mode"** (toggle in top right).
    3.  Click **"Load unpacked"**.
    4.  Select the `apps/extension/dist` folder (make sure you select the folder containing `manifest.json`!).
        *Note: If `manifest.json` is in the root of `apps/extension` and not `dist`, point to `apps/extension`. (Check `apps/extension/manifest.json` location).*

3.  **Verify:**
    You should see the "Borg Extension" active. It will try to connect to `ws://localhost:3001`.

## Firefox Installation
1.  **Prepare Manifest:**
    Delete `manifest.json` and rename `manifest.firefox.json` to `manifest.json`.
    *(Firefox requires a slightly different background script configuration).*
2.  **Load:**
    1.  Open `about:debugging`.
    2.  Click **"This Firefox"**.
    3.  Click **"Load Temporary Add-on"**.
    4.  Select the `apps/extension/manifest.json` file.

## Troubleshooting
- **Connection Failed:** Ensure `packages/core` is running (`pnpm start`).
- **Permissions:** The extension requires access to active tab content to inject text.
