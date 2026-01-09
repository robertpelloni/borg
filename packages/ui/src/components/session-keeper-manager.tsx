'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useJules } from '@/lib/jules/provider';
import { useSessionKeeperStore } from '@/lib/stores/session-keeper';
import { Activity } from '@/types/jules';

export function SessionKeeperManager() {
  const { client } = useJules();
  const router = useRouter();
  const { config, addLog, setStatusSummary, incrementStat, lastNudgeBySession, recordNudge } = useSessionKeeperStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use refs to access latest state in the interval callback without resetting the interval
  const latestStateRef = useRef({ lastNudgeBySession, config });

  useEffect(() => {
    latestStateRef.current = { lastNudgeBySession, config };
  }, [lastNudgeBySession, config]);

  useEffect(() => {
    if (!config.isEnabled || !client) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkSessions = async () => {
      // Access latest config from ref
      const currentConfig = latestStateRef.current.config;
      
      try {
        const sessions = await client.listSessions();

        setStatusSummary({
          monitoringCount: sessions.length,
          lastAction: 'Checked ' + new Date().toLocaleTimeString(),
          nextCheckIn: currentConfig.checkIntervalSeconds
        });

        for (const session of sessions) {
          // Optimization: Fetch ONLY the latest activity to check timestamp
          let activities: Activity[] = [];
          try {
             // Fetch 1 activity
             const result = await client.listActivitiesPaged(session.id, 1);
             activities = result.activities;
          } catch (e) {
             console.error(`Failed to list activities for ${session.id}`, e);
             continue;
          }

          if (activities.length === 0) {
             continue;
          }

          const lastActivityTimeStr = session.lastActivityAt || session.updatedAt;
          const lastActivityTime = new Date(lastActivityTimeStr).getTime();
          const now = Date.now();
          const inactiveMinutes = (now - lastActivityTime) / (1000 * 60);

          // Determine threshold
          let threshold = currentConfig.inactivityThresholdMinutes;
          const isAgentWorking = ['IN_PROGRESS', 'PLANNING'].includes(session.rawState || '');
          if (isAgentWorking) {
             threshold = currentConfig.activeWorkThresholdMinutes;
          }

          const switchToSession = () => {
             if (currentConfig.autoSwitch) {
                 const currentParams = new URLSearchParams(window.location.search);
                 if (currentParams.get('sessionId') !== session.id) {
                     router.push(`/?sessionId=${session.id}`);
                 }
             }
          };

          // 1. Check for Plan Approval (Needs fetching activities)
          if (session.status === 'awaiting_approval' || session.rawState === 'AWAITING_PLAN_APPROVAL') {
             addLog(`Approving plan for session ${session.id} (State: Awaiting Approval)`, 'action');
             switchToSession();
             await client.approvePlan(session.id);
             incrementStat('totalApprovals');
             continue;
          }
          
          // Use latestNudgeBySession from ref
          const currentLastNudgeBySession = latestStateRef.current.lastNudgeBySession;
          
          if (inactiveMinutes > threshold) {
             // Check if we nudged recently
             const lastNudge = currentLastNudgeBySession[session.id] || 0;
             const timeSinceNudge = (now - lastNudge) / (1000 * 60);
             if (timeSinceNudge < (threshold / 2)) {
                 continue; // Don't spam nudges
             }
             
             let message = '';

             // Now we need context. FETCH FULL HISTORY (or enough context).
             const fullActivities = await client.listActivities(session.id);
             fullActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
             const latestActivity = fullActivities[0];

             // Double check plan approval on latest activity
             if (latestActivity.type === 'plan' && !latestActivity.metadata?.planApproved) {
                 addLog(`Approving plan for session ${session.id} (Found unapproved plan)`, 'action');
                 switchToSession();
                 await client.approvePlan(session.id);
                 incrementStat('totalApprovals');
                 continue;
             }

             switchToSession();

             // 1. DEBATE MODE
             if (currentConfig.debateEnabled && currentConfig.debateParticipants && currentConfig.debateParticipants.length > 0) {
                addLog(`Convening Council for ${session.id}...`, 'info');
                try {
                    const contextActivities = [...fullActivities].reverse().slice(-currentConfig.contextMessageCount);
                    const history = contextActivities.map(a => ({
                        role: a.role === 'agent' ? 'assistant' : 'user',
                        content: a.content
                    }));

                    const response = await fetch('/api/supervisor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'debate',
                            messages: history,
                            participants: currentConfig.debateParticipants
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();

                        // Construct Rich Markdown Transcript
                        let transcript = `### 🏛️ Council Debate\n\n`;
                        if (data.opinions && Array.isArray(data.opinions)) {
                            data.opinions.forEach((op: any) => {
                                const role = op.participant?.role || op.participant?.model || 'Member';
                                const provider = op.participant?.provider ? `(${op.participant.provider})` : '';
                                transcript += `**${role}** ${provider}:\n> ${op.content.replace(/\n/g, '\n> ')}\n\n`;
                            });
                        }
                        transcript += `\n---\n**Verdict:**\n${data.content}`;

                        message = transcript;
                        addLog(`Council Verdict: "${data.content.substring(0, 30)}..."`, 'action');
                        incrementStat('totalDebates');
                    } else {
                        addLog('Council debate failed, falling back.', 'error');
                    }
                } catch (e) {
                    addLog(`Council error: ${e}`, 'error');
                }
             }

             // 2. SMART PILOT (Single Supervisor)
             if (!message && currentConfig.smartPilotEnabled && currentConfig.supervisorApiKey) {
                addLog(`Consulting Supervisor for ${session.id}...`, 'info');
                try {
                  const contextActivities = [...fullActivities].reverse().slice(-currentConfig.contextMessageCount);
                  const messages = contextActivities.map(a => ({
                      role: a.role === 'agent' ? 'assistant' : 'user',
                      content: a.content
                  }));

                  const response = await fetch('/api/supervisor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages,
                        provider: currentConfig.supervisorProvider,
                        apiKey: currentConfig.supervisorApiKey,
                        model: currentConfig.supervisorModel
                    })
                  });

                  if (response.ok) {
                    const data = await response.json();
                    if (data.content) {
                        message = data.content;
                    }
                  } else {
                     addLog(`Supervisor API failed: ${response.status}`, 'error');
                  }
                } catch (e) {
                  addLog(`Supervisor failed: ${e}`, 'error');
                }
             }

             // 3. FALLBACK MESSAGES
             if (!message) {
                 if (currentConfig.customMessages[session.id] && currentConfig.customMessages[session.id].length > 0) {
                    const customList = currentConfig.customMessages[session.id];
                    message = customList[Math.floor(Math.random() * customList.length)];
                 } else {
                    message = currentConfig.messages[Math.floor(Math.random() * currentConfig.messages.length)];
                 }

                 if (session.status === 'completed' || session.status === 'failed') {
                    message = "Please resume working on this task.";
                 }
             }

             addLog(`Sending nudge to ${session.id} (${inactiveMinutes.toFixed(1)}m > ${threshold}m): "${message.substring(0, 50)}..."`, 'action');
             
             recordNudge(session.id);
             
             await client.createActivity({
               sessionId: session.id,
               content: message,
               type: 'message'
             });
             incrementStat('totalNudges');
          }
        }
      } catch (error) {
         addLog(`Error checking sessions: ${error}`, 'error');
      }
    };

    // Initial check
    const timeoutId = setTimeout(checkSessions, 1000);
    intervalRef.current = setInterval(checkSessions, config.checkIntervalSeconds * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Removed lastNudgeBySession and config from dependencies to prevent reset loops. 
    // Only re-run if client or critical dependencies change.
    // We strictly depend on `config.isEnabled` and `config.checkIntervalSeconds` triggering a reset, 
    // but deeper config changes are handled via ref.
  }, [config.isEnabled, config.checkIntervalSeconds, client, addLog, setStatusSummary, router, incrementStat, recordNudge]);

  return null;
}
