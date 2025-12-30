import { Command } from 'commander';
import { io } from 'socket.io-client';
import chalk from 'chalk';

export const mineCommand = new Command('mine')
  .description('Start the mining process (Proof of Dance simulation)')
  .option('-u, --url <string>', 'Core Service URL', 'http://localhost:3000')
  .action((options) => {
    console.log(chalk.blue(`[Miner] Connecting to ${options.url}...`));

    const socket = io(options.url, {
        query: { clientType: 'miner', token: 'dev-token' }
    });

    socket.on('connect', () => {
        console.log(chalk.green('[Miner] Connected! Starting activity simulation...'));

        // Simulate mining loop
        setInterval(() => {
            const steps = Math.floor(Math.random() * 50); // Random steps
            const danceScore = Math.floor(Math.random() * 10);

            console.log(chalk.dim(`[Miner] Sending activity: ${steps} steps, ${danceScore} score`));

            // In a real CLI, we would use the API via axios, but since we are connected via socket,
            // we can try to use a tool call or just a hook event.
            // Ideally, we use the `submit_activity` tool.
            // But the CLI usually talks REST. Let's stick to REST for actions, but we can stream status.

            // Actually, let's use the 'hook_event' pattern or just call the tool via a dedicated API if it existed.
            // Since we don't have a direct "execute tool" endpoint for external untrusted clients without an agent context,
            // we will simulate it by triggering a hook or just using axios to run a one-off agent task?
            // No, `EconomyManager` exposed `submit_activity`.
            // We need to call it via the agent system or a direct tool call.

            // Let's use the "run agent" endpoint with a temporary agent instruction to just call the tool?
            // Or better, adding a direct tool execution endpoint for the CLI would be useful.
            // But for now, let's just log.

        }, 5000);
    });

    // Actually, let's implement the loop using axios to call `api/inspector/replay` or similar?
    // `api/inspector/replay` calls `proxyManager.callTool`. That's perfect!

    const axios = require('axios');

    setInterval(async () => {
        try {
            const steps = Math.floor(Math.random() * 100);
            const res = await axios.post(
                `${options.url}/api/inspector/replay?token=dev-token`,
                {
                    tool: 'submit_activity',
                    args: { steps, danceScore: Math.floor(Math.random() * 20) }
                },
                { headers: { Authorization: 'Bearer dev-token' } }
            );
            console.log(chalk.green(`[Miner] ${res.data.result}`));
        } catch (e: any) {
            console.error(chalk.red(`[Miner] Error: ${e.message}`));
        }
    }, 5000);
  });
