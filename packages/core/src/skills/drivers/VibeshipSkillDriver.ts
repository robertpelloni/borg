import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { 
  Skill, 
  SkillDefinition, 
  VibeshipSkillData,
  VibeshipSkillYaml,
  VibeshipValidation,
  VibeshipSharpEdge,
  VibeshipCollaboration
} from '../types.js';
import { SkillDriver } from './index.js';

export class VibeshipSkillDriver extends SkillDriver {
  canHandle(skill: SkillDefinition): boolean {
    if (skill.provider === 'vibeship') return true;
    if (skill.source === 'vibeship') return true;
    
    const rootDir = process.cwd();
    const skillYamlPath = path.join(rootDir, skill.path, 'skill.yaml');
    return fs.existsSync(skillYamlPath);
  }

  async load(skill: SkillDefinition): Promise<Skill> {
    const rootDir = process.cwd();
    const skillDir = path.join(rootDir, skill.path);
    
    const skillData = await this.loadVibeshipData(skillDir);
    
    const formattedContent = this.formatAsPrompt(skillData);
    
    return {
      definition: { ...skill, content: formattedContent },
      type: 'vibeship',
      content: formattedContent,
      vibeship: skillData
    };
  }

  async execute(skill: Skill, params: Record<string, unknown>, context?: Record<string, unknown>): Promise<{ role: string; content: string }> {
    const content = this.formatForContext(skill, params, context);
    return { role: 'system', content };
  }

  private async loadVibeshipData(skillDir: string): Promise<VibeshipSkillData> {
    const skillYaml = await this.loadYamlFile<VibeshipSkillYaml>(path.join(skillDir, 'skill.yaml'));
    
    if (!skillYaml) {
      throw new Error(`skill.yaml not found in ${skillDir}`);
    }

    const validationsRaw = await this.loadYamlFile<{ validations: VibeshipValidation[] }>(
      path.join(skillDir, 'validations.yaml')
    );
    
    const sharpEdgesRaw = await this.loadYamlFile<{ sharp_edges: VibeshipSharpEdge[] }>(
      path.join(skillDir, 'sharp-edges.yaml')
    );
    
    const collaboration = await this.loadYamlFile<VibeshipCollaboration>(
      path.join(skillDir, 'collaboration.yaml')
    );

    return {
      skill: skillYaml,
      validations: validationsRaw?.validations,
      sharpEdges: sharpEdgesRaw?.sharp_edges,
      collaboration: collaboration || undefined
    };
  }

  private async loadYamlFile<T>(filePath: string): Promise<T | null> {
    if (!fs.existsSync(filePath)) return null;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseYaml(content) as T;
  }

  private formatAsPrompt(data: VibeshipSkillData): string {
    const { skill, validations, sharpEdges } = data;
    const sections: string[] = [];
    
    sections.push(`# ${skill.name}\n${skill.description}`);
    
    if (skill.identity?.role) {
      sections.push(`## Role\n${skill.identity.role}`);
    }
    
    if (skill.patterns?.golden_rules?.length) {
      const rules = skill.patterns.golden_rules
        .map(r => `- **${r.rule}**: ${r.reason}`)
        .join('\n');
      sections.push(`## Golden Rules\n${rules}`);
    }
    
    if (skill.anti_patterns?.length) {
      const antiPatterns = skill.anti_patterns
        .map(ap => `- **${ap.pattern}**: ${ap.problem}\n  → Solution: ${ap.solution}`)
        .join('\n');
      sections.push(`## Anti-Patterns to Avoid\n${antiPatterns}`);
    }
    
    if (skill.implementation_checklist) {
      const checklist = Object.entries(skill.implementation_checklist)
        .map(([category, items]) => {
          const itemList = items.map(i => `  - [ ] ${i}`).join('\n');
          return `### ${category}\n${itemList}`;
        })
        .join('\n');
      sections.push(`## Implementation Checklist\n${checklist}`);
    }
    
    if (validations?.length) {
      const criticalValidations = validations
        .filter(v => v.severity === 'error' || v.severity === 'critical')
        .map(v => `- ${v.name}: ${v.message}`)
        .join('\n');
      if (criticalValidations) {
        sections.push(`## Critical Validations\n${criticalValidations}`);
      }
    }
    
    if (sharpEdges?.length) {
      const edges = sharpEdges
        .filter(e => e.severity === 'critical' || e.severity === 'high')
        .map(e => `- **${e.summary}**: ${e.situation}\n  → ${e.solution}`)
        .join('\n');
      if (edges) {
        sections.push(`## Sharp Edges (Gotchas)\n${edges}`);
      }
    }
    
    if (skill.ecosystem?.frameworks?.length || skill.ecosystem?.libraries?.length) {
      const frameworks = skill.ecosystem?.frameworks?.join(', ') || '';
      const libraries = skill.ecosystem?.libraries?.join(', ') || '';
      sections.push(`## Ecosystem\nFrameworks: ${frameworks}\nLibraries: ${libraries}`);
    }
    
    return sections.join('\n\n');
  }

  private formatForContext(
    skill: Skill, 
    params: Record<string, unknown>, 
    context?: Record<string, unknown>
  ): string {
    let content = skill.content || '';
    
    if (params.focus && skill.vibeship) {
      const focusArea = String(params.focus);
      content = this.extractFocusedContent(skill.vibeship, focusArea);
    }
    
    if (context?.task) {
      content = `Task: ${context.task}\n\n${content}`;
    }
    
    return content;
  }

  private extractFocusedContent(data: VibeshipSkillData, focus: string): string {
    const sections: string[] = [];
    const { skill, validations, sharpEdges } = data;
    
    sections.push(`# ${skill.name} - Focus: ${focus}\n${skill.description}`);
    
    switch (focus) {
      case 'validation':
        if (validations?.length) {
          const valContent = validations
            .map(v => `- [${v.severity}] ${v.name}: ${v.message}\n  Fix: ${v.fix_action}`)
            .join('\n');
          sections.push(`## All Validations\n${valContent}`);
        }
        break;
        
      case 'pitfalls':
        if (sharpEdges?.length) {
          const edgeContent = sharpEdges
            .map(e => `### ${e.summary}\n**Situation:** ${e.situation}\n**Why:** ${e.why}\n**Solution:** ${e.solution}`)
            .join('\n\n');
          sections.push(`## Sharp Edges\n${edgeContent}`);
        }
        if (skill.anti_patterns?.length) {
          const antiContent = skill.anti_patterns
            .map(ap => `- **${ap.pattern}**: ${ap.problem}\n  → ${ap.solution}`)
            .join('\n');
          sections.push(`## Anti-Patterns\n${antiContent}`);
        }
        break;
        
      case 'implementation':
        if (skill.implementation_checklist) {
          const checklist = Object.entries(skill.implementation_checklist)
            .map(([category, items]) => {
              const itemList = items.map(i => `  - [ ] ${i}`).join('\n');
              return `### ${category}\n${itemList}`;
            })
            .join('\n');
          sections.push(`## Implementation Checklist\n${checklist}`);
        }
        break;
        
      default:
        return skill.description;
    }
    
    return sections.join('\n\n');
  }
}
