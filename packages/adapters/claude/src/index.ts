import { io } from 'socket.io-client';
import spawn from 'cross-spawn';
import chalk from 'chalk';

const CORE_URL = process.env.SUPER_AI_CORE_URL || 'http://localhost:3000';
const socket = io(CORE_URL, {
    query: { clientType: 'cli-adapter', adapter: 'claude' }
});

console.log(chalk.blue(`[SuperClaude] Connecting to ${CORE_URL}...`));

socket.on('connect', () => {
    console.log(chalk.green('[SuperClaude] Connected to Core.'));
    startChildProcess();
});

socket.on('disconnect', () => {
    console.log(chalk.yellow('[SuperClaude] Disconnected from Core.'));
});

function startChildProcess() {
    // In a real scenario, this would wrap the actual 'claude' binary.
    // For now, we simulate it or pass through.
    const args = process.argv.slice(2);
    console.log(chalk.dim(`[SuperClaude] Spawning: claude ${args.join(' ')}`));

    // Fallback: If 'claude' isn't in path, we might fail.
    // Ideally user has 'claude' installed via npm i -g @anthropic-ai/claude-code

    const child = spawn('claude', args, { stdio: 'pipe' });

    child.stdout?.on('data', (data) => {
        process.stdout.write(data);
        socket.emit('hook_event', {
            type: 'log',
            source: 'claude',
            data: data.toString()
        });
    });

    child.stderr?.on('data', (data) => {
        process.stderr.write(data);
    });

    process.stdin.pipe(child.stdin!);

    child.on('close', (code) => {
        console.log(chalk.blue(`[SuperClaude] Process exited with code ${code}`));
        process.exit(code || 0);
    });

    child.on('error', (err) => {
        console.error(chalk.red(`[SuperClaude] Failed to start claude: ${err.message}`));
        console.log(chalk.yellow("Ensure 'claude' is in your PATH or install it via 'npm i -g @anthropic-ai/claude-code'"));
    });
}
