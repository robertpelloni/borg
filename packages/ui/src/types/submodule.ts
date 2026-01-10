export type SyncStatus = 'synced' | 'behind' | 'ahead' | 'diverged' | 'unknown';
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'checking' | 'unknown';

export interface SubmoduleHealth {
  name: string;
  status: HealthStatus;
  lastCheck: string;
  message?: string;
}

export interface Submodule {
  name: string;
  path: string;
  url: string;
  status: string;
  commit: string;
  category: string;
  role: string;
  description: string;
  rationale: string;
  integrationStrategy: string;
  isInstalled: boolean;
  date?: string;
  syncStatus?: SyncStatus;
}

export interface SubmoduleData {
  lastUpdated: string;
  submodules: Submodule[];
}
