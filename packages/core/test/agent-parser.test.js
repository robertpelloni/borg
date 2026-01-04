
import fs from 'fs';
import path from 'path';

// Mock implementation of parsing logic
function parseOpenCodeAgent(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return null;
    
    const frontmatterRaw = match[1];
    let metadata = {};
    
    // Simple YAML parser if js-yaml not available
    // But let's assume we can use basic string splitting for now or just standard yaml parsing
    // In this environment, I'll try to use a simple manual parser for the specific fields we care about
    // to avoid dependency issues if js-yaml isn't installed in the test runner context.
    
    const lines = frontmatterRaw.split('\n');
    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim().replace(/^"|"$/g, '');
            if (key && value) {
                metadata[key] = value;
            }
        }
    }
    
    return metadata;
}

const sampleContent = `---
# OpenCode Agent Configuration
id: openagent
name: OpenAgent
description: "Universal agent for answering queries"
category: core
version: 1.0.0
---

<context>
  Some context
</context>
`;

const result = parseOpenCodeAgent(sampleContent);
console.log(JSON.stringify(result, null, 2));
