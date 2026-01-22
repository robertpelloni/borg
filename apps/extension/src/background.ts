
// Background Service Worker
const CORE_URL = 'ws://localhost:3001'; // AIOS Core URL
let socket: WebSocket | null = null;
const pendingRequests = new Map<string, (response: any) => void>();

function connect() {
    console.log('Connecting to AIOS Core...');
    socket = new WebSocket(CORE_URL);

    socket.onopen = () => {
        console.log('Connected to AIOS Core');
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: '#4caf50' });
    };

    socket.onmessage = (event) => {
        console.log('Message from Core:', event.data);
        try {
            const data = JSON.parse(event.data);

            // Handle Direct UI Commands
            const uiCommands = ['INSERT_TEXT', 'SUBMIT_CHAT', 'CLICK_ELEMENT'];
            if (uiCommands.includes(data.type)) {
                // Find active tab and send message
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, data);
                    }
                });
                return;
            }

            // Handle JSON-RPC Responses
            if (data.id && pendingRequests.has(data.id)) {
                const resolver = pendingRequests.get(data.id);
                if (resolver) {
                    resolver(data);
                    pendingRequests.delete(data.id);
                }
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message', e);
        }
    };

    socket.onclose = () => {
        console.log('Disconnected from AIOS Core');
        chrome.action.setBadgeText({ text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
        setTimeout(connect, 5000); // Reconnect
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
}

// Listen for messages from Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_MCP_TOOL') {
        executeTool(message, sendResponse);
        return true; // Indicates async response
    }
    if (message.type === 'PING') {
        sendResponse({ status: socket?.readyState === 1 ? 'OK' : 'ERROR' });
    }
});

function executeTool(payload: any, sendResponse: (response: any) => void) {
    if (!socket || socket.readyState !== 1) {
        sendResponse({ error: 'AIOS Core Disconnected' });
        return;
    }

    // Wrap in JSON-RPC 2.0
    const requestId = crypto.randomUUID();
    const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call', // MCP Protocol Standard
        params: {
            name: payload.name,
            arguments: payload.arguments
        }
    };

    // Store resolver
    pendingRequests.set(requestId, sendResponse);

    // Send
    console.log('Sending to Core:', jsonRpcRequest);
    socket.send(JSON.stringify(jsonRpcRequest));
}

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect(); // Connect immediately
