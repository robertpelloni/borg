import { getProvider } from './providers';

interface Participant {
  provider: string;
  model: string;
  apiKey: string;
  role?: string; // e.g. "Security Expert", "Performance Expert"
}

interface DebateParams {
  history: { role: string; content: string }[];
  participants: Participant[];
  judge?: Participant; // If null, use the first participant as judge
}

export async function runDebate(params: DebateParams) {
  const { history, participants, judge } = params;

  // 1. Collect Opinions
  const opinions = [];
  for (const p of participants) {
    try {
        const provider = getProvider(p.provider);
        if (!provider) throw new Error(`Provider ${p.provider} not found`);

        const sysPrompt = `You are a ${p.role || 'project supervisor'} participating in a debate about the next steps for an AI agent.
Analyze the history and provide your recommendation. Be concise.`;

        const result = await provider.complete({
            messages: history,
            apiKey: p.apiKey,
            model: p.model,
            systemPrompt: sysPrompt
        });

        opinions.push({ participant: p, content: result.content });
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
        console.error(`Participant ${p.provider}/${p.model} failed:`, e);
        opinions.push({ participant: p, error: e instanceof Error ? e.message : 'Unknown error', content: '' });
    }
  }

  // 2. Synthesize (Judge)
  const validOpinions = opinions.filter(o => !o.error && o.content);

  if (validOpinions.length === 0) {
      const errors = opinions.map(o => `${o.participant.role || o.participant.model}: ${o.error}`).join('; ');
      throw new Error(`All debate participants failed. Details: ${errors}`);
  }

  // If we have at least one valid opinion, proceed even if others failed
  if (validOpinions.length < participants.length) {
      console.warn(`Some participants failed, proceeding with ${validOpinions.length}/${participants.length} opinions.`);
  }

  const opinionText = validOpinions.map(o => `### ${o.participant.role || o.participant.model} (${o.participant.provider}):\n${o.content}`).join('\n\n');

  const judgeParticipant = judge || participants[0];
  const judgeProvider = getProvider(judgeParticipant.provider);
  if (!judgeProvider) throw new Error("Judge provider not found");

  const synthesisPrompt = `You are the Chief Supervisor. You have heard opinions from your council regarding the AI agent's status.

COUNCIL OPINIONS:
${opinionText}

Based on these opinions and the history, provide the SINGLE final instruction for the agent.
Synthesize the best points. Be direct and directive. Do not mention "The Council" in your final instruction to the agent, just give the instruction.`;

  const finalResult = await judgeProvider.complete({
      messages: history, // Give judge full history too
      apiKey: judgeParticipant.apiKey,
      model: judgeParticipant.model,
      systemPrompt: synthesisPrompt
  });

  return {
      content: finalResult.content,
      opinions: validOpinions
  };
}

export async function runConference(params: DebateParams) {
  const { history, participants } = params;

  // 1. Collect Opinions
  const opinions = [];
  for (const p of participants) {
    try {
        const provider = getProvider(p.provider);
        if (!provider) throw new Error(`Provider ${p.provider} not found`);

        const sysPrompt = `You are a ${p.role || 'project supervisor'} participating in a round-table conference about the next steps for an AI agent.
Analyze the history and provide your recommendation. Be concise.`;

        const result = await provider.complete({
            messages: history,
            apiKey: p.apiKey,
            model: p.model,
            systemPrompt: sysPrompt
        });

        opinions.push({ participant: p, content: result.content });
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
        console.error(`Participant ${p.provider}/${p.model} failed:`, e);
        opinions.push({ participant: p, error: e instanceof Error ? e.message : 'Unknown error', content: '' });
    }
  }

  const validOpinions = opinions.filter(o => !o.error && o.content);

  if (validOpinions.length === 0) {
      const errors = opinions.map(o => `${o.participant.role || o.participant.model}: ${o.error}`).join('; ');
      throw new Error(`All conference participants failed. Details: ${errors}`);
  }

  // 2. Format as "Role (Model): Content"
  const content = validOpinions.map(o => {
      const name = o.participant.role ? `${o.participant.role} (${o.participant.model})` : o.participant.model;
      return `**${name}**: ${o.content}`;
  }).join('\n\n');

  return {
      content,
      opinions: validOpinions
  };
}
