const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const cmd = args[0];
const cmdArgs = args.slice(1);

const child = spawn(cmd, cmdArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
});

process.stdin.pipe(child.stdin);

let buffer = '';

child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split('\n');
    buffer = parts.pop();

    for (const line of parts) {
        if (!line.trim()) continue;
        try {
            JSON.parse(line);
            process.stdout.write(line + '\n');
        } catch (e) {
            console.error(`[Wrapped Stderr]: ${line}`);
        }
    }
});

child.stderr.pipe(process.stderr);

child.on('exit', (code) => process.exit(code));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
