#!/usr/bin/env node
import { Command } from "commander";
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';

const program = new Command();

program
  .name("aios")
  .description("The Ultimate AI Operating System CLI")
  .version("0.1.0");

program
  .command("start")
  .description("Start the AIOS Orchestrator")
  .action(() => {
    // Logic to spawn the core server or just connect
    console.log("Starting Orchestrator...");
    // For now, assume core is running or start it via child_process
  });

program
  .command("status")
  .description("Check AIOS Status")
  .action(async () => {
    render(React.createElement(App, { view: 'status' }));
  });

program.parse(process.argv);
