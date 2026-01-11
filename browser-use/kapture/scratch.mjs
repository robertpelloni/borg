import * as cp from 'node:child_process';
const { exec, spawn, execFile } = cp.promises;

// Usage
const { stdout } = await exec('ls -la');
console.log(stdout);
