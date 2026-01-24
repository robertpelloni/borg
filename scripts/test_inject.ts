
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001');

const CALLS = [
    {
        method: "tools/call",
        params: {
            name: "chat_reply",
            arguments: { text: "Use your autonomy tool..." }
        }
    }
];

ws.on('open', async () => {
    console.log("Connected to Borg Core (ws://localhost:3001) - Testing Injection...");

    for (const call of CALLS) {
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: call.method,
            params: call.params
        };

        console.log(`Sending: ${call.params.name}...`);
        ws.send(JSON.stringify(request));
        await new Promise(r => setTimeout(r, 500));
    }

    ws.close();
});
