import WebSocket from 'ws';

console.log("DEBUG: Testing WebSocket Connectivity to ws://localhost:3001...");

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
    console.log("SUCCESS: Connected to Borg Hub!");
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.error("FAILURE: Could not connect:", err.message);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error("TIMEOUT: Connection attempt timed out (5s).");
    process.exit(1);
}, 5000);
