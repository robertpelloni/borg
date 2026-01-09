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
}

export interface SubmoduleData {
  lastUpdated: string;
  submodules: Submodule[];
}
