
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic' | 'openai';
  category: string;
  path: string; // Relative to project root
  metadata?: Record<string, any>;
  // Optional content field for backward compatibility with src/types.ts
  // Must be string (not optional) to satisfy src/types.ts interface, 
  // but in practice it might be empty string if not loaded.
  content: string;
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
