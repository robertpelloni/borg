import { generateText } from './providers';

export async function decideNextAction(
  provider: string,
  apiKey: string,
  model: string,
  context: string
): Promise<string> {
  const systemPrompt = `You are a supervisor for an AI agent.
  The agent has been inactive.
  Your goal is to provide a helpful, encouraging nudge or a specific instruction based on the recent context to get the agent moving again.
  Keep the message short, direct, and professional.
  Do not mention that you are a supervisor. Just speak as if you are the user giving a command.`;

  try {
    const response = await generateText({
      provider,
      apiKey,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ]
    });

    return response || "Please continue.";
  } catch (error) {
    console.error("Supervisor error:", error);
    return "Please continue.";
  }
}
