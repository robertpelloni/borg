import fs from 'fs';
import path from 'path';
import os from 'os';
import json5 from 'json5';
import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ShellManager } from './ShellManager.js';

interface ClientConfig {
  name: string;
  configPath: string;
  exists: boolean;
  type: 'json' | 'toml' | 'env';
}

interface CLIAdapter {
  name: string;
  command: string;
  available: boolean;
  version?: string;
  capabilities: CLICapability[];
}

type CLICapability = 'code' | 'chat' | 'edit' | 'shell' | 'vision' | 'web';

interface RunningCLI {
  name: string;
  process: ChildProcess;
  startedAt: Date;
  outputBuffer: string;
}

interface TaskRequest {
  id: string;
  prompt: string;
  cwd?: string;
  preferredCLI?: string;
  requiredCapabilities?: CLICapability[];
  timeout?: number;
}

interface TaskResult {
  id: string;
  cli: string;
  success: boolean;
  output: string;
  duration: number;
  error?: string;
}

interface ParallelTaskResult {
  completed: TaskResult[];
  failed: TaskResult[];
  totalDuration: number;
}

export class ClientManager extends EventEmitter {
  private clients: ClientConfig[] = [];
  private mcpenetesBin: string;
  private shellManager: ShellManager;
  private cliAdapters: Map<string, CLIAdapter> = new Map();
  private runningCLIs: Map<string, RunningCLI> = new Map();
  private taskQueue: Map<string, TaskRequest> = new Map();

  constructor(extraPaths?: { name: string, paths: string[] }[]) {
    super();
    this.shellManager = new ShellManager();
    this.detectClients(extraPaths);
    this.detectCLIAdapters();

    this.mcpenetesBin = path.resolve(process.cwd(), 'submodules/mcpenetes/mcpenetes-bin');
  }

  private detectCLIAdapters() {
    const cliTools: Array<{ name: string; command: string; capabilities: CLICapability[] }> = [
      { name: 'claude', command: 'claude', capabilities: ['code', 'chat', 'edit', 'shell', 'vision'] },
      { name: 'gemini', command: 'gemini', capabilities: ['code', 'chat', 'vision', 'web'] },
      { name: 'opencode', command: 'opencode', capabilities: ['code', 'chat', 'edit', 'shell'] },
      { name: 'aider', command: 'aider', capabilities: ['code', 'edit'] },
      { name: 'cursor', command: 'cursor', capabilities: ['code', 'edit', 'chat'] },
      { name: 'codex', command: 'codex', capabilities: ['code', 'shell'] },
      { name: 'cline', command: 'cline', capabilities: ['code', 'edit', 'shell'] }
    ];

    for (const cli of cliTools) {
      try {
        const result = execSync(`${cli.command} --version 2>&1`, { 
          timeout: 5000, 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        this.cliAdapters.set(cli.name, {
          name: cli.name,
          command: cli.command,
          available: true,
          version: result.trim().split('\n')[0],
          capabilities: cli.capabilities
        });
      } catch {
        this.cliAdapters.set(cli.name, {
          name: cli.name,
          command: cli.command,
          available: false,
          capabilities: cli.capabilities
        });
      }
    }
  }

  getAvailableCLIs(): CLIAdapter[] {
    return Array.from(this.cliAdapters.values()).filter(a => a.available);
  }

  getCLIAdapters(): CLIAdapter[] {
    return Array.from(this.cliAdapters.values());
  }

  findCLIByCapability(capability: CLICapability): CLIAdapter | undefined {
    return this.getAvailableCLIs().find(cli => cli.capabilities.includes(capability));
  }

  selectBestCLI(requirements: CLICapability[]): CLIAdapter | undefined {
    const available = this.getAvailableCLIs();
    let bestMatch: CLIAdapter | undefined;
    let bestScore = 0;
    
    for (const cli of available) {
      const score = requirements.filter(r => cli.capabilities.includes(r)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cli;
      }
    }
    
    return bestScore === requirements.length ? bestMatch : undefined;
  }

  async spawnCLI(cliName: string, args: string[] = [], cwd?: string): Promise<{ pid: number; name: string }> {
    const adapter = this.cliAdapters.get(cliName);
    if (!adapter) throw new Error(`CLI '${cliName}' not found`);
    if (!adapter.available) throw new Error(`CLI '${cliName}' is not installed`);

    if (this.runningCLIs.has(cliName)) {
      throw new Error(`CLI '${cliName}' is already running (PID: ${this.runningCLIs.get(cliName)!.process.pid})`);
    }

    const proc = spawn(adapter.command, args, {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    const runningCLI: RunningCLI = {
      name: cliName,
      process: proc,
      startedAt: new Date(),
      outputBuffer: ''
    };

    proc.stdout?.on('data', (data) => {
      runningCLI.outputBuffer += data.toString();
      this.emit('cli:output', { cli: cliName, data: data.toString() });
    });

    proc.stderr?.on('data', (data) => {
      runningCLI.outputBuffer += data.toString();
      this.emit('cli:error', { cli: cliName, data: data.toString() });
    });

    this.runningCLIs.set(cliName, runningCLI);

    proc.on('exit', (code) => {
      this.runningCLIs.delete(cliName);
      this.emit('cli:exit', { cli: cliName, code });
    });

    return { pid: proc.pid!, name: cliName };
  }

  async executeTask(task: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();
    
    let cli: CLIAdapter | undefined;
    if (task.preferredCLI) {
      cli = this.cliAdapters.get(task.preferredCLI);
      if (!cli?.available) cli = undefined;
    }
    
    if (!cli && task.requiredCapabilities) {
      cli = this.selectBestCLI(task.requiredCapabilities);
    }
    
    if (!cli) {
      cli = this.getAvailableCLIs()[0];
    }
    
    if (!cli) {
      return {
        id: task.id,
        cli: 'none',
        success: false,
        output: '',
        duration: Date.now() - startTime,
        error: 'No available CLI adapters'
      };
    }

    try {
      const args = this.buildCLIArgs(cli.name, task.prompt);
      const result = await this.runCLICommand(cli.command, args, task.cwd, task.timeout);
      
      return {
        id: task.id,
        cli: cli.name,
        success: true,
        output: result,
        duration: Date.now() - startTime
      };
    } catch (err) {
      return {
        id: task.id,
        cli: cli.name,
        success: false,
        output: '',
        duration: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  async executeParallel(tasks: TaskRequest[]): Promise<ParallelTaskResult> {
    const startTime = Date.now();
    const results = await Promise.allSettled(tasks.map(t => this.executeTask(t)));
    
    const completed: TaskResult[] = [];
    const failed: TaskResult[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          completed.push(result.value);
        } else {
          failed.push(result.value);
        }
      }
    }
    
    this.emit('parallel:complete', { completed: completed.length, failed: failed.length });
    
    return {
      completed,
      failed,
      totalDuration: Date.now() - startTime
    };
  }

  async orchestrate(prompt: string, strategy: 'first' | 'all' | 'race' = 'first'): Promise<TaskResult | TaskResult[]> {
    const available = this.getAvailableCLIs();
    if (available.length === 0) {
      throw new Error('No CLI adapters available');
    }

    const taskId = `task_${Date.now()}`;

    switch (strategy) {
      case 'first': {
        return this.executeTask({ id: taskId, prompt });
      }
      case 'all': {
        const tasks = available.map((cli, i) => ({
          id: `${taskId}_${i}`,
          prompt,
          preferredCLI: cli.name
        }));
        const result = await this.executeParallel(tasks);
        return [...result.completed, ...result.failed];
      }
      case 'race': {
        const tasks = available.slice(0, 3).map((cli, i) => ({
          id: `${taskId}_${i}`,
          prompt,
          preferredCLI: cli.name,
          timeout: 60000
        }));
        const results = await Promise.race(
          tasks.map(t => this.executeTask(t))
        );
        return results;
      }
    }
  }

  private buildCLIArgs(cliName: string, prompt: string): string[] {
    switch (cliName) {
      case 'claude':
        return ['-p', prompt, '--no-input'];
      case 'gemini':
        return ['--prompt', prompt];
      case 'opencode':
        return ['-m', prompt];
      case 'aider':
        return ['--message', prompt, '--yes'];
      case 'cursor':
        return ['--prompt', prompt];
      case 'codex':
        return [prompt];
      case 'cline':
        return ['-m', prompt];
      default:
        return [prompt];
    }
  }

  private runCLICommand(command: string, args: string[], cwd?: string, timeout = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
        this.emit('cli:stream', { data: data.toString() });
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(errorOutput || `Process exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  async sendToCLI(cliName: string, input: string): Promise<string> {
    const running = this.runningCLIs.get(cliName);
    if (!running) throw new Error(`CLI '${cliName}' is not running`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(running.outputBuffer || 'No response within timeout');
      }, 30000);

      const originalLength = running.outputBuffer.length;
      
      const checkOutput = setInterval(() => {
        if (running.outputBuffer.length > originalLength + 10) {
          clearInterval(checkOutput);
          clearTimeout(timeout);
          resolve(running.outputBuffer.slice(originalLength));
        }
      }, 100);

      running.process.stdin?.write(input + '\n');
    });
  }

  stopCLI(cliName: string): boolean {
    const running = this.runningCLIs.get(cliName);
    if (!running) return false;

    running.process.kill('SIGTERM');
    this.runningCLIs.delete(cliName);
    this.emit('cli:stopped', { cli: cliName });
    return true;
  }

  stopAllCLIs(): number {
    let count = 0;
    for (const [name] of this.runningCLIs) {
      if (this.stopCLI(name)) count++;
    }
    return count;
  }

  getRunningCLIs(): Array<{ name: string; pid: number; startedAt: Date; outputLength: number }> {
    return Array.from(this.runningCLIs.values()).map(r => ({
      name: r.name,
      pid: r.process.pid!,
      startedAt: r.startedAt,
      outputLength: r.outputBuffer.length
    }));
  }

  private detectClients(extraPaths?: { name: string, paths: string[] }[]) {
    const homeDir = os.homedir();
    const platform = os.platform();

    // Define potential paths for known clients
    const potentialPaths = [
      {
        name: 'VSCode',
        type: 'json',
        paths: [
          platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'mcp-servers.json')
            : path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'mcp-servers.json'),
           // linux path?
           path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'mcp-servers.json')
        ]
      },
      {
        name: 'Claude Desktop',
        type: 'json',
        paths: [
           platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
            : path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        ]
      },
       {
        name: 'Cursor',
        type: 'json',
        paths: [
           platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'mcp-servers.json')
            : path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'mcp-servers.json')
        ]
      },
      {
        name: 'Claude Code',
        type: 'json',
        paths: [
            path.join(homeDir, '.claude', 'config.json') // Hypothetical path for now
        ]
      }
    ];

    if (extraPaths) {
        // @ts-ignore
        potentialPaths.push(...extraPaths);
    }

    this.clients = [];

    for (const p of potentialPaths) {
      for (const tryPath of p.paths) {
        if (fs.existsSync(tryPath)) {
            this.clients.push({ name: p.name, configPath: tryPath, exists: true, type: p.type as any });
            break;
        } else if (p.paths.indexOf(tryPath) === p.paths.length - 1) {
             this.clients.push({ name: p.name, configPath: p.paths[0], exists: false, type: p.type as any });
        }
      }
    }
  }

  getClients() {
    return this.clients.map(c => ({
        ...c,
        exists: fs.existsSync(c.configPath)
    }));
  }

  async installCLI() {
      const binPath = path.resolve(process.cwd(), 'bin', 'aios');
      const aliasCommand = `alias aios="${binPath}"`;
      await this.shellManager.addToProfile('aios CLI', aliasCommand);
      return { status: 'installed', binPath };
  }

  async configureClient(clientName: string, hubConfig: any) {
    const client = this.clients.find(c => c.name === clientName);
    if (!client) throw new Error(`Client ${clientName} not found`);

    // Strategy 1: Try mcpenetes binary (if available and executable)
    if (fs.existsSync(this.mcpenetesBin)) {
        try {
            console.log(`[ClientManager] Using mcpenetes binary at ${this.mcpenetesBin}`);
            const result = execSync(
              `${this.mcpenetesBin} install aios-hub node ${hubConfig.scriptPath}`,
              { encoding: 'utf-8', timeout: 10000 }
            );
            console.log(`[ClientManager] mcpenetes result: ${result}`);
            return { status: 'configured_via_mcpenetes', path: client.configPath };
        } catch (e) {
            console.warn("[ClientManager] mcpenetes failed, falling back to TS implementation", e);
        }
    }

    // Strategy 2: Native TS Implementation
    if (client.type === 'json') {
        let currentConfig: any = { mcpServers: {} };

        if (fs.existsSync(client.configPath)) {
            try {
                const content = fs.readFileSync(client.configPath, 'utf-8');
                currentConfig = json5.parse(content);
            } catch (err) {
                console.error(`Failed to parse config for ${clientName}, starting fresh.`, err);
                fs.copyFileSync(client.configPath, client.configPath + '.bak');
            }
        }

        if (!currentConfig.mcpServers) currentConfig.mcpServers = {};

        currentConfig.mcpServers["aios-hub"] = {
            command: "node",
            args: [hubConfig.scriptPath],
            env: {
                ...hubConfig.env,
                MCP_STDIO_ENABLED: 'true'
            }
        };

        fs.mkdirSync(path.dirname(client.configPath), { recursive: true });
        fs.writeFileSync(client.configPath, JSON.stringify(currentConfig, null, 2));

        return { status: 'configured', path: client.configPath };
    }

    return { status: 'unsupported_type', type: client.type };
  }
}
