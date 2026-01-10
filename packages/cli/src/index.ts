import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { runAgentCommand } from './commands/run.js';
import { mineCommand } from './commands/mine.js';
import { tuiCommand } from './commands/tui.js';
import { agentsCommand } from './commands/agents.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('aios')
  .description('CLI for AIOS Monorepo')
  .version(pkg.version);

program.addCommand(startCommand);
program.addCommand(statusCommand);
program.addCommand(runAgentCommand);
program.addCommand(mineCommand);
program.addCommand(tuiCommand);
program.addCommand(agentsCommand);

program.parse(process.argv);
