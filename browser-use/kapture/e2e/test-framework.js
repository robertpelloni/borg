import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import WebSocket from 'ws';
import {delay} from "./test/helpers.js";

// Make WebSocket available globally for the MCP SDK
globalThis.WebSocket = WebSocket;

class TestFramework {
  constructor() {
    this.mcpClient = null;
    this.serverPort = 61822;
    this.testTab = null; // Store the test tab for the entire test run
  }

  async startServer() {
    console.log('Starting server...');
    const serverProcess = spawn('npm', ['start'], {
      cwd: '../server',
      env: { ...process.env },
      detached: true,  // Run independently of parent
      stdio: 'ignore'  // Don't inherit stdio
    });

    serverProcess.unref(); // Allow parent to exit without killing child
  }
  async connectMCP() {
    const transport = new WebSocketClientTransport(new URL(`ws://localhost:${this.serverPort}/mcp`));

    this.mcpClient = new Client({
      name: 'kapture-e2e-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.mcpClient.connect(transport);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    return this.mcpClient;
  }

  async listResources() {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    const response = await this.mcpClient.listResources();
    return response.resources;
  }

  async listTools() {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    const response = await this.mcpClient.listTools();
    return response.tools;
  }

  async callTool(name, args) {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    if (name !== 'list_tabs' && name !== 'new_tab' && !args.tabId) {
      args.tabId = this.testTab.tabId;
    }
    return await this.mcpClient.callTool({ name, arguments: args});
  }

  async callToolAndParse(name, args) {
    const result = await this.callTool(name, args);
    return JSON.parse(result.content[0].text);
  }

  async readResource(uri) {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    return await this.mcpClient.readResource({ uri });
  }

  async getTab(tabId) {
    const tabs = (await this.callToolAndParse('list_tabs', {})).tabs;
    return tabs.find(tab => tab.tabId === tabId);
  }

  async openTestPage() {
    if (this.testTab) {
      return this.testTab; // Return existing tab if already opened
    }
    // Open a new tab and navigate it to the test page
    const id = Date.now().toString();
    const testUrl = `http://localhost:${this.serverPort}/test.html?id=${id}`;

    try {
      // Use new_tab tool to open a new browser tab
      const newTabResult = await this.callToolAndParse('new_tab', {});

      if (!newTabResult.success) {
        throw new Error(`Failed to open new tab: ${newTabResult.error || 'Unknown error'}`);
      }

      // Wait for the new tab to connect
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the newly created tab
      let newTab = await this.getTab(newTabResult.tabId);
      if (!newTab) {
        throw new Error('New tab was created but not found in tabs list');
      }

      // Navigate the new tab to the test page
      const navResult = await this.callToolAndParse('navigate', { tabId: newTab.tabId, url: testUrl });
      if (!navResult.success) {
        throw new Error(`Failed to navigate to test page: ${navResult.error || 'Unknown error'}`);
      }
      return this.testTab = await this.getTab(newTab.tabId);
    } catch (error) {
      throw new Error(`Failed to open test page: ${error.message}`);
    }
  }
  async cleanup() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
  }
}

// Create a single instance to be shared across all test files
export const framework = new TestFramework();

// Start server
await framework.startServer();
await delay(1000); // Wait for server to start

// Connect MCP client
console.log('Connecting MCP client...');
await framework.connectMCP();

await framework.openTestPage();
