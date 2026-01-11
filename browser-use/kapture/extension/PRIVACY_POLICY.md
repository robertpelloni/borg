# Privacy Policy for Kapture Browser Automation

**Last Updated: December 2024**

## Overview

Kapture Browser Automation ("the Extension") is designed to enable local browser automation through the Model Context Protocol (MCP). This privacy policy explains how the Extension handles user data.

## Data Collection and Usage

### What We Access
The Extension may access:
- Current tab URL and title
- Page content (HTML/DOM) when requested
- Browser console logs when requested
- Screenshots of the current tab when requested
- Form field values when automating interactions

### What We DON'T Do
- We do NOT collect or store any personal information
- We do NOT send any data to external servers
- We do NOT track your browsing history
- We do NOT use analytics or tracking services
- We do NOT sell or share any data

### Local Operation Only
All Extension operations are strictly local:
- Communication occurs only with localhost (127.0.0.1) on port 61822
- Data is transmitted only to the MCP server running on your local machine
- No internet connection is required for Extension operation
- No data leaves your computer

## Data Transmission

When you use the Extension:
1. Commands are received from the local MCP server via WebSocket
2. The Extension executes the requested action on the current web page
3. Results are sent back to the local MCP server
4. All communication uses localhost networking only

## Data Storage

The Extension stores:
- Your connection status (connected/disconnected)
- A temporary session Tab ID for the current browser tab
- Command history for the current session (cleared on disconnect)

No persistent data is stored between browser sessions.

## Permissions

The Extension requires certain Chrome permissions:
- `tabs`: To access tab information and execute scripts
- `debugger`: To capture screenshots
- `<all_urls>`: To interact with any website you choose to automate

These permissions are used solely for providing automation functionality and are never used for tracking or data collection.

## Security

- All communication uses WebSocket protocol over localhost
- No authentication tokens or passwords are stored
- Each tab receives a unique session ID that expires on disconnect

## User Control

You have complete control:
- Connect/disconnect at any time via the DevTools panel
- Close the DevTools panel to stop all Extension activity
- Disable or uninstall the Extension at any time via Chrome settings

## Children's Privacy

This Extension is not directed at children under 13 and does not knowingly collect information from children.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

For questions about this privacy policy or the Extension, please visit:
https://github.com/williamkapke/kapture

## Consent

By using the Kapture Browser Automation Extension, you consent to this privacy policy.
