import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aiosRoot = path.resolve(__dirname, '../../../../');
const superaiCliRoot = path.join(aiosRoot, 'superai-cli');

interface AgentConfig {
  name: string;
  description: string;
  path: string;
  type: 'node' | 'python' | 'go' | 'binary';
  startCommand: string[];
  envVars?: Record<string, string>;
}

const AGENT_CONFIGS: AgentConfig[] = [
  {
    name: 'codenomad',
    description: 'CodeNomad - Multi-instance OpenCode workspace (Electron/Tauri)',
    path: path.join(superaiCliRoot, 'clis', 'CodeNomad'),
    type: 'node',
    startCommand: ['npm', 'run', 'dev:electron'],
  },
  {
    name: 'emdash',
    description: 'Emdash - Run multiple coding agents in parallel (Electron)',
    path: path.join(superaiCliRoot, 'clis', 'emdash'),
    type: 'node',
    startCommand: ['npm', 'run', 'd'],
  },
  {
    name: 'apify-mcp',
    description: 'Apify MCP CLI - Model Context Protocol for Apify actors',
    path: path.join(superaiCliRoot, 'clis', 'apify-mcp-cli'),
    type: 'node',
    startCommand: ['npx', '.'],
  },
  {
    name: 'claude-squad',
    description: 'Claude Squad - Multi-Claude orchestration with Git worktrees',
    path: path.join(superaiCliRoot, 'agents', 'claude-squad'),
    type: 'go',
    startCommand: ['go', 'run', '.'],
  },
  {
    name: 'openhands',
    description: 'OpenHands - AI-driven development with Docker sandbox',
    path: path.join(superaiCliRoot, 'agents', 'openhands'),
    type: 'python',
    startCommand: ['poetry', 'run', 'python', '-m', 'openhands.core.main'],
  },
  {
    name: 'openhands-cli',
    description: 'OpenHands CLI - Terminal interface for OpenHands',
    path: path.join(superaiCliRoot, 'agents', 'openhands'),
    type: 'python',
    startCommand: ['poetry', 'run', 'oh'],
  },
  {
    name: 'autogen',
    description: 'AutoGen Studio - Microsoft multi-agent framework',
    path: path.join(superaiCliRoot, 'agents', 'autogen', 'python', 'packages', 'autogen-studio'),
    type: 'python',
    startCommand: ['uv', 'run', 'autogenstudio', 'ui'],
  },
  {
    name: 'langgraph',
    description: 'LangGraph - LangChain agent orchestration examples',
    path: path.join(superaiCliRoot, 'agents', 'langgraph'),
    type: 'python',
    startCommand: ['poetry', 'run', 'langgraph', 'dev'],
  },
];

function launchAgent(config: AgentConfig, args: string[] = []): void {
  console.log(chalk.cyan(`\nLaunching ${config.name}...`));
  console.log(chalk.gray(`Path: ${config.path}`));
  console.log(chalk.gray(`Command: ${config.startCommand.join(' ')} ${args.join(' ')}`));

  if (!fs.existsSync(config.path)) {
    console.error(chalk.red(`Error: Agent path does not exist: ${config.path}`));
    console.log(chalk.yellow('Try running: git submodule update --init --recursive'));
    process.exit(1);
  }

  const [cmd, ...cmdArgs] = config.startCommand;
  const fullArgs = [...cmdArgs, ...args];

  const child = spawn(cmd, fullArgs, {
    cwd: config.path,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ...config.envVars,
    },
  });

  child.on('error', (err) => {
    console.error(chalk.red(`Failed to start ${config.name}:`), err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(chalk.red(`${config.name} exited with code ${code}`));
    }
    process.exit(code ?? 0);
  });
}

export const agentsCommand = new Command('agents')
  .description('Swiss Army Knife - Launch and manage AI agent CLIs')
  .action(() => {
    console.log(chalk.bold.cyan('\nAvailable Agents:\n'));
    console.log(chalk.gray('CLIs:'));
    AGENT_CONFIGS.filter(a => a.path.includes('clis')).forEach((config) => {
      console.log(`  ${chalk.green(config.name.padEnd(15))} ${config.description}`);
    });
    console.log(chalk.gray('\nAgents:'));
    AGENT_CONFIGS.filter(a => a.path.includes('agents')).forEach((config) => {
      console.log(`  ${chalk.green(config.name.padEnd(15))} ${config.description}`);
    });
    console.log(chalk.gray('\nUsage: aios agents <agent-name> [args...]'));
    console.log(chalk.gray('Example: aios agents codenomad'));
    console.log(chalk.gray('Example: aios agents openhands-cli --help'));
  });

AGENT_CONFIGS.forEach((config) => {
  agentsCommand
    .command(config.name)
    .description(config.description)
    .allowUnknownOption()
    .action((options, command) => {
      const args = command.args || [];
      launchAgent(config, args);
    });
});

agentsCommand
  .command('list')
  .description('List all available agents with their status')
  .action(() => {
    console.log(chalk.bold.cyan('\nAgent Status:\n'));
    AGENT_CONFIGS.forEach((config) => {
      const exists = fs.existsSync(config.path);
      const status = exists ? chalk.green('ready') : chalk.red('missing');
      const typeIcon = {
        node: '📦',
        python: '🐍',
        go: '🐹',
        binary: '⚙️',
      }[config.type];
      console.log(`  ${typeIcon} ${chalk.bold(config.name.padEnd(15))} [${status}] ${config.description}`);
    });
    console.log();
  });

agentsCommand
  .command('install <agent>')
  .description('Install dependencies for an agent')
  .action(async (agentName: string) => {
    const config = AGENT_CONFIGS.find((c) => c.name === agentName);
    if (!config) {
      console.error(chalk.red(`Unknown agent: ${agentName}`));
      console.log('Available agents:', AGENT_CONFIGS.map((c) => c.name).join(', '));
      process.exit(1);
    }

    if (!fs.existsSync(config.path)) {
      console.error(chalk.red(`Agent path does not exist: ${config.path}`));
      process.exit(1);
    }

    console.log(chalk.cyan(`Installing dependencies for ${config.name}...`));

    let installCmd: string[];
    switch (config.type) {
      case 'node':
        installCmd = ['npm', 'install'];
        break;
      case 'python':
        installCmd = ['poetry', 'install'];
        break;
      case 'go':
        installCmd = ['go', 'mod', 'download'];
        break;
      default:
        console.log(chalk.yellow('No install command for this agent type'));
        return;
    }

    const child = spawn(installCmd[0], installCmd.slice(1), {
      cwd: config.path,
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green(`\n${config.name} dependencies installed successfully!`));
      } else {
        console.error(chalk.red(`Installation failed with code ${code}`));
      }
      process.exit(code ?? 0);
    });
  });
