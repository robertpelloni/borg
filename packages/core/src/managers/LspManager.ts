import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export type LspServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface LspServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  rootPatterns: string[];
  fileExtensions: string[];
  initializationOptions?: Record<string, unknown>;
}

export interface LspServerInstance {
  config: LspServerConfig;
  status: LspServerStatus;
  process: ChildProcess | null;
  error?: string;
  startedAt?: number;
  projectRoot?: string;
}

export interface LspCapabilities {
  hover: boolean;
  completion: boolean;
  definition: boolean;
  references: boolean;
  rename: boolean;
  diagnostics: boolean;
}

const BUILTIN_LSP_SERVERS: LspServerConfig[] = [
  {
    id: 'typescript',
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    rootPatterns: ['tsconfig.json', 'jsconfig.json', 'package.json'],
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  },
  {
    id: 'python',
    name: 'Pyright',
    command: 'pyright-langserver',
    args: ['--stdio'],
    rootPatterns: ['pyproject.toml', 'setup.py', 'requirements.txt', 'pyrightconfig.json'],
    fileExtensions: ['.py', '.pyi'],
  },
  {
    id: 'rust',
    name: 'Rust Analyzer',
    command: 'rust-analyzer',
    args: [],
    rootPatterns: ['Cargo.toml'],
    fileExtensions: ['.rs'],
  },
  {
    id: 'go',
    name: 'gopls',
    command: 'gopls',
    args: ['serve'],
    rootPatterns: ['go.mod', 'go.sum'],
    fileExtensions: ['.go'],
  },
  {
    id: 'java',
    name: 'Eclipse JDT Language Server',
    command: 'jdtls',
    args: [],
    rootPatterns: ['pom.xml', 'build.gradle', 'build.gradle.kts', '.project'],
    fileExtensions: ['.java'],
  },
  {
    id: 'csharp',
    name: 'OmniSharp',
    command: 'omnisharp',
    args: ['-lsp'],
    rootPatterns: ['*.csproj', '*.sln'],
    fileExtensions: ['.cs'],
  },
  {
    id: 'cpp',
    name: 'clangd',
    command: 'clangd',
    args: ['--background-index'],
    rootPatterns: ['compile_commands.json', 'CMakeLists.txt', '.clangd'],
    fileExtensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'],
  },
  {
    id: 'ruby',
    name: 'Solargraph',
    command: 'solargraph',
    args: ['stdio'],
    rootPatterns: ['Gemfile', '.ruby-version'],
    fileExtensions: ['.rb', '.rake'],
  },
  {
    id: 'php',
    name: 'Intelephense',
    command: 'intelephense',
    args: ['--stdio'],
    rootPatterns: ['composer.json', 'index.php'],
    fileExtensions: ['.php'],
  },
  {
    id: 'lua',
    name: 'Lua Language Server',
    command: 'lua-language-server',
    args: [],
    rootPatterns: ['.luarc.json', '.luacheckrc'],
    fileExtensions: ['.lua'],
  },
  {
    id: 'yaml',
    name: 'YAML Language Server',
    command: 'yaml-language-server',
    args: ['--stdio'],
    rootPatterns: [],
    fileExtensions: ['.yaml', '.yml'],
  },
  {
    id: 'json',
    name: 'VSCode JSON Language Server',
    command: 'vscode-json-language-server',
    args: ['--stdio'],
    rootPatterns: [],
    fileExtensions: ['.json', '.jsonc'],
  },
  {
    id: 'html',
    name: 'VSCode HTML Language Server',
    command: 'vscode-html-language-server',
    args: ['--stdio'],
    rootPatterns: [],
    fileExtensions: ['.html', '.htm'],
  },
  {
    id: 'css',
    name: 'VSCode CSS Language Server',
    command: 'vscode-css-language-server',
    args: ['--stdio'],
    rootPatterns: [],
    fileExtensions: ['.css', '.scss', '.sass', '.less'],
  },
  {
    id: 'vue',
    name: 'Vue Language Server (Volar)',
    command: 'vue-language-server',
    args: ['--stdio'],
    rootPatterns: ['vite.config.ts', 'vite.config.js', 'nuxt.config.ts'],
    fileExtensions: ['.vue'],
  },
  {
    id: 'svelte',
    name: 'Svelte Language Server',
    command: 'svelteserver',
    args: ['--stdio'],
    rootPatterns: ['svelte.config.js', 'svelte.config.ts'],
    fileExtensions: ['.svelte'],
  },
  {
    id: 'kotlin',
    name: 'Kotlin Language Server',
    command: 'kotlin-language-server',
    args: [],
    rootPatterns: ['build.gradle.kts', 'settings.gradle.kts'],
    fileExtensions: ['.kt', '.kts'],
  },
  {
    id: 'swift',
    name: 'SourceKit-LSP',
    command: 'sourcekit-lsp',
    args: [],
    rootPatterns: ['Package.swift', '*.xcodeproj'],
    fileExtensions: ['.swift'],
  },
  {
    id: 'elixir',
    name: 'ElixirLS',
    command: 'elixir-ls',
    args: [],
    rootPatterns: ['mix.exs'],
    fileExtensions: ['.ex', '.exs'],
  },
  {
    id: 'haskell',
    name: 'Haskell Language Server',
    command: 'haskell-language-server-wrapper',
    args: ['--lsp'],
    rootPatterns: ['*.cabal', 'stack.yaml', 'hie.yaml'],
    fileExtensions: ['.hs', '.lhs'],
  },
  {
    id: 'zig',
    name: 'ZLS',
    command: 'zls',
    args: [],
    rootPatterns: ['build.zig'],
    fileExtensions: ['.zig'],
  },
  {
    id: 'terraform',
    name: 'Terraform Language Server',
    command: 'terraform-ls',
    args: ['serve'],
    rootPatterns: ['*.tf', 'terraform.tfstate'],
    fileExtensions: ['.tf', '.tfvars'],
  },
  {
    id: 'dockerfile',
    name: 'Docker Language Server',
    command: 'docker-langserver',
    args: ['--stdio'],
    rootPatterns: ['Dockerfile', 'docker-compose.yml'],
    fileExtensions: [],
    initializationOptions: { dockerfile: true },
  },
  {
    id: 'bash',
    name: 'Bash Language Server',
    command: 'bash-language-server',
    args: ['start'],
    rootPatterns: [],
    fileExtensions: ['.sh', '.bash', '.zsh'],
  },
  {
    id: 'sql',
    name: 'SQL Language Server',
    command: 'sql-language-server',
    args: ['up', '--method', 'stdio'],
    rootPatterns: [],
    fileExtensions: ['.sql'],
  },
  {
    id: 'graphql',
    name: 'GraphQL Language Server',
    command: 'graphql-lsp',
    args: ['server', '-m', 'stream'],
    rootPatterns: ['.graphqlrc', '.graphqlrc.json', '.graphqlrc.yaml', 'graphql.config.js'],
    fileExtensions: ['.graphql', '.gql'],
  },
  {
    id: 'prisma',
    name: 'Prisma Language Server',
    command: 'prisma-language-server',
    args: ['--stdio'],
    rootPatterns: ['schema.prisma'],
    fileExtensions: ['.prisma'],
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS Language Server',
    command: 'tailwindcss-language-server',
    args: ['--stdio'],
    rootPatterns: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'],
    fileExtensions: [],
  },
  {
    id: 'markdown',
    name: 'Marksman',
    command: 'marksman',
    args: ['server'],
    rootPatterns: [],
    fileExtensions: ['.md', '.markdown'],
  },
  {
    id: 'toml',
    name: 'Taplo',
    command: 'taplo',
    args: ['lsp', 'stdio'],
    rootPatterns: [],
    fileExtensions: ['.toml'],
  },
];

export class LspManager extends EventEmitter {
  private static instance: LspManager | null = null;
  private servers: Map<string, LspServerInstance> = new Map();
  private customConfigs: Map<string, LspServerConfig> = new Map();
  private extensionToServer: Map<string, string> = new Map();
  private availableServers: Set<string> = new Set();

  private constructor() {
    super();
    this.buildExtensionMap();
  }

  static getInstance(): LspManager {
    if (!LspManager.instance) {
      LspManager.instance = new LspManager();
    }
    return LspManager.instance;
  }

  static resetInstance(): void {
    if (LspManager.instance) {
      LspManager.instance.stopAll();
    }
    LspManager.instance = null;
  }

  private buildExtensionMap(): void {
    for (const config of this.getAllConfigs()) {
      for (const ext of config.fileExtensions) {
        this.extensionToServer.set(ext, config.id);
      }
    }
  }

  private getAllConfigs(): LspServerConfig[] {
    return [...BUILTIN_LSP_SERVERS, ...this.customConfigs.values()];
  }

  async checkAvailability(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const config of this.getAllConfigs()) {
      const available = await this.isServerAvailable(config);
      results.set(config.id, available);
      if (available) {
        this.availableServers.add(config.id);
      }
    }

    return results;
  }

  private async isServerAvailable(config: LspServerConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(config.command, ['--version'], {
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });

      const timeout = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 3000);

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      proc.on('exit', (code) => {
        clearTimeout(timeout);
        resolve(code === 0 || code === null);
      });
    });
  }

  async detectServersForProject(projectPath: string): Promise<LspServerConfig[]> {
    const detectedServers: LspServerConfig[] = [];
    const seenIds = new Set<string>();

    try {
      const files = await fs.readdir(projectPath);

      for (const config of this.getAllConfigs()) {
        if (seenIds.has(config.id)) continue;

        for (const pattern of config.rootPatterns) {
          const hasWildcard = pattern.includes('*');
          
          if (hasWildcard) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            if (files.some(f => regex.test(f))) {
              detectedServers.push(config);
              seenIds.add(config.id);
              break;
            }
          } else if (files.includes(pattern)) {
            detectedServers.push(config);
            seenIds.add(config.id);
            break;
          }
        }
      }
    } catch (err) {
      console.error(`[LspManager] Error scanning project: ${err}`);
    }

    return detectedServers;
  }

  getServerForFile(filePath: string): LspServerConfig | null {
    const ext = path.extname(filePath).toLowerCase();
    const serverId = this.extensionToServer.get(ext);
    
    if (!serverId) return null;
    
    return this.getAllConfigs().find(c => c.id === serverId) ?? null;
  }

  async startServer(serverId: string, projectRoot: string): Promise<LspServerInstance> {
    const existing = this.servers.get(serverId);
    if (existing && existing.status === 'running') {
      return existing;
    }

    const config = this.getAllConfigs().find(c => c.id === serverId);
    if (!config) {
      throw new Error(`Unknown LSP server: ${serverId}`);
    }

    const instance: LspServerInstance = {
      config,
      status: 'starting',
      process: null,
      projectRoot,
    };

    this.servers.set(serverId, instance);
    this.emit('serverStatusChanged', { serverId, status: 'starting' });

    try {
      const proc = spawn(config.command, config.args, {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        env: { ...process.env, NODE_ENV: 'production' },
      });

      instance.process = proc;
      instance.startedAt = Date.now();

      proc.on('error', (err) => {
        instance.status = 'error';
        instance.error = err.message;
        this.emit('serverStatusChanged', { serverId, status: 'error', error: err.message });
      });

      proc.on('exit', (code) => {
        if (instance.status !== 'error') {
          instance.status = 'stopped';
          instance.process = null;
          this.emit('serverStatusChanged', { serverId, status: 'stopped', exitCode: code });
        }
      });

      proc.stderr?.on('data', (data) => {
        console.error(`[LSP:${serverId}] ${data.toString()}`);
      });

      await this.waitForServerReady(proc, serverId);

      instance.status = 'running';
      this.emit('serverStatusChanged', { serverId, status: 'running' });

      console.log(`[LspManager] Started ${config.name} for ${projectRoot}`);
      return instance;

    } catch (err) {
      instance.status = 'error';
      instance.error = err instanceof Error ? err.message : String(err);
      this.emit('serverStatusChanged', { serverId, status: 'error', error: instance.error });
      throw err;
    }
  }

  private waitForServerReady(proc: ChildProcess, serverId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);

      proc.stdout?.once('data', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      proc.once('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          reject(new Error(`LSP server ${serverId} exited with code ${code}`));
        }
      });
    });
  }

  async stopServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance || !instance.process) return;

    return new Promise((resolve) => {
      const proc = instance.process!;
      
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(timeout);
        instance.status = 'stopped';
        instance.process = null;
        this.emit('serverStatusChanged', { serverId, status: 'stopped' });
        resolve();
      });

      proc.kill('SIGTERM');
    });
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(id => this.stopServer(id));
    await Promise.all(stopPromises);
  }

  async autoLoadForProject(projectPath: string): Promise<string[]> {
    const detected = await this.detectServersForProject(projectPath);
    const startedIds: string[] = [];

    for (const config of detected) {
      if (!this.availableServers.has(config.id)) {
        console.log(`[LspManager] Skipping ${config.name} - not installed`);
        continue;
      }

      try {
        await this.startServer(config.id, projectPath);
        startedIds.push(config.id);
      } catch (err) {
        console.error(`[LspManager] Failed to start ${config.name}: ${err}`);
      }
    }

    return startedIds;
  }

  addCustomConfig(config: LspServerConfig): void {
    this.customConfigs.set(config.id, config);
    this.buildExtensionMap();
  }

  removeCustomConfig(id: string): boolean {
    const result = this.customConfigs.delete(id);
    if (result) {
      this.buildExtensionMap();
    }
    return result;
  }

  getServerInstance(serverId: string): LspServerInstance | null {
    return this.servers.get(serverId) ?? null;
  }

  getRunningServers(): LspServerInstance[] {
    return Array.from(this.servers.values()).filter(s => s.status === 'running');
  }

  getAllServerConfigs(): LspServerConfig[] {
    return this.getAllConfigs();
  }

  getAvailableServers(): string[] {
    return Array.from(this.availableServers);
  }

  getStatus(): {
    totalConfigs: number;
    availableCount: number;
    runningCount: number;
    servers: Array<{ id: string; name: string; status: LspServerStatus; projectRoot?: string }>;
  } {
    const servers = Array.from(this.servers.entries()).map(([id, instance]) => ({
      id,
      name: instance.config.name,
      status: instance.status,
      projectRoot: instance.projectRoot,
    }));

    return {
      totalConfigs: this.getAllConfigs().length,
      availableCount: this.availableServers.size,
      runningCount: this.getRunningServers().length,
      servers,
    };
  }

  writeToServer(serverId: string, message: string): boolean {
    const instance = this.servers.get(serverId);
    if (!instance?.process?.stdin?.writable) {
      return false;
    }

    instance.process.stdin.write(message);
    return true;
  }

  onServerOutput(serverId: string, callback: (data: Buffer) => void): void {
    const instance = this.servers.get(serverId);
    if (instance?.process?.stdout) {
      instance.process.stdout.on('data', callback);
    }
  }
}
