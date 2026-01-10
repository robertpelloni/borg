'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HealthStatus, SubmoduleHealth } from '@/types/submodule';

const POLL_INTERVAL = 30000;

export function useSubmoduleHealth(submoduleNames: string[]) {
  const [healthMap, setHealthMap] = useState<Map<string, SubmoduleHealth>>(new Map());
  const [isPolling, setIsPolling] = useState(false);

  const fetchHealth = useCallback(async () => {
    if (submoduleNames.length === 0) return;
    
    setIsPolling(true);
    
    try {
      const response = await fetch('/api/ecosystem/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: submoduleNames })
      });
      
      if (response.ok) {
        const data = await response.json();
        const newMap = new Map<string, SubmoduleHealth>();
        
        for (const item of data.health || []) {
          newMap.set(item.name, item);
        }
        
        setHealthMap(newMap);
      }
    } catch {
      const errorMap = new Map<string, SubmoduleHealth>();
      for (const name of submoduleNames) {
        errorMap.set(name, {
          name,
          status: 'unknown',
          lastCheck: new Date().toISOString()
        });
      }
      setHealthMap(errorMap);
    } finally {
      setIsPolling(false);
    }
  }, [submoduleNames]);

  useEffect(() => {
    fetchHealth();
    
    const interval = setInterval(fetchHealth, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getHealth = useCallback((name: string): SubmoduleHealth => {
    return healthMap.get(name) || {
      name,
      status: isPolling ? 'checking' : 'unknown',
      lastCheck: new Date().toISOString()
    };
  }, [healthMap, isPolling]);

  return { getHealth, isPolling, refresh: fetchHealth };
}

export function getHealthColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return 'bg-green-500';
    case 'warning': return 'bg-amber-500';
    case 'error': return 'bg-red-500';
    case 'checking': return 'bg-blue-500 animate-pulse';
    default: return 'bg-gray-500';
  }
}
