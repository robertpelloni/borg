import * as fs from 'fs';
import * as path from 'path';
import { Skill, SkillDefinition } from '../skills/types.js';
import { PromptDriver, ScriptDriver, SkillDriver } from '../skills/drivers/index.js';

export class SkillManager {
  private registryPath: string;
  private registry: SkillDefinition[] = [];
  private drivers: SkillDriver[] = [];

  constructor(registryPath?: string) {
    const rootDir = process.cwd();
    this.registryPath = registryPath || path.join(rootDir, 'packages/core/data/skills_registry.json');
    
    // Initialize Drivers
    this.drivers.push(new ScriptDriver()); // Check scripts first
    this.drivers.push(new PromptDriver()); // Fallback
  }

  public async initialize(): Promise<void> {
    if (fs.existsSync(this.registryPath)) {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      this.registry = JSON.parse(data);
      console.log(`[SkillManager] Loaded ${this.registry.length} skills from registry.`);
    } else {
      console.warn(`[SkillManager] Registry not found at ${this.registryPath}`);
    }
  }

  public listSkills(): SkillDefinition[] {
    return this.registry;
  }

  public getSkillDefinition(id: string): SkillDefinition | undefined {
    return this.registry.find(s => s.id === id);
  }

  public async loadSkill(id: string): Promise<Skill | null> {
    const def = this.getSkillDefinition(id);
    if (!def) {
        throw new Error(`Skill with ID ${id} not found.`);
    }

    const driver = this.getDriver(def);
    if (driver) {
        return await driver.load(def);
    }
    throw new Error(`No driver found for skill ${id}`);
  }

  public async executeSkill(id: string, params: any = {}, context: any = {}): Promise<any> {
      const def = this.getSkillDefinition(id);
      if (!def) throw new Error(`Skill ${id} not found`);

      const driver = this.getDriver(def);
      if (!driver) throw new Error(`No driver for skill ${id}`);

      // Load first (drivers might cache)
      const skill = await driver.load(def);
      
      if (driver.execute) {
          return await driver.execute(skill, params, context);
      } else {
          throw new Error(`Driver for ${id} does not support execution`);
      }
  }

  private getDriver(def: SkillDefinition): SkillDriver | undefined {
      return this.drivers.find(d => d.canHandle(def));
  }
}
