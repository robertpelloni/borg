import { io } from 'socket.io-client';
import spawn from 'cross-spawn';
import chalk from 'chalk';

const CORE_URL = process.env.SUPER_AI_CORE_URL || 'http://localhost:3000';
const socket = io(CORE_URL, {
    query: { clientType: 'cli-adapter', adapter: 'gemini' }
});

console.log(chalk.blue(`[SuperGemini] Connecting to ${CORE_URL}...`));

socket.on('connect', () => {
    console.log(chalk.green('[SuperGemini] Connected to Core.'));
    startChildProcess();
});

function startChildProcess() {
    const args = process.argv.slice(2);
    // Assuming 'gemini' binary exists
    const child = spawn('gemini', args, { stdio: 'pipe' });

    child.stdout?.on('data', (data) => {
        process.stdout.write(data);
        socket.emit('hook_event', {
            type: 'log',
            source: 'gemini',
            data: data.toString()
        });
    });

    child.stderr?.on('data', (data) => {
        process.stderr.write(data);
    });

    process.stdin.pipe(child.stdin!);

    child.on('close', (code) => {
        process.exit(code || 0);
    });

    child.on('error', (err) => {
        console.error(chalk.red(`[SuperGemini] Failed to start gemini: ${err.message}`));
    });
}
