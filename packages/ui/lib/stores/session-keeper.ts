import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SessionKeeperConfig } from '@/types/jules';

export interface Log {
  time: string;
  message: string;
  type: 'info' | 'action' | 'error' | 'skip';
}

export interface StatusSummary {
  monitoringCount: number;
  lastAction: string;
  nextCheckIn: number;
}

export interface SessionKeeperStats {
  totalNudges: number;
  totalApprovals: number;
  totalDebates: number;
}

interface SessionKeeperState {
  config: SessionKeeperConfig;
  logs: Log[];
  statusSummary: StatusSummary;
  stats: SessionKeeperStats;
  lastNudgeBySession: Record<string, number>;
  setConfig: (config: SessionKeeperConfig) => void;
  addLog: (message: string, type: Log['type']) => void;
  clearLogs: () => void;
  setStatusSummary: (summary: Partial<StatusSummary>) => void;
  incrementStat: (stat: keyof SessionKeeperStats) => void;
  recordNudge: (sessionId: string) => void;
}

const DEFAULT_CONFIG: SessionKeeperConfig = {
  isEnabled: false,
  autoSwitch: true,
  checkIntervalSeconds: 60,
  inactivityThresholdMinutes: 5,
  activeWorkThresholdMinutes: 30,
  messages: [
    "Great! Please keep going as you advise!",
    "Yes! Please continue to proceed as you recommend!",
    "This looks correct. Please proceed.",
    "Excellent plan. Go ahead.",
    "Looks good to me. Continue.",
  ],
  customMessages: {},
  smartPilotEnabled: false,
  supervisorProvider: 'openai',
  supervisorApiKey: '',
  supervisorModel: '',
  contextMessageCount: 20,
  debateEnabled: false,
  debateParticipants: []
};

export const useSessionKeeperStore = create<SessionKeeperState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      logs: [],
      statusSummary: { monitoringCount: 0, lastAction: 'None', nextCheckIn: 0 },
      stats: { totalNudges: 0, totalApprovals: 0, totalDebates: 0 },
      lastNudgeBySession: {},

      setConfig: (config) => set({ config }),

      addLog: (message, type) => set((state) => ({
        logs: [{
          time: new Date().toLocaleTimeString(),
          message,
          type
        }, ...state.logs].slice(0, 100)
      })),

      clearLogs: () => set({ logs: [] }),

      setStatusSummary: (summary) => set((state) => ({
        statusSummary: { ...state.statusSummary, ...summary }
      })),

      incrementStat: (stat) => set((state) => ({
        stats: { ...state.stats, [stat]: state.stats[stat] + 1 }
      })),

      recordNudge: (sessionId) => set((state) => ({
        lastNudgeBySession: { ...state.lastNudgeBySession, [sessionId]: Date.now() }
      })),
    }),
    {
      name: 'jules-session-keeper-store',
      partialize: (state) => ({ config: state.config, stats: state.stats }), // Persist config AND stats
    }
  )
);
