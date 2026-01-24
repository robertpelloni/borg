
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001');

const CALLS = [
    {
        method: "tools/call",
        params: {
            name: "start_auto_drive",
            arguments: {}
        }
    }
];

ws.on('open', async () => {
    console.log("Connected to Borg Core (ws://localhost:3001) - Requesting Auto-Drive...");

    let id = 1;
    for (const call of CALLS) {
        const request = {
            jsonrpc: "2.0",
            id: id++,
            method: call.method,
            params: call.params
        };

        console.log(`Sending: ${call.params.name}...`);
        ws.send(JSON.stringify(request));

        // Wait briefly
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("✅ Auto-Drive Signal Sent. The Director should now be autonomous.");
    ws.close();
});

ws.on('message', (data) => {
    console.log("Response:", data.toString());
});

ws.on('error', (err) => {
    console.error("Connection Error:", err.message);
    console.error("Ensure Borg Core is running (pnpm start)!");
    process.exit(1);
});
