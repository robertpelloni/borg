import { create } from 'zustand';

export type ViewType = 'dashboard' | 'chat' | 'agents' | 'tools' | 'sessions' | 'lsp' | 'health';

interface AppStore {
    currentView: ViewType;
    setView: (view: ViewType) => void;
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    addMessage: (role: 'user' | 'assistant', content: string) => void;
    clearChat: () => void;
}

export const useStore = create<AppStore>((set) => ({
    currentView: 'dashboard',
    setView: (view) => set({ currentView: view }),
    chatHistory: [],
    addMessage: (role, content) => set((state) => ({
        chatHistory: [...state.chatHistory, { role, content }]
    })),
    clearChat: () => set({ chatHistory: [] })
}));
