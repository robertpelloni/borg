const { app, BrowserWindow, ipcMain, dialog } = require('electron');

// Set app name before anything else
app.setName('Kapture Test Client');

const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let mcpWebSocket;
let messageId = 1;
const pendingRequests = new Map();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let dev = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dev') {
      dev = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Kapture Test App (WebSocket Mode)');
      console.log('Usage: npm start -- [options]');
      console.log('');
      console.log('Options:');
      console.log('  --dev               Open DevTools on startup');
      console.log('  -h, --help          Show this help message');
      process.exit(0);
    }
  }

  return { dev };
}

const { dev: isDev } = parseArgs();
const wsPort = 61822; // Fixed port

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Kapture Test Client',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  createWindow();
});

app.on('window-all-closed', () => {
  disconnectMCPWebSocket();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  disconnectMCPWebSocket();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// MCP WebSocket Communication
let reconnectInterval = null;
let reconnectAttempts = 0;
let isReconnecting = false;
let shouldReconnect = true;
let isInitialized = false;

function connectMCPWebSocket() {
  return new Promise((resolve, reject) => {
    try {
      const wsUrl = `ws://localhost:${wsPort}/mcp`;
      console.log(`Connecting to MCP WebSocket at ${wsUrl}`);

      mcpWebSocket = new WebSocket(wsUrl);

      mcpWebSocket.on('open', async () => {
        console.log('MCP WebSocket connected');
        reconnectAttempts = 0;
        isReconnecting = false;

        mainWindow.webContents.send('mcp-notification', {
          method: 'log',
          params: { message: `Connected to MCP WebSocket at ws://localhost:${wsPort}/mcp`, type: 'info' }
        });

        // If we were previously initialized, re-initialize
        if (isInitialized) {
          try {
            await initializeMCPConnection();
            mainWindow.webContents.send('mcp-reconnected');
          } catch (error) {
            console.error('Failed to re-initialize after reconnection:', error);
          }
        }

        resolve();
      });

      mcpWebSocket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleMCPMessage(message);
        } catch (error) {
          console.error('Failed to parse MCP message:', error);
          mainWindow.webContents.send('mcp-notification', {
            method: 'log',
            params: { message: `[PARSE ERROR] ${error.message}: ${data}`, type: 'error' }
          });
        }
      });

      mcpWebSocket.on('close', (code, reason) => {
        console.log(`MCP WebSocket closed: ${code} ${reason}`);
        mainWindow.webContents.send('mcp-disconnected', { code });
        mcpWebSocket = null;

        // Clear any pending requests
        for (const [id, request] of pendingRequests) {
          request.reject(new Error('WebSocket connection closed'));
        }
        pendingRequests.clear();

        // Attempt reconnection if enabled
        if (shouldReconnect && !isReconnecting) {
          isReconnecting = true;
          scheduleReconnect();
        }
      });

      mcpWebSocket.on('error', (error) => {
        console.error('MCP WebSocket error:', error);
        mainWindow.webContents.send('mcp-error', {
          type: 'WEBSOCKET_ERROR',
          message: error.message
        });

        // Don't reject on error if we're going to reconnect
        if (!shouldReconnect) {
          reject(error);
        }
      });

    } catch (error) {
      reject(error);
    }
  });
}

function scheduleReconnect() {
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Exponential backoff, max 30s

  console.log(`Scheduling reconnection attempt ${reconnectAttempts} in ${delay}ms`);
  mainWindow.webContents.send('mcp-notification', {
    method: 'log',
    params: { message: `Reconnecting in ${Math.round(delay/1000)}s... (attempt ${reconnectAttempts})`, type: 'warning' }
  });

  reconnectInterval = setTimeout(() => {
    if (shouldReconnect) {
      connectMCPWebSocket().catch(error => {
        console.error('Reconnection failed:', error);
        // Will trigger another reconnection attempt via the close handler
      });
    }
  }, delay);
}

async function initializeMCPConnection() {
  // Send initialize request
  const response = await sendMCPRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'kapture-test-app-websocket',
      version: '1.0.0'
    }
  });

  // Send initialized notification
  sendMCPNotification('notifications/initialized', {});

  isInitialized = true;
  return response;
}

function disconnectMCPWebSocket() {
  shouldReconnect = false;
  isInitialized = false;

  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
    reconnectInterval = null;
  }

  if (mcpWebSocket) {
    console.log('Disconnecting MCP WebSocket...');
    mcpWebSocket.close();
    mcpWebSocket = null;
  }
}

function handleMCPMessage(message) {
  // Log incoming messages
  mainWindow.webContents.send('mcp-notification', {
    method: 'log',
    params: { message: `[WS RECV] ${JSON.stringify(message)}`, type: 'debug' }
  });

  // Handle JSON-RPC response
  if (message.id !== undefined && pendingRequests.has(message.id)) {
    const { resolve, reject } = pendingRequests.get(message.id);

    if (message.error) {
      reject(new Error(message.error.message || 'Request failed'));
    } else {
      resolve(message.result);
    }

    // Delete after calling resolve/reject so they can clear the timeout
    pendingRequests.delete(message.id);
  }
  // Handle notifications
  else if (message.method && !message.id) {
    mainWindow.webContents.send('mcp-notification', message);
  }
}

// IPC handlers for renderer process
ipcMain.handle('mcp-connect', async () => {
  try {
    // Disconnect any existing connection
    disconnectMCPWebSocket();

    // Reset state for fresh connection
    shouldReconnect = true;
    isInitialized = false;

    // Connect to MCP WebSocket
    await connectMCPWebSocket();

    // Initialize the connection
    const response = await initializeMCPConnection();

    return { success: true, capabilities: response.capabilities };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mcp-disconnect', async () => {
  disconnectMCPWebSocket();
  return { success: true };
});

ipcMain.handle('get-port', () => {
  return wsPort;
});

ipcMain.handle('mcp-request', async (event, method, params) => {
  if (!mcpWebSocket || mcpWebSocket.readyState !== WebSocket.OPEN) {
    throw new Error('MCP WebSocket not connected');
  }
  
  // Calculate timeout based on the tool and its parameters
  let timeout = 5000; // default 5 seconds
  if (method === 'tools/call' && params?.name === 'keypress' && params?.arguments?.delay) {
    // For keypress with delay, add 3 seconds to the delay for overhead
    timeout = Math.max(5000, params.arguments.delay + 3000);
  }
  
  return await sendMCPRequest(method, params, timeout);
});

function sendMCPRequest(method, params = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!mcpWebSocket || mcpWebSocket.readyState !== WebSocket.OPEN) {
      reject(new Error('MCP WebSocket not connected'));
      return;
    }

    const id = messageId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    // Set timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request timeout: ${method}`));
    }, timeoutMs);

    // Store pending request with timeout-aware handlers
    pendingRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
      method,
      timeout
    });

    // Send request
    const requestStr = JSON.stringify(request);
    mainWindow.webContents.send('mcp-notification', {
      method: 'log',
      params: { message: `[WS SEND] ${requestStr}`, type: 'debug' }
    });

    mcpWebSocket.send(requestStr);
  });
}

function sendMCPNotification(method, params = {}) {
  if (!mcpWebSocket || mcpWebSocket.readyState !== WebSocket.OPEN) return;

  const notification = {
    jsonrpc: '2.0',
    method,
    params
  };

  const notificationStr = JSON.stringify(notification);
  mainWindow.webContents.send('mcp-notification', {
    method: 'log',
    params: { message: `[WS SEND] ${notificationStr}`, type: 'debug' }
  });

  mcpWebSocket.send(notificationStr);
}
