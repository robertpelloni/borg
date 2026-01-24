console.log("DEBUG: Loading dependencies...");
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';

console.log("DEBUG: Loaded Ink/React/Commander. Now importing Core...");
try {
    const core = await import('@borg/core');
    console.log("DEBUG: Core loaded successfully.");
} catch (e) {
    console.error("DEBUG: Failed to import core", e);
}
