import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { SkillDefinition } from '../types.js';
import { MarkdownSkillAdapter } from '../skills/adapters/MarkdownAdapter.js';

export class SkillManager extends EventEmitter {
  private skills: Map<string, SkillDefinition> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  private adapters = [new MarkdownSkillAdapter()];
  
  constructor(private skillsDir: string) {
    super();
  }

  async start() {
    // Also watch imported skills
    const importedSkillsDir = path.resolve(process.cwd(), 'skills/imported');
    const watchPaths = [this.skillsDir, importedSkillsDir];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../, 
      persistent: true
    });

    this.watcher.on('add', this.loadSkill.bind(this));
    this.watcher.on('change', this.loadSkill.bind(this));
    this.watcher.on('unlink', this.removeSkill.bind(this));
    
    console.log(`[SkillManager] Watching ${watchPaths.join(', ')}`);
  }

  private async loadSkill(filepath: string) {
    try {
      const filename = path.basename(filepath);
      
      if (filename === 'SKILL.md' || filename.endsWith('.skill.md')) {
         const content = await fs.readFile(filepath, 'utf-8');
         let skillName = filename.replace('.skill.md', '').replace('.md', '');
         
         if (filename === 'SKILL.md') {
             skillName = path.basename(path.dirname(filepath));
         }

         let processedSkill: SkillDefinition = { name: skillName, content };

         // Try to adapt the skill content
         for (const adapter of this.adapters) {
             if (adapter.isCompatible(content)) {
                 try {
                     const converted = await adapter.convert(content);
                     processedSkill = { ...processedSkill, ...converted };
                 } catch (e) {
                     console.warn(`[SkillManager] Adapter ${adapter.name} failed for ${skillName}:`, e);
                 }
                 break;
             }
         }

         this.skills.set(skillName, processedSkill); 
         console.log(`[SkillManager] Loaded skill: ${skillName}`);
         this.emit('updated', this.getSkills());
      }
    } catch (err) {
      console.error(`[SkillManager] Error loading skill ${filepath}:`, err);
    }
  }

  private removeSkill(filepath: string) {
      let skillName = path.basename(filepath).replace('.skill.md', '').replace('.md', '');
      if (path.basename(filepath) === 'SKILL.md') {
          skillName = path.basename(path.dirname(filepath));
      }
      this.skills.delete(skillName);
      this.emit('updated', this.getSkills());
  }

  getSkills() {
    return Array.from(this.skills.values());
  }
}
