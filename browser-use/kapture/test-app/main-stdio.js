const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

let mainWindow;
let mcpProcess;
let messageId = 1;
const pendingRequests = new Map();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let port = 61822;
  let dev = false;
  
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      const parsedPort = parseInt(args[i + 1], 10);
      if (!isNaN(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
        port = parsedPort;
        i++; // Skip next argument
      } else {
        console.error(`Invalid port number: ${args[i + 1]}`);
        process.exit(1);
      }
    } else if (args[i] === '--dev') {
      dev = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Kapture Test App');
      console.log('Usage: npm start -- [options]');
      console.log('');
      console.log('Options:');
      console.log('  -p, --port <number>  WebSocket port (default: 61822)');
      console.log('  --dev               Open DevTools on startup');
      console.log('  -h, --help          Show this help message');
      process.exit(0);
    }
  }
  
  return { port, dev };
}

const { port: wsPort, dev: isDev } = parseArgs();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  // Kill MCP process before reload
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'r' && (input.meta || input.control)) {
      if (mcpProcess) {
        console.log('Killing MCP process before reload');
        mcpProcess.kill();
        mcpProcess = null;
      }
    }
  });
}

app.whenReady().then(async () => {
  // Note: We don't kill existing servers on app startup anymore
  // The prompt will appear when connecting to MCP
  createWindow();
});

app.on('window-all-closed', () => {
  killMCPProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killMCPProcess();
});

// Helper to ensure MCP process is killed
function killMCPProcess() {
  if (mcpProcess) {
    console.log('Killing MCP process...');
    mcpProcess.kill('SIGTERM');

    // Force kill after a moment if still alive
    setTimeout(() => {
      if (mcpProcess && !mcpProcess.killed) {
        console.log('Force killing MCP process...');
        mcpProcess.kill('SIGKILL');
      }
    }, 100);

    mcpProcess = null;
  }
}

// Kill any process using port 61822
function killProcessOnPort(port, skipPrompt = false) {
  return new Promise((resolve) => {
    // On macOS/Linux, use lsof to find process using the port
    exec(`lsof -ti tcp:${port}`, async (error, stdout) => {
      if (error || !stdout.trim()) {
        // No process found or error
        resolve();
        return;
      }

      const pid = stdout.trim();
      console.log(`Found existing process on port ${port} with PID: ${pid}`);

      // Get process info
      exec(`ps -p ${pid} -o comm=`, async (psError, psStdout) => {
        const processName = psError ? 'Unknown' : psStdout.trim();

        let shouldKill = skipPrompt;

        if (!skipPrompt && mainWindow) {
          // Show dialog to confirm
          const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Kill Process', 'Cancel'],
            defaultId: 0,
            title: 'Existing Server Found',
            message: `A process is already using port ${port}`,
            detail: `Process: ${processName} (PID: ${pid})\n\nThis might be a Kapture server from Claude Desktop or another instance.\n\nDo you want to kill it and start a new server?`
          });

          shouldKill = result.response === 0;
        }

        if (shouldKill) {
          // Kill the process
          exec(`kill -9 ${pid}`, (killError) => {
            if (killError) {
              console.error(`Failed to kill process ${pid}:`, killError);
              if (mainWindow) {
                dialog.showErrorBox('Failed to Kill Process', `Could not kill process ${pid}: ${killError.message}`);
              }
            } else {
              console.log(`Killed process ${pid} on port ${port}`);
              if (mainWindow) {
                mainWindow.webContents.send('mcp-notification', {
                  method: 'log',
                  params: { message: `Killed existing server process (${processName} PID: ${pid})`, type: 'info' }
                });
              }
            }
            // Give it a moment to release the port
            setTimeout(resolve, 500);
          });
        } else {
          // User cancelled, don't kill the process
          resolve();
        }
      });
    });
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// MCP Communication
let buffer = '';

function handleMCPMessage(message) {
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
    // Kill any existing process first (handles refreshes)
    killMCPProcess();

    // Check if port is in use and prompt to kill
    const portInUse = await new Promise((resolve) => {
      exec(`lsof -ti tcp:${wsPort}`, (error, stdout) => {
        resolve(!error && stdout.trim());
      });
    });

    if (portInUse) {
      // Kill any process using the specified port
      await killProcessOnPort(wsPort);

      // Check again if port is still in use (user might have cancelled)
      const stillInUse = await new Promise((resolve) => {
        exec(`lsof -ti tcp:${wsPort}`, (error, stdout) => {
          resolve(!error && stdout.trim());
        });
      });

      if (stillInUse) {
        // User cancelled the kill dialog
        return {
          success: false,
          error: `Port ${wsPort} is still in use. Please close the existing server or choose to kill it.`
        };
      }
    }

    if (mcpProcess) {
      // Wait a moment for the process to fully terminate
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Spawn the MCP server
    const serverPath = path.join(__dirname, '..', 'server', 'dist', 'index.js');

    const inspector = require('inspector');

    // Check if the current process is running in debug mode
    const isDebugging = inspector.url();

    // Build node arguments
    const nodeArgs = isDebugging ? ['--inspect=localhost:9030'] : [];
    nodeArgs.push(serverPath);
    nodeArgs.push('--port', wsPort.toString());

    mcpProcess = spawn('node', nodeArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env
      }
    });

    if (isDebugging) {
      console.log('MCP Server starting in debug mode...');
      console.log('Watch for "Debugger listening on ws://..." message in stderr to find the port');
    }

    // Handle stdout
    mcpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      mainWindow.webContents.send('mcp-notification', {
        method: 'log',
        params: { message: `[STDIO RECV] ${dataStr}`, type: 'debug' }
      });

      buffer += dataStr;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            handleMCPMessage(message);
          } catch (error) {
            console.error('Failed to parse MCP message:', error);
            mainWindow.webContents.send('mcp-notification', {
              method: 'log',
              params: { message: `[PARSE ERROR] ${error.message}: ${line}`, type: 'error' }
            });
          }
        }
      }
    });

    // Handle stderr
    mcpProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      console.error('MCP stderr:', errorMsg);

      // Send all stderr as debug logs to see server logging
      mainWindow.webContents.send('mcp-notification', {
        method: 'log',
        params: { message: `[SERVER LOG] ${errorMsg.trim()}`, type: 'debug' }
      });

      // Check for common errors
      if (errorMsg.includes('EADDRINUSE')) {
        mainWindow.webContents.send('mcp-error', {
          type: 'PORT_IN_USE',
          message: 'Port 61822 is already in use. Another instance of the server may be running.'
        });
      } else if (errorMsg.includes('Error:')) {
        mainWindow.webContents.send('mcp-error', {
          type: 'STDERR',
          message: errorMsg
        });
      }
    });

    // Handle exit
    mcpProcess.on('exit', (code) => {
      mainWindow.webContents.send('mcp-disconnected', { code });
      mcpProcess = null;

      // If we haven't initialized yet and the process exits, it's likely a startup error
      if (pendingRequests.size > 0) {
        const initRequest = Array.from(pendingRequests.values()).find(
          req => req.method === 'initialize'
        );
        if (initRequest) {
          initRequest.reject(new Error('Server failed to start - check console for errors'));
        }
      }
    });

    // Handle error event (for spawn errors)
    mcpProcess.on('error', (error) => {
      console.error('Failed to spawn MCP process:', error);
      mainWindow.webContents.send('mcp-error', {
        type: 'SPAWN_ERROR',
        message: `Failed to start server: ${error.message}`
      });
    });

    // Send initialize request
    const response = await sendMCPRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {}
      },
      clientInfo: {
        name: 'kapture-test-app',
        version: '1.0.0'
      }
    });

    // Send initialized notification
    sendMCPNotification('notifications/initialized', {});

    return { success: true, capabilities: response.capabilities };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Note: mcp-disconnect is no longer used since the server runs continuously
// The handler is kept for compatibility but could be removed in the future
ipcMain.handle('mcp-disconnect', async () => {
  // Do nothing - server stays running with the app
  return { success: true };
});

ipcMain.handle('get-port', () => {
  return wsPort;
});

ipcMain.handle('mcp-request', async (event, method, params) => {
  if (!mcpProcess) {
    throw new Error('MCP server not connected');
  }
  return await sendMCPRequest(method, params);
});

function sendMCPRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
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
    }, 5000);

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
      params: { message: `[STDIO SEND] ${requestStr}`, type: 'debug' }
    });
    
    if (!mcpProcess || !mcpProcess.stdin) {
      reject(new Error('MCP process not available'));
      return;
    }
    
    mcpProcess.stdin.write(requestStr + '\n');
  });
}

function sendMCPNotification(method, params = {}) {
  if (!mcpProcess) return;

  const notification = {
    jsonrpc: '2.0',
    method,
    params
  };

  mcpProcess.stdin.write(JSON.stringify(notification) + '\n');
}
