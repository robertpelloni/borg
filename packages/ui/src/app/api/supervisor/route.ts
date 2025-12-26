import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/orchestration/providers';
import { runDebate, runConference } from '@/lib/orchestration/debate';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, provider, apiKey, model, threadId, assistantId, action, participants } = body;

    console.log('[Supervisor API] Request:', { action, provider, model, participantsCount: participants?.length });

    // 1. List Models
    if (action === 'list_models') {
       if (!apiKey || !provider) {
         return NextResponse.json({ error: 'Missing apiKey or provider' }, { status: 400 });
       }
       const p = getProvider(provider);
       if (!p) {
           // Fallback for OpenAI Assistants or others not in provider list yet
           if (provider.startsWith('openai')) {
               const pOpenAI = getProvider('openai');
               if (pOpenAI) {
                   try {
                       const models = await pOpenAI.listModels(apiKey);
                       return NextResponse.json({ models });
                   } catch (e) { /* ignore */ }
               }
           }
           return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
       }
       try {
         const models = await p.listModels(apiKey);
         return NextResponse.json({ models });
       } catch (e) {
         return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to list models' }, { status: 500 });
       }
    }

    // 2. Debate
    if (action === 'debate') {
        if (!participants || !Array.isArray(participants)) {
            return NextResponse.json({ error: 'Invalid participants' }, { status: 400 });
        }
        try {
            const result = await runDebate({ history: messages, participants });
            return NextResponse.json(result);
        } catch (e) {
            console.error("Debate Error", e);
            return NextResponse.json({ error: e instanceof Error ? e.message : 'Debate failed' }, { status: 500 });
        }
    }

    // 3. Conference
    if (action === 'conference') {
        if (!participants || !Array.isArray(participants)) {
            return NextResponse.json({ error: 'Invalid participants' }, { status: 400 });
        }
        try {
            const result = await runConference({ history: messages, participants });
            return NextResponse.json(result);
        } catch (e) {
            console.error("Conference Error", e);
            return NextResponse.json({ error: e instanceof Error ? e.message : 'Conference failed' }, { status: 500 });
        }
    }

    if (!messages || !provider || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: messages, provider, or apiKey' },
        { status: 400 }
      );
    }

    // 1. OpenAI Assistants API Logic (Stateful)
    if (provider === 'openai-assistants' && messages.length > 0) {
      // We expect the *latest* user message to be the last one in the array
      const lastMessage = messages[messages.length - 1];
      const userContent = lastMessage.role === 'user' ? lastMessage.content : null;

      if (!userContent && !threadId) {
         return NextResponse.json({ content: '' });
      }

      // Create/Retrieve Assistant
      let activeAssistantId = assistantId;
      if (!activeAssistantId) {
        const assistantResp = await fetch('https://api.openai.com/v1/assistants', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            name: "Jules Supervisor",
            instructions: "You are a project supervisor. Your goal is to keep the AI agent 'Jules' on track. Identify if the agent is stuck, off-track, or needs guidance. Provide a concise, direct instruction or feedback to the agent. Do not be conversational. Be directive but polite. Focus on the next task.",
            model: model || "gpt-4o",
          })
        });
        if (!assistantResp.ok) throw new Error("Failed to create assistant");
        const assistantData = await assistantResp.json();
        activeAssistantId = assistantData.id;
      }

      // Create/Retrieve Thread
      let activeThreadId = threadId;
      if (!activeThreadId) {
        const threadResp = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({})
        });
        if (!threadResp.ok) throw new Error("Failed to create thread");
        const threadData = await threadResp.json();
        activeThreadId = threadData.id;
      }

      // Add Message
      if (userContent) {
        await fetch(`https://api.openai.com/v1/threads/${activeThreadId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            role: "user",
            content: userContent
          })
        });
      }

      // Run Assistant
      const runResp = await fetch(`https://api.openai.com/v1/threads/${activeThreadId}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: activeAssistantId,
        })
      });
      if (!runResp.ok) throw new Error("Failed to run assistant");
      const runData = await runResp.json();
      const runId = runData.id;

      // Poll
      let runStatus = runData.status;
      let currentRunData = runData;
      let attempts = 0;
      while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResp = await fetch(`https://api.openai.com/v1/threads/${activeThreadId}/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        const statusData = await statusResp.json();
        runStatus = statusData.status;
        currentRunData = statusData;
        attempts++;
      }

      if (runStatus !== 'completed') {
        console.error('[Supervisor API] Assistant Run Failed:', JSON.stringify(currentRunData, null, 2));
        const lastError = currentRunData.last_error;
        const errorMsg = lastError ? `${lastError.code}: ${lastError.message}` : 'No error details provided';
        throw new Error(`Assistant run failed (${runStatus}): ${errorMsg}`);
      }

      // Get Response
      const msgResp = await fetch(`https://api.openai.com/v1/threads/${activeThreadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      const msgData = await msgResp.json();
      const lastMsg = msgData.data.filter((m: { role: string }) => m.role === 'assistant')[0];
      const content = lastMsg?.content?.[0]?.text?.value || '';

      return NextResponse.json({ 
        content, 
        threadId: activeThreadId, 
        assistantId: activeAssistantId 
      });
    }

    // 2. Stateless Logic (Using Library)
    const p = getProvider(provider);
    if (p) {
        const result = await p.complete({
            messages,
            apiKey,
            model,
            systemPrompt: 'You are a project supervisor. Your goal is to keep the AI agent "Jules" on track. Read the conversation history. Identify if the agent is stuck, off-track, or needs guidance. Provide a concise, direct instruction or feedback to the agent. Do not be conversational. Be directive but polite. Focus on the next task.'
        });
        return NextResponse.json({ content: result.content });
    }

    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });

  } catch (error) {
    console.error('Supervisor API Error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    const isRateLimit = msg.includes('rate_limit') || msg.includes('quota') || msg.includes('429');
    
    return NextResponse.json(
      { error: msg },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
