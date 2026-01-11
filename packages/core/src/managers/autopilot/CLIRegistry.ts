/**
 * CLIRegistry - Detects and manages available CLI tools for autopilot sessions
 * Ported from opencode-autopilot with AIOS integration
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
export type CLIType = 'opencode' | 'claude' | 'aider' | 'cursor' | 'continue' | 'cody' | 'copilot' | 'custom';

export interface CLITool {
  type: CLIType;
  name: string;
  command: string;
  args: string[];
  healthEndpoint?: string;
  detectCommand?: string;
  available?: boolean;
  version?: string;
  capabilities?: string[];
}

interface CLIDefinition {
  type: CLIType;
  name: string;
  command: string;
  serveArgs: string[];
  versionArgs: string[];
  healthEndpoint: string;
  detectCommands: string[];
  capabilities: string[];
}

const CLI_DEFINITIONS: CLIDefinition[] = [
  {
    type: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['opencode', 'npx opencode'],
    capabilities: ['serve', 'chat', 'edit', 'multi-file'],
  },
  {
    type: 'claude',
    name: 'Claude CLI',
    command: 'claude',
    serveArgs: ['--serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/api/health',
    detectCommands: ['claude'],
    capabilities: ['chat', 'code', 'analysis'],
  },
  {
    type: 'aider',
    name: 'Aider',
    command: 'aider',
    serveArgs: ['--serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['aider', 'python -m aider'],
    capabilities: ['chat', 'edit', 'git-aware', 'multi-file'],
  },
  {
    type: 'cursor',
    name: 'Cursor',
    command: 'cursor',
    serveArgs: ['--serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['cursor'],
    capabilities: ['ide', 'chat', 'edit'],
  },
  {
    type: 'continue',
    name: 'Continue',
    command: 'continue',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['continue'],
    capabilities: ['chat', 'autocomplete', 'edit'],
  },
  {
    type: 'cody',
    name: 'Sourcegraph Cody',
    command: 'cody',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['cody'],
    capabilities: ['chat', 'autocomplete', 'search'],
  },
  {
    type: 'copilot',
    name: 'GitHub Copilot CLI',
    command: 'github-copilot-cli',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['github-copilot-cli', 'gh copilot'],
    capabilities: ['explain', 'suggest', 'chat'],
  },
];

export interface CLIRegistryEvents {
  'tool:detected': (tool: CLITool) => void;
  'tool:registered': (tool: CLITool) => void;
  'tool:unregistered': (name: string) => void;
  'detection:started': () => void;
  'detection:completed': (tools: CLITool[]) => void;
}

export class CLIRegistry extends EventEmitter {
  private tools: Map<CLIType, CLITool> = new Map();
  private customTools: Map<string, CLITool> = new Map();
  private detectionPromise: Promise<void> | null = null;
  private lastDetectionTime: number = 0;

  constructor() {
    super();
  }

  /**
   * Detect all available CLI tools
   */
  async detectAll(): Promise<CLITool[]> {
    if (this.detectionPromise) {
      await this.detectionPromise;
      return this.getAllTools();
    }

    this.emit('detection:started');
    this.detectionPromise = this.runDetection();
    await this.detectionPromise;
    
    const tools = this.getAllTools();
    this.lastDetectionTime = Date.now();
    this.emit('detection:completed', tools);
    
    return tools;
  }

  private async runDetection(): Promise<void> {
    const detectionPromises = CLI_DEFINITIONS.map(async (def) => {
      const tool = await this.detectTool(def);
      if (tool) {
        this.tools.set(def.type, tool);
        if (tool.available) {
          this.emit('tool:detected', tool);
        }
      }
    });

    await Promise.all(detectionPromises);
  }

  private async detectTool(def: CLIDefinition): Promise<CLITool | null> {
    for (const cmd of def.detectCommands) {
      try {
        const result = await this.runCommand(cmd, def.versionArgs);
        if (result.success) {
          return {
            type: def.type,
            name: def.name,
            command: cmd.split(' ')[0],
            args: def.serveArgs,
            healthEndpoint: def.healthEndpoint,
            detectCommand: cmd,
            available: true,
            version: this.parseVersion(result.output),
            capabilities: def.capabilities,
          };
        }
      } catch {
        continue;
      }
    }

    // Return unavailable tool entry
    return {
      type: def.type,
      name: def.name,
      command: def.command,
      args: def.serveArgs,
      healthEndpoint: def.healthEndpoint,
      available: false,
      capabilities: def.capabilities,
    };
  }

  private runCommand(command: string, args: string[]): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const parts = command.split(' ');
      const cmd = parts[0];
      const cmdArgs = [...parts.slice(1), ...args];

      const proc: ChildProcess = spawn(cmd, cmdArgs, {
        shell: true,
        timeout: 5000,
        windowsHide: true,
      });

      let output = '';
      proc.stdout?.on('data', (data: Buffer) => { output += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { output += data.toString(); });

      proc.on('close', (code: number | null) => {
        resolve({ success: code === 0, output: output.trim() });
      });

      proc.on('error', () => {
        resolve({ success: false, output: '' });
      });

      // Timeout fallback
      setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: '' });
      }, 5000);
    });
  }

  private parseVersion(output: string): string {
    const match = output.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Get a specific CLI tool by type
   */
  getTool(type: CLIType): CLITool | undefined {
    return this.tools.get(type) || this.findCustomToolByType(type);
  }

  private findCustomToolByType(type: CLIType): CLITool | undefined {
    for (const tool of this.customTools.values()) {
      if (tool.type === type) return tool;
    }
    return undefined;
  }

  /**
   * Get all available (installed) CLI tools
   */
  getAvailableTools(): CLITool[] {
    return [...this.tools.values(), ...this.customTools.values()].filter(t => t.available);
  }

  /**
   * Get all detected CLI tools (available and unavailable)
   */
  getAllTools(): CLITool[] {
    return [...this.tools.values(), ...this.customTools.values()];
  }

  /**
   * Register a custom CLI tool
   */
  registerCustomTool(tool: CLITool): void {
    this.customTools.set(tool.name, tool);
    this.emit('tool:registered', tool);
  }

  /**
   * Unregister a custom CLI tool
   */
  unregisterCustomTool(name: string): boolean {
    const deleted = this.customTools.delete(name);
    if (deleted) {
      this.emit('tool:unregistered', name);
    }
    return deleted;
  }

  /**
   * Get the serve command for a CLI type
   */
  getServeCommand(type: CLIType, port: number): { command: string; args: string[] } | null {
    const tool = this.getTool(type);
    if (!tool || !tool.available) return null;

    const args = [...tool.args];
    const portArgIndex = args.findIndex(a => a.includes('port'));
    if (portArgIndex >= 0) {
      args.splice(portArgIndex + 1, 0, String(port));
    } else {
      args.push(String(port));
    }

    return { command: tool.command, args };
  }

  /**
   * Get the health endpoint for a CLI type
   */
  getHealthEndpoint(type: CLIType): string {
    const tool = this.getTool(type);
    return tool?.healthEndpoint || '/health';
  }

  /**
   * Check if a specific CLI type is available
   */
  isAvailable(type: CLIType): boolean {
    const tool = this.getTool(type);
    return tool?.available ?? false;
  }

  /**
   * Get the default CLI type (first available)
   */
  getDefaultCLI(): CLIType {
    const available = this.getAvailableTools();
    if (available.length > 0) {
      return available[0].type;
    }
    return 'opencode'; // Fallback default
  }

  /**
   * Refresh CLI detection (clear cache and re-detect)
   */
  async refreshDetection(): Promise<CLITool[]> {
    this.tools.clear();
    this.detectionPromise = null;
    return this.detectAll();
  }

  /**
   * Get time since last detection
   */
  getLastDetectionTime(): number {
    return this.lastDetectionTime;
  }

  /**
   * Get CLI definitions (for UI display)
   */
  getCLIDefinitions(): CLIDefinition[] {
    return [...CLI_DEFINITIONS];
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    total: number;
    available: number;
    unavailable: number;
    custom: number;
    lastDetection: number;
  } {
    const allTools = this.getAllTools();
    const available = allTools.filter(t => t.available);
    
    return {
      total: allTools.length,
      available: available.length,
      unavailable: allTools.length - available.length,
      custom: this.customTools.size,
      lastDetection: this.lastDetectionTime,
    };
  }
}

// Singleton instance
export const cliRegistry = new CLIRegistry();
