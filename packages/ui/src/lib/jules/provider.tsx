"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { JulesClient } from "./client";

interface JulesContextType {
  client: JulesClient | null;
  apiKey: string | null;
  isLoading: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const JulesContext = createContext<JulesContextType | undefined>(undefined);

export function JulesProvider({ children }: { children: ReactNode }) {
  // Use lazy initializer for apiKey to avoid setApiKeyState in useEffect if possible,
  // but we need to check localStorage which is client-side only.
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [client, setClient] = useState<JulesClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // This effect runs on mount to load the key.
    // The linter warning about "synchronous setState" in effect is usually relevant if it triggers loops
    // but here we want to initialize from storage.
    // We can suppress the warning or structure it differently.
    const stored = localStorage.getItem('jules-api-key');
    if (stored) {
      setApiKeyState(stored);
      setClient(new JulesClient(stored));
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setApiKey = (key: string) => {
    localStorage.setItem("jules-api-key", key);
    setApiKeyState(key);
    setClient(new JulesClient(key));
  };

  const clearApiKey = () => {
    localStorage.removeItem("jules-api-key");
    setApiKeyState(null);
    setClient(null);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <JulesContext.Provider value={{
      client,
      apiKey,
      isLoading,
      setApiKey,
      clearApiKey,
      refreshTrigger,
      triggerRefresh
    }}>
      {children}
    </JulesContext.Provider>
  );
}

export function useJules() {
  const context = useContext(JulesContext);
  if (context === undefined) {
    throw new Error("useJules must be used within a JulesProvider");
  }
  return context;
}
