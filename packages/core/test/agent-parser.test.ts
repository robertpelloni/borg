
import fs from 'fs';
import path from 'path';

// Mock implementation of parsing logic
function parseOpenCodeAgent(content: string) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return null;
    
    const frontmatterRaw = match[1];
    let metadata: any = {};
    
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
