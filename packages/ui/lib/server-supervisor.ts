const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

// Global state to persist across hot reloads in dev
const globalForSupervisor = global as unknown as { supervisorState: SupervisorState };

export interface SupervisorConfig {
  checkIntervalSeconds: number;
  inactivityThresholdMinutes: number;
  activeWorkThresholdMinutes: number;
  messages: string[];
}

export interface SupervisorState {
  enabled: boolean;
  apiKey: string | null;
  config: SupervisorConfig;
  intervalId: NodeJS.Timeout | null;
  lastCheck: string | null;
  activeSessions: number;
}

let supervisorState: SupervisorState = globalForSupervisor.supervisorState || {
  enabled: false,
  apiKey: null,
  config: {
    checkIntervalSeconds: 60,
    inactivityThresholdMinutes: 5,
    activeWorkThresholdMinutes: 10,
    messages: ["Please resume working on this task.", "Are you still there?", "Status update?"],
  },
  intervalId: null,
  lastCheck: null,
  activeSessions: 0
};

if (process.env.NODE_ENV !== 'production') globalForSupervisor.supervisorState = supervisorState;

async function julesRequest(endpoint: string, method = 'GET', body: any = null) {
  if (!supervisorState.apiKey) return null;
  
  const url = `${JULES_API_BASE}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': supervisorState.apiKey
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[Server Supervisor] API Error ${res.status}: ${txt}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[Server Supervisor] Network Error:`, err);
    return null;
  }
}

async function checkSessions() {
  if (!supervisorState.enabled || !supervisorState.apiKey) return;

  console.log('[Server Supervisor] Checking sessions...');
  supervisorState.lastCheck = new Date().toISOString();

  try {
    // List Sessions
    // Note: Pagination not implemented for simplicity, fetches first page (usually 100)
    const data = await julesRequest('/sessions?pageSize=100');
    if (!data || !data.sessions) return;

    const sessions = data.sessions;
    supervisorState.activeSessions = sessions.length;

    for (const session of sessions) {
      // Map State
      const state = session.state; // ACTIVE, PAUSED, COMPLETED, FAILED, etc.
      
      // 1. Resume Paused/Completed/Failed (if configured to do so - assuming yes for "autopilot")
      // Actually, we should be careful not to infinite loop on completed sessions unless they are meant to be continuous.
      // For now, we only resume PAUSED.
      if (state === 'PAUSED') {
        console.log(`[Server Supervisor] Resuming paused session ${session.id}`);
        await julesRequest(`/sessions/${session.id}:sendMessage`, 'POST', {
          prompt: "Please resume working."
        });
        continue;
      }

      // 2. Check Inactivity
      if (state === 'ACTIVE' || state === 'IN_PROGRESS') {
        const lastActivity = session.lastActivityAt || session.updateTime || session.createTime;
        const lastActivityDate = new Date(lastActivity);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastActivityDate.getTime()) / 1000 / 60;

        const threshold = supervisorState.config.inactivityThresholdMinutes || 10;

        if (diffMinutes > threshold) {
          console.log(`[Server Supervisor] Session ${session.id} inactive for ${Math.round(diffMinutes)}m. Nudging...`);
          const msg = supervisorState.config.messages[Math.floor(Math.random() * supervisorState.config.messages.length)];
          await julesRequest(`/sessions/${session.id}:sendMessage`, 'POST', {
            prompt: msg
          });
        }
      }
    }
  } catch (err) {
    console.error('[Server Supervisor] Error in check loop:', err);
  }
}

export function updateSupervisor(params: { enabled?: boolean; apiKey?: string; config?: Partial<SupervisorConfig> }) {
  const { enabled, apiKey, config } = params;
  
  if (apiKey) supervisorState.apiKey = apiKey;
  if (config) supervisorState.config = { ...supervisorState.config, ...config };
  if (typeof enabled === 'boolean') supervisorState.enabled = enabled;

  // Restart loop if needed
  if (supervisorState.intervalId) {
    clearInterval(supervisorState.intervalId);
    supervisorState.intervalId = null;
  }

  if (supervisorState.enabled && supervisorState.apiKey) {
    console.log('[Server Supervisor] Started');
    checkSessions(); // Run immediately
    supervisorState.intervalId = setInterval(checkSessions, (supervisorState.config.checkIntervalSeconds || 60) * 1000);
  } else {
    console.log('[Server Supervisor] Stopped');
  }

  return {
    enabled: supervisorState.enabled,
    lastCheck: supervisorState.lastCheck,
    activeSessions: supervisorState.activeSessions
  };
}

export function getSupervisorStatus() {
  return {
    enabled: supervisorState.enabled,
    lastCheck: supervisorState.lastCheck,
    activeSessions: supervisorState.activeSessions,
    config: supervisorState.config
  };
}
