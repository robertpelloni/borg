
import fetch from 'node-fetch';

async function run() {
    console.log("Starting Autonomy Sequence...");

    // 1. Activate Autonomy (High)
    try {
        console.log("Activating Full Autonomy...");
        const authResponse = await fetch("http://localhost:4000/trpc/autonomy.activateFullAutonomy", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const authText = await authResponse.json();
        console.log("Autonomy Status:", authText);
    } catch (e) {
        console.error("Autonomy Activation Failed:", e);
        return;
    }

    // 2. Trigger Indexing
    console.log("Triggering Codebase Indexing...");
    const input = {
        name: "index_codebase",
        args: {
            path: process.cwd()
        }
    };

    try {
        const response = await fetch("http://localhost:4000/trpc/executeTool?batch=1", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "0": input
            })
        });

        const text = await response.json();
        // tRPC batch response is array
        // @ts-ignore
        const result = text[0].result.data;
        console.log("Indexing Result:", result);
    } catch (e) {
        console.error("Indexing Failed:", e);
    }
}

run();
