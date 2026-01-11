# Kapture E2E Tests

This directory contains end-to-end tests for the Kapture MCP Browser Automation extension.

## Setup

1. Install dependencies:
   ```bash
   cd e2e
   npm install
   ```

2. Build the server (if not already built):
   ```bash
   cd ../server
   npm run build
   ```

3. Make sure the Kapture extension is installed in Chrome

4. Open http://localhost:61822/test.html in a browser tab (the extension will auto-connect)

## Running Tests

Run all tests:
```bash
npm test
```

Run a specific test file:
```bash
npm test test/basic.test.js
```

## Test Structure

- `test-framework.js` - Core framework that handles:
  - Starting/stopping the server
  - Creating MCP client connections
  - Helper methods for tool calls and resource reads

- `test/` directory - Contains test files:
  - `basic.test.js` - Basic functionality tests (resources, tools, tabs)

## Adding New Tests

1. Create a new test file in the `test/` directory
2. Import the test framework:
   ```javascript
   import { TestFramework } from '../test-framework.js';
   ```
3. Use the framework methods to interact with Kapture

## Notes

- The framework will check if a server is already running before starting a new one
- Tests require a browser with the Kapture extension to be open on the test page
- The test page (test.html) includes various elements for testing all tools