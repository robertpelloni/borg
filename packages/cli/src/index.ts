#!/usr/bin/env node
import { Command } from 'commander';
import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();
const API_URL = process.env.aios_HUB_URL || 'http://localhost:3000';

program
  .name('aios')
  .description('CLI for aios Hub')
  .version('0.1.0');

program.command('status')
  .description('Check the status of the Hub')
  .action(async () => {
    const spinner = ora('Checking Hub status...').start();
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        spinner.succeed(chalk.green('Hub is Online'));
      } else {
        spinner.fail(chalk.red('Hub responded with error'));
      }
    } catch (e) {
      spinner.fail(chalk.red('Hub is Offline (Is it running?)'));
    }
  });

program.command('tools')
  .description('List available tools')
  .action(async () => {
    try {
      const res = await fetch(`${API_URL}/api/state`);
      const data = await res.json() as any;
      console.log(chalk.bold('\nAvailable Tools (via Servers):'));
      data.mcpServers.forEach((s: any) => {
          console.log(chalk.blue(`- ${s.name} (${s.status})`));
      });
    } catch (e) {
      console.error(chalk.red('Failed to fetch state. Is the Hub running?'));
    }
  });

program.command('run <agent>')
  .description('Run an autonomous agent')
  .argument('<task>', 'The task description')
  .action(async (agent, task) => {
      console.log(chalk.yellow(`Starting agent ${agent} with task: "${task}"...`));
      try {
          const res = await fetch(`${API_URL}/api/agents/run`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentName: agent, task })
          });
          const data = await res.json() as any;
          if (data.error) {
              console.error(chalk.red(`Error: ${data.error}`));
          } else {
              console.log(chalk.green('\nResult:'));
              console.log(data.result);
          }
      } catch (e) {
          console.error(chalk.red('Failed to run agent.'));
      }
  });

program.parse();
