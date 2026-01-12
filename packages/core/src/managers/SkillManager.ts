import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { Skill, SkillDefinition } from '../skills/types.js';
import { PromptDriver, ScriptDriver, SkillDriver, VibeshipSkillDriver } from '../skills/drivers/index.js';

interface SkillSource {
  name: string;
  path: string;
  type: 'registry' | 'vibeship' | 'directory';
  enabled: boolean;
}

export class SkillManager {
  private registryPath: string;
  private registry: SkillDefinition[] = [];
  private drivers: SkillDriver[] = [];
  private sources: SkillSource[] = [];
  private skillCache: Map<string, Skill> = new Map();

  constructor(registryPath?: string) {
    const rootDir = process.cwd();
    this.registryPath = registryPath || path.join(rootDir, 'packages/core/data/skills_registry.json');
    
    this.drivers.push(new VibeshipSkillDriver());
    this.drivers.push(new ScriptDriver());
    this.drivers.push(new PromptDriver());
    
    this.sources = [
      {
        name: 'vibeship-spawner-skills',
        path: 'external/skills_repos/vibeship/vibeship-spawner-skills',
        type: 'vibeship',
        enabled: true
      },
      {
        name: 'local-skills',
        path: 'skills',
        type: 'directory',
        enabled: true
      },
      {
        name: 'registry',
        path: this.registryPath,
        type: 'registry',
        enabled: true
      }
    ];
  }

  public async initialize(): Promise<void> {
    this.registry = [];
    
    for (const source of this.sources) {
      if (!source.enabled) continue;
      
      switch (source.type) {
        case 'registry':
          await this.loadFromRegistry(source.path);
          break;
        case 'vibeship':
          await this.loadVibeshipSkills(source.path, source.name);
          break;
        case 'directory':
          await this.loadDirectorySkills(source.path);
          break;
      }
    }
  }

  private async loadFromRegistry(registryPath: string): Promise<void> {
    if (!fs.existsSync(registryPath)) {
      console.warn(`[SkillManager] Registry not found at ${registryPath}`);
      return;
    }
    
    const data = fs.readFileSync(registryPath, 'utf-8');
    const loaded = JSON.parse(data);
    const skills = loaded.map((s: Record<string, unknown>) => ({
      ...s,
      content: (s.content as string) || '',
      source: 'registry' as const
    }));
    this.registry.push(...skills);
  }

  private async loadVibeshipSkills(basePath: string, sourceName: string): Promise<void> {
    const rootDir = process.cwd();
    const skillsDir = path.join(rootDir, basePath);
    
    if (!fs.existsSync(skillsDir)) {
      console.warn(`[SkillManager] Vibeship skills not found at ${skillsDir}`);
      return;
    }
    
    const categories = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'cli' && d.name !== 'node_modules');
    
    for (const category of categories) {
      const categoryPath = path.join(skillsDir, category.name);
      const skillDirs = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter(d => d.isDirectory());
      
      for (const skillDir of skillDirs) {
        const skillYamlPath = path.join(categoryPath, skillDir.name, 'skill.yaml');
        
        if (!fs.existsSync(skillYamlPath)) continue;
        
        try {
          const yamlContent = fs.readFileSync(skillYamlPath, 'utf-8');
          const skillData = parseYaml(yamlContent) as { id?: string; name?: string; description?: string };
          
          const skillDef: SkillDefinition = {
            id: skillData.id || `${category.name}/${skillDir.name}`,
            name: skillData.name || skillDir.name,
            description: skillData.description || '',
            category: category.name,
            path: path.join(basePath, category.name, skillDir.name),
            provider: 'vibeship',
            source: 'vibeship',
            content: '',
            tags: [category.name, sourceName]
          };
          
          this.registry.push(skillDef);
        } catch (err) {
          console.warn(`[SkillManager] Failed to load skill ${skillDir.name}:`, err);
        }
      }
    }
  }

  private async loadDirectorySkills(basePath: string): Promise<void> {
    const rootDir = process.cwd();
    const skillsDir = path.join(rootDir, basePath);
    
    if (!fs.existsSync(skillsDir)) return;
    
    const files = fs.readdirSync(skillsDir, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isDirectory()) {
        const skillMdPath = path.join(skillsDir, file.name, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          const nameMatch = content.match(/^#\s+(.+)/m);
          
          this.registry.push({
            id: file.name,
            name: nameMatch?.[1] || file.name,
            description: content.substring(0, 200),
            category: 'local',
            path: path.join(basePath, file.name),
            provider: 'aios',
            source: 'local',
            content: content
          });
        }
      } else if (file.name.endsWith('.md')) {
        const content = fs.readFileSync(path.join(skillsDir, file.name), 'utf-8');
        const nameMatch = content.match(/^#\s+(.+)/m);
        const id = file.name.replace('.md', '');
        
        this.registry.push({
          id,
          name: nameMatch?.[1] || id,
          description: content.substring(0, 200),
          category: 'local',
          path: path.join(basePath, file.name),
          provider: 'aios',
          source: 'local',
          content: content
        });
      }
    }
  }

  public async loadSkills(): Promise<void> {
    await this.initialize();
  }

  public listSkills(): SkillDefinition[] {
    return this.registry;
  }
  
  public getSkills(): SkillDefinition[] {
    return this.registry;
  }

  public listSkillsByCategory(category: string): SkillDefinition[] {
    return this.registry.filter(s => s.category === category);
  }

  public listSkillsBySource(source: 'local' | 'vibeship' | 'registry'): SkillDefinition[] {
    return this.registry.filter(s => s.source === source);
  }

  public searchSkills(query: string): SkillDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.registry.filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.category.toLowerCase().includes(lowerQuery) ||
      s.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  public getCategories(): string[] {
    const categories = new Set(this.registry.map(s => s.category));
    return Array.from(categories).sort();
  }

  public getStats(): { total: number; bySource: Record<string, number>; byCategory: Record<string, number> } {
    const bySource: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    
    for (const skill of this.registry) {
      const source = skill.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
    }
    
    return { total: this.registry.length, bySource, byCategory };
  }
  
  public on(_event: string, _listener: (...args: unknown[]) => void): this {
    return this;
  }

  public async start(): Promise<void> {
    await this.initialize();
  }

  public getSkillDefinition(id: string): SkillDefinition | undefined {
    return this.registry.find(s => s.id === id);
  }

  public async loadSkill(id: string): Promise<Skill | null> {
    if (this.skillCache.has(id)) {
      return this.skillCache.get(id)!;
    }
    
    const def = this.getSkillDefinition(id);
    if (!def) {
      throw new Error(`Skill with ID ${id} not found.`);
    }

    const driver = this.getDriver(def);
    if (driver) {
      const skill = await driver.load(def);
      this.skillCache.set(id, skill);
      return skill;
    }
    throw new Error(`No driver found for skill ${id}`);
  }

  public async executeSkill(id: string, params: Record<string, unknown> = {}, context: Record<string, unknown> = {}): Promise<unknown> {
    const def = this.getSkillDefinition(id);
    if (!def) throw new Error(`Skill ${id} not found`);

    const driver = this.getDriver(def);
    if (!driver) throw new Error(`No driver for skill ${id}`);

    const skill = await driver.load(def);
    
    if (driver.execute) {
      return await driver.execute(skill, params, context);
    } else {
      throw new Error(`Driver for ${id} does not support execution`);
    }
  }

  public async getSkillContent(id: string, focus?: string): Promise<string> {
    const skill = await this.loadSkill(id);
    if (!skill) throw new Error(`Skill ${id} not found`);
    
    if (focus && skill.vibeship) {
      const def = this.getSkillDefinition(id);
      const driver = this.getDriver(def!);
      if (driver?.execute) {
        const result = await driver.execute(skill, { focus }, {});
        return result.content || skill.content || '';
      }
    }
    
    return skill.content || '';
  }

  public addSource(source: SkillSource): void {
    this.sources.push(source);
  }

  public removeSource(name: string): void {
    this.sources = this.sources.filter(s => s.name !== name);
  }

  public getSources(): SkillSource[] {
    return [...this.sources];
  }

  private getDriver(def: SkillDefinition): SkillDriver | undefined {
    return this.drivers.find(d => d.canHandle(def));
  }
}
