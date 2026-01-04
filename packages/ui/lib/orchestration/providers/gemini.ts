import { CompletionParams, CompletionResult, ProviderInterface } from '../types';

export const geminiProvider: ProviderInterface = {
  async complete(params: CompletionParams): Promise<CompletionResult> {
    const { messages, apiKey, model, systemPrompt } = params;
    let modelToUse = model || 'gemini-1.5-flash';
    // Strip 'models/' prefix if user accidentally included it
    if (modelToUse.startsWith('models/')) {
        modelToUse = modelToUse.replace('models/', '');
    }
    
    // Use v1beta for newer models, but ensure model name is correct
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    let response;
    let retries = 3;
    let backoff = 2000; // Start with 2 seconds

    while (retries >= 0) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: systemPrompt ? {
              parts: [{ text: systemPrompt }]
            } : undefined,
            contents: messages.map((m) => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }]
            })),
            generationConfig: { maxOutputTokens: 300 }
          }),
        });

        if (response.status === 429) {
          if (retries === 0) break; // Let it fall through to error handling
          console.warn(`Gemini API 429 (Rate Limit). Retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          retries--;
          backoff *= 2;
          continue;
        }

        break; // Not a 429, proceed
      } catch (err) {
        if (retries === 0) throw err;
        console.warn(`Gemini API Network Error. Retrying in ${backoff}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, backoff));
        retries--;
        backoff *= 2;
      }
    }

    if (!response || !response.ok) {
      const error = await response?.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${error?.error?.message || response?.statusText || 'Unknown error'}`);
    }

    const data = await response.json();
      return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
  },

  async listModels(apiKey: string): Promise<string[]> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!response.ok) {
        console.warn('Failed to fetch models from Google, falling back to defaults');
        return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
      }
      const data = await response.json();
      return data.models
        .filter((m: any) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
    } catch (error) {
      console.error('Error listing Gemini models:', error);
      return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
    }
  }
};
