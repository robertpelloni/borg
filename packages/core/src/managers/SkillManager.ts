import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { SkillDefinition } from '../types.js';

export class SkillManager extends EventEmitter {
  private skills: Map<string, SkillDefinition> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private skillsDir: string) {
    super();
  }

  async start() {
    this.watcher = chokidar.watch(this.skillsDir, {
      ignored: /(^|[\/\\])\../, 
      persistent: true
    });

    this.watcher.on('add', this.loadSkill.bind(this));
    this.watcher.on('change', this.loadSkill.bind(this));
    this.watcher.on('unlink', this.removeSkill.bind(this));
    
    console.log(`[SkillManager] Watching ${this.skillsDir}`);
  }

  private async loadSkill(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);
      
      if (filename === 'SKILL.md' || filename.endsWith('.skill.md')) {
         const skill: SkillDefinition = {
             name: filename.replace('.skill.md', '').replace('.md', ''),
             content: content
         };
         this.skills.set(filename, skill);
         console.log(`[SkillManager] Loaded skill: ${skill.name}`);
         this.emit('updated', this.getSkills());
      }
    } catch (err) {
      console.error(`[SkillManager] Error loading skill ${filepath}:`, err);
    }
  }

  private removeSkill(filepath: string) {
      const filename = path.basename(filepath);
      this.skills.delete(filename);
      this.emit('updated', this.getSkills());
  }

  getSkills() {
    return Array.from(this.skills.values());
  }
}
