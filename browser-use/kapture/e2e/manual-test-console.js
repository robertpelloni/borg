// Manual test for console logs tool

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketTransport } from '@modelcontextprotocol/sdk/client/websocket.js';

async function testConsoleLogs() {
  console.log('Starting manual console logs test...');
  
  const transport = new WebSocketTransport(new URL('ws://localhost:61822/mcp'));
  const client = new Client({ name: 'console-test', version: '1.0.0' }, { capabilities: {} });
  
  await client.connect(transport);
  console.log('Connected to MCP server');
  
  // List tabs
  const tabsResult = await client.callTool('list_tabs', {});
  const tabs = JSON.parse(tabsResult.content[0].text).tabs;
  
  if (tabs.length === 0) {
    console.log('No tabs connected. Please open test.html and connect.');
    await client.close();
    return;
  }
  
  const tabId = tabs[0].tabId;
  console.log(`Using tab ${tabId}: ${tabs[0].title}`);
  
  // Wait a moment for console logs to be generated
  console.log('Waiting for console logs to be generated...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Try to get console logs
    console.log('Attempting to get console logs...');
    const logsResult = await client.callTool('console_logs', { tabId });
    const logs = JSON.parse(logsResult.content[0].text);
    
    console.log('Console logs retrieved successfully:');
    console.log(JSON.stringify(logs, null, 2));
    
    // Test with filters
    console.log('\nTesting with level filter (errors only)...');
    const errorLogs = await client.callTool('console_logs', { tabId, level: 'error' });
    console.log(JSON.parse(errorLogs.content[0].text));
    
    // Test with limit
    console.log('\nTesting with limit (5 logs)...');
    const limitedLogs = await client.callTool('console_logs', { tabId, limit: 5 });
    console.log(JSON.parse(limitedLogs.content[0].text));
    
  } catch (error) {
    console.error('Error getting console logs:', error);
  }
  
  await client.close();
  console.log('Test complete');
}

testConsoleLogs().catch(console.error);