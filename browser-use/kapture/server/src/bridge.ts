#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

process.title = 'Kapture MCP Bridge';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MCPWebSocketBridge = require('mcp2websocket');

const serverPath = join(__dirname, 'index.js');
const serverProcess = spawn(process.execPath, [serverPath], {
  detached: true,
  stdio: 'ignore'
});

serverProcess.unref();

setTimeout(() => {
  try {
    const bridge = new MCPWebSocketBridge('ws://localhost:61822/mcp', {});
    bridge.start();
    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error('Failed to start bridge:', error);
    process.exit(1);
  }
}, 1000);