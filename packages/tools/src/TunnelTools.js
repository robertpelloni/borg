import { startTunnel } from "untun";
let activeTunnel = null;
let activeUrl = null;
export const TunnelTools = [
    {
        name: "start_remote_access",
        description: "Start a secure Cloudflare Tunnel to expose the local dashboard",
        inputSchema: {
            type: "object",
            properties: {
                port: { type: "number", description: "Port to expose (default: 3000)" }
            }
        },
        handler: async (args) => {
            if (activeTunnel) {
                return { content: [{ type: "text", text: `Tunnel already active at: ${activeUrl}` }] };
            }
            try {
                const port = args.port || 3000;
                activeTunnel = await startTunnel({ port });
                activeUrl = await activeTunnel.getURL();
                return {
                    content: [{
                            type: "text",
                            text: `Remote Access Enabled. URL: ${activeUrl}`
                        }]
                };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Failed to start tunnel: ${err.message}` }] };
            }
        }
    },
    {
        name: "stop_remote_access",
        description: "Stop the active remote access tunnel",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
            if (!activeTunnel) {
                return { content: [{ type: "text", text: "No active tunnel." }] };
            }
            try {
                await activeTunnel.close();
                activeTunnel = null;
                activeUrl = null;
                return { content: [{ type: "text", text: "Remote access disabled." }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Error stopping tunnel: ${err.message}` }] };
            }
        }
    },
    {
        name: "get_remote_access_status",
        description: "Get current remote access URL",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            active: !!activeTunnel,
                            url: activeUrl
                        }, null, 2)
                    }]
            };
        }
    }
];
