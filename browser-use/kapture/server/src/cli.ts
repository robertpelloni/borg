#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const command = process.argv[2];

// Default to server if no command provided
if (!command || command === 'server') {
  const serverPath = join(__dirname, 'index.js');
  const args = command === 'server' ? process.argv.slice(3) : process.argv.slice(2);
  const child = spawn(process.execPath, [serverPath, ...args], {
    stdio: 'inherit'
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else if (command === 'bridge') {
  const bridgePath = join(__dirname, 'bridge.js');
  const child = spawn(process.execPath, [bridgePath, ...process.argv.slice(3)], {
    stdio: 'inherit'
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else if (command === 'setup') {
  const setupPath = join(__dirname, 'setup.js');
  const child = spawn(process.execPath, [setupPath, ...process.argv.slice(3)], {
    stdio: 'inherit'
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: kapture-mcp [command]');
  console.error('Commands:');
  console.error('  server  Run the MCP server (default)');
  console.error('  bridge  Run the stdio-to-websocket bridge');
  console.error('  setup   Run the setup wizard');
  process.exit(1);
}