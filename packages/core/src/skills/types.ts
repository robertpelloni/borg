
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic' | 'openai';
  category: string;
  path: string; // Relative to project root
  metadata?: Record<string, any>;
}

export type SkillType = 'prompt' | 'script' | 'knowledge';

export interface Skill {
  definition: SkillDefinition;
  type: SkillType;
  // For prompt/knowledge skills
  content?: string;
  // For script skills
  executablePath?: string;
}
