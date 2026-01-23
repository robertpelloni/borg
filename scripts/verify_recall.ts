
import fetch from 'node-fetch';

async function run() {
    console.log("Testing Memory Recall...");

    // Search Query
    const query = "How does the Director agent work?";

    const input = {
        name: "search_codebase",
        args: {
            query: query
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
        console.log("Raw Response:", JSON.stringify(text, null, 2));

        // @ts-ignore
        if (text[0]?.result?.data) {
            console.log("Search Results:\n", text[0].result.data);
        } else {
            console.log("Error or Empty:", text);
        }
    } catch (e) {
        console.error("Search Failed:", e);
    }
}

run();
