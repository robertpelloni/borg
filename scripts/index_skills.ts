import * as fs from 'fs';
import * as path from 'path';
// import * as yaml from 'js-yaml'; // Removed to avoid dependency issues

// Define interfaces for our Internal Skill Registry
interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic' | 'openai';
  category: string;
  path: string; // Relative to project root
  metadata?: Record<string, any>;
}

const ROOT_DIR = process.cwd();
const REGISTRY_PATH = path.join(ROOT_DIR, 'packages/core/data/skills_registry.json');
const ANTHROPIC_ROOT = path.join(ROOT_DIR, 'references/skills_repos/anthropic-skills/skills');
const OPENAI_ROOT = path.join(ROOT_DIR, 'references/skills_repos/openai-skills/skills');

// Simple Frontmatter Parser (regex based to avoid deps for now)
function parseFrontmatter(content: string): Record<string, any> {
  // Normalize line endings to \n
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const frontmatter: Record<string, any> = {};
  const lines = match[1].split('\n');
  
  let currentKey = '';
  
  for (const line of lines) {
    // Handle simple key: value
    const keyValMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyValMatch) {
        currentKey = keyValMatch[1].trim();
        frontmatter[currentKey] = keyValMatch[2].trim();
    } else if (currentKey && line.trim().startsWith('-')) {
        // Handle list items (very basic)
        // This is a hacky way to handle multiline or list values if needed, 
        // but for now we just want simple strings like name and description.
    }
  }
  return frontmatter;
}

async function scanSkills() {
  const registry: SkillDefinition[] = [];

  // 1. Scan Anthropic Skills
  if (fs.existsSync(ANTHROPIC_ROOT)) {
    console.log('Scanning Anthropic skills...');
    const skills = fs.readdirSync(ANTHROPIC_ROOT);
    for (const skillDir of skills) {
        const fullPath = path.join(ANTHROPIC_ROOT, skillDir);
        if (!fs.statSync(fullPath).isDirectory()) continue;

        const skillMdPath = path.join(fullPath, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            const meta = parseFrontmatter(content);
            
            registry.push({
                id: `anthropic_${skillDir}`,
                name: meta.name || skillDir,
                description: meta.description || 'No description provided',
                provider: 'anthropic',
                category: 'community', // Anthropic repo is flat
                path: path.relative(ROOT_DIR, fullPath),
                metadata: meta
            });
        }
    }
  }

  // 2. Scan OpenAI Skills
  if (fs.existsSync(OPENAI_ROOT)) {
    console.log('Scanning OpenAI skills...');
    const categories = ['.curated', '.experimental', '.system'];
    
    for (const cat of categories) {
        const catPath = path.join(OPENAI_ROOT, cat);
        if (!fs.existsSync(catPath)) continue;
        
        const skills = fs.readdirSync(catPath);
        for (const skillDir of skills) {
             const fullPath = path.join(catPath, skillDir);
             if (!fs.statSync(fullPath).isDirectory()) continue;
             
             const skillMdPath = path.join(fullPath, 'SKILL.md');
             if (fs.existsSync(skillMdPath)) {
                const content = fs.readFileSync(skillMdPath, 'utf-8');
                const meta = parseFrontmatter(content);
                
                registry.push({
                    id: `openai_${skillDir}`,
                    name: meta.name || skillDir,
                    description: meta.description || 'No description provided',
                    provider: 'openai',
                    category: cat.replace('.', ''),
                    path: path.relative(ROOT_DIR, fullPath),
                    metadata: meta
                });
             }
        }
    }
  }

  // Ensure output directory exists
  const outDir = path.dirname(REGISTRY_PATH);
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }

  // Write Registry
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  console.log(`Successfully indexed ${registry.length} skills to ${REGISTRY_PATH}`);
}

scanSkills().catch(console.error);
