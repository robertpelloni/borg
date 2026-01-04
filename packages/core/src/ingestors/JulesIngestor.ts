import { MemoryManager } from '../managers/MemoryManager.js';

// --- Interfaces (Adapted from Jules Client) ---

interface ApiSession {
    id: string;
    sourceContext?: {
        source?: string;
        githubRepoContext?: {
            startingBranch?: string;
        };
    };
    title?: string;
    state?: string;
    createTime: string;
    updateTime: string;
    lastActivityAt?: string;
    [key: string]: unknown;
}

interface ApiActivity {
    name?: string;
    id?: string;
    createTime: string;
    originator?: string;
    planGenerated?: { plan?: any; description?: string; summary?: string; title?: string; steps?: any[]; [key: string]: unknown };
    planApproved?: { [key: string]: unknown } | boolean;
    progressUpdated?: { progressDescription?: string; description?: string; message?: string; artifacts?: any[]; [key: string]: unknown };
    sessionCompleted?: { summary?: string; message?: string; artifacts?: any[]; [key: string]: unknown };
    agentMessaged?: { agentMessage?: string; message?: string; [key: string]: unknown };
    userMessage?: { message?: string; content?: string; [key: string]: unknown };
    userMessaged?: { message?: string; content?: string; [key: string]: unknown };
    artifacts?: any[];
    message?: string;
    content?: string;
    text?: string;
    description?: string;
    diff?: string;
    bashOutput?: string;
    [key: string]: unknown;
}

interface Session {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

interface Activity {
    id: string;
    sessionId: string;
    type: string;
    role: 'agent' | 'user';
    content: string;
    createdAt: string;
}

// --- Ingestor Class ---

export class JulesIngestor {
    private baseUrl = 'https://jules.googleapis.com/v1alpha';

    constructor(
        private memoryManager: MemoryManager,
        private apiKey: string
    ) {}

    async syncSessions() {
        try {
            console.log('[JulesIngestor] Starting sync...');
            const sessions = await this.fetchSessions();
            console.log(`[JulesIngestor] Found ${sessions.length} sessions.`);
            
            let syncedCount = 0;
            for (const session of sessions) {
                // Only sync active or recently completed sessions to save tokens/time
                // For now, we sync all to be safe, or maybe limit to last 5
                if (syncedCount >= 5) break; 

                console.log(`[JulesIngestor] Syncing session ${session.id}...`);
                const activities = await this.fetchActivities(session.id);
                
                if (activities.length === 0) continue;

                // Format transcript for ingestion
                const transcript = activities
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map(a => `[${a.createdAt}] ${a.role.toUpperCase()}: ${a.content}`)
                    .join('\n\n');
                
                const result = await this.memoryManager.ingestSession(`Jules Session ${session.id} (${session.title})`, transcript);
                console.log(`[JulesIngestor] Ingested session ${session.id}:`, result);
                syncedCount++;
            }
            return `Synced ${syncedCount} sessions.`;
        } catch (e: any) {
            console.error('[JulesIngestor] Sync failed:', e);
            return `Failed to sync Jules sessions: ${e.message}`;
        }
    }

    private async request<T>(endpoint: string): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Jules API request failed: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
    }

    private async fetchSessions(): Promise<Session[]> {
        // Paging logic omitted for brevity, fetching first page (100)
        const response = await this.request<{ sessions?: ApiSession[] }>('/sessions?pageSize=100');
        return (response.sessions || []).map(s => ({
            id: s.id,
            title: s.title || 'Untitled',
            status: s.state || 'unknown',
            createdAt: s.createTime,
            updatedAt: s.updateTime
        }));
    }

    private async fetchActivities(sessionId: string): Promise<Activity[]> {
        let allActivities: Activity[] = [];
        let pageToken: string | undefined;

        do {
            const params = new URLSearchParams({ pageSize: '100' });
            if (pageToken) params.set('pageToken', pageToken);

            const response = await this.request<{ activities?: ApiActivity[], nextPageToken?: string }>(
                `/sessions/${sessionId}/activities?${params.toString()}`
            );

            if (response.activities) {
                const transformed = response.activities.map(a => this.transformActivity(a, sessionId));
                allActivities = allActivities.concat(transformed);
            }
            pageToken = response.nextPageToken;
        } while (pageToken);

        return allActivities;
    }

    private transformActivity(activity: ApiActivity, sessionId: string): Activity {
        const id = activity.name?.split('/').pop() || activity.id || '';
        let type = 'message';
        let content = '';

        // Extract specific content based on type (Simplified logic from client.ts)
        if (activity.planGenerated) {
            type = 'plan';
            const plan = activity.planGenerated.plan || activity.planGenerated;
            content = plan.description || plan.summary || JSON.stringify(plan);
        } else if (activity.progressUpdated) {
            type = 'progress';
            content = activity.progressUpdated.progressDescription || activity.progressUpdated.message || '';
        } else if (activity.agentMessaged) {
            type = 'message';
            content = activity.agentMessaged.agentMessage || activity.agentMessaged.message || '';
        } else if (activity.userMessage || activity.userMessaged) {
            type = 'message';
            const um = activity.userMessage || activity.userMessaged;
            content = um?.message || um?.content || (typeof um === 'string' ? um : '') || '';
        }

        // Fallback content
        if (!content) {
            content = activity.message || activity.content || activity.text || activity.description || '';
        }

        return {
            id,
            sessionId,
            type,
            role: (activity.originator === 'agent' ? 'agent' : 'user'),
            content,
            createdAt: activity.createTime
        };
    }
}
