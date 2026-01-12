import * as fs from 'fs';
import * as path from 'path';
import { Skill, SkillDefinition } from '../types.js';
import { CodeExecutionManager } from '../../managers/CodeExecutionManager.js';

export { VibeshipSkillDriver } from './VibeshipSkillDriver.js';

export abstract class SkillDriver {
  abstract canHandle(skill: SkillDefinition): boolean;
  abstract load(skill: SkillDefinition): Promise<Skill>;
  // Add execution support
  abstract execute?(skill: Skill, params: any, context?: any): Promise<any>;
}

export class PromptDriver extends SkillDriver {
  canHandle(skill: SkillDefinition): boolean {
    if (skill.provider === 'anthropic') return true;
    // Heuristic: If it has templates, it's a prompt skill
    // This is weak, but we can refine it.
    if (skill.metadata && (skill.metadata.type === 'prompt' || skill.metadata.templates)) return true;
    return false;
  }

  async load(skill: SkillDefinition): Promise<Skill> {
    const rootDir = process.cwd();
    const skillPath = path.join(rootDir, skill.path, 'SKILL.md');
    
    let content = '';
    if (fs.existsSync(skillPath)) {
        content = fs.readFileSync(skillPath, 'utf-8');
    }

    // Load templates if they exist
    // Anthropic skills often have a 'templates' folder
    const templatesDir = path.join(rootDir, skill.path, 'templates');
    let templates: Record<string, string> = {};
    if (fs.existsSync(templatesDir)) {
        const files = fs.readdirSync(templatesDir);
        for (const file of files) {
            templates[file] = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
        }
    }

    return {
      definition: skill,
      type: 'prompt',
      content: content,
      // We might want to attach templates to the skill object
      // For now, let's append them to content or keep them separate?
      // Let's rely on the definition having the path, but passing them is better.
      // We'll augment the Skill type later if needed.
    };
  }

  // Prompt skills are "executed" by returning their content to be injected into the context
  async execute(skill: Skill, params: any, context?: any): Promise<any> {
    return {
        role: 'system', // or user
        content: skill.content
    };
  }
}

export class ScriptDriver extends SkillDriver {
  private codeExecutor: CodeExecutionManager;

  constructor() {
      super();
      this.codeExecutor = new CodeExecutionManager();
  }

  canHandle(skill: SkillDefinition): boolean {
    const rootDir = process.cwd();
    const scriptsDir = path.join(rootDir, skill.path, 'scripts');
    return fs.existsSync(scriptsDir);
  }

  async load(skill: SkillDefinition): Promise<Skill> {
    const rootDir = process.cwd();
    const scriptsDir = path.join(rootDir, skill.path, 'scripts');
    
    // Find the primary script. 
    // We prioritize python for OpenAI skills, but we need to support others.
    // Actually, CodeExecutionManager (SandboxManager) currently uses `isolated-vm` which is JS ONLY.
    // OpenAI skills are Python.
    // We have a mismatch here.
    
    // IF the skill is Python, we cannot run it in isolated-vm.
    // We need a Python runner (Docker or local python exec).
    
    // For this prototype, we will identify the path, but we might fail to execute 
    // if we don't have a python runner.
    
    let executablePath = '';
    if (fs.existsSync(scriptsDir)) {
        const files = fs.readdirSync(scriptsDir);
        // Prioritize .js/ts for now if we only have JS sandbox?
        // But OpenAI skills are Python.
        const pyFile = files.find(f => f.endsWith('.py'));
        if (pyFile) {
            executablePath = path.join(scriptsDir, pyFile);
        }
    }

    return {
      definition: skill,
      type: 'script',
      executablePath: executablePath
    };
  }

  async execute(skill: Skill, params: any, context?: any): Promise<any> {
      if (!skill.executablePath) {
          throw new Error('No executable path found for script skill');
      }

      const ext = path.extname(skill.executablePath);
      
      if (ext === '.py') {
          // We need to execute Python.
          // Since SandboxManager is JS-only, we must use a local shell execution for now (with warnings)
          // or fail.
          // We use the PythonExecutor added to CodeExecutionManager.
          
          // Note: params object needs to be converted to args string[] for the script
          // This mapping depends on the skill definition schema which we don't fully have yet.
          // For now, we pass no args or just raw values if we can guess.
          // OpenAI skills usually take command line args like --repo "." --pr "123".
          
          const scriptArgs: string[] = [];
          if (params) {
              for (const [key, value] of Object.entries(params)) {
                  scriptArgs.push(`--${key}`);
                  scriptArgs.push(String(value));
              }
          }
          
          return await this.codeExecutor.executePythonScript(skill.executablePath, scriptArgs);
      } else if (ext === '.js' || ext === '.ts') {
          // Read the code
          const code = fs.readFileSync(skill.executablePath, 'utf-8');
          // Execute in sandbox
          return await this.codeExecutor.execute(code, async (name, args) => {
              console.log(`[ScriptDriver] Tool call: ${name}`, args);
              return "Tool result"; // Mock
          });
      }
      
      throw new Error(`Unsupported script type: ${ext}`);
  }
}
