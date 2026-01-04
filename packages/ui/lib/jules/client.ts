import type { Source, Session, Activity, CreateSessionRequest, CreateActivityRequest, SessionOutput } from '@/types/jules';

// API Response Interfaces (Internal)
interface ApiSource {
  source?: string;
  name?: string;
  [key: string]: unknown;
}

interface ApiSessionOutput {
  pullRequest?: {
    url: string;
    title: string;
    description: string;
  };
  [key: string]: unknown;
}

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
  outputs?: ApiSessionOutput[];
  [key: string]: unknown;
}

interface ApiPlanStep {
  id: string;
  title: string;
  description: string;
  index: number;
}

interface ApiPlan {
  id?: string;
  description?: string;
  summary?: string;
  title?: string;
  steps?: ApiPlanStep[];
  createTime?: string;
  [key: string]: unknown;
}

interface ApiGitPatch {
  unidiffPatch?: string;
  baseCommitId?: string;
  suggestedCommitMessage?: string;
}

interface ApiChangeSet {
  source?: string;
  gitPatch?: ApiGitPatch;
  unidiffPatch?: string; // Legacy/Direct support
}

interface ApiBashOutput {
  command?: string;
  output?: string;
  exitCode?: number;
}

interface ApiArtifact {
  changeSet?: ApiChangeSet;
  bashOutput?: ApiBashOutput;
  media?: { data: string; mimeType: string };
  [key: string]: unknown;
}

interface ApiActivity {
  name?: string;
  id?: string;
  createTime: string;
  originator?: string;
  planGenerated?: { plan?: ApiPlan; description?: string; summary?: string; title?: string; steps?: ApiPlanStep[]; [key: string]: unknown };
  planApproved?: { [key: string]: unknown } | boolean;
  progressUpdated?: { progressDescription?: string; description?: string; message?: string; artifacts?: ApiArtifact[]; [key: string]: unknown };
  sessionCompleted?: { summary?: string; message?: string; artifacts?: ApiArtifact[]; [key: string]: unknown };
  agentMessaged?: { agentMessage?: string; message?: string; [key: string]: unknown };
  userMessage?: { message?: string; content?: string; [key: string]: unknown }; // Matches userMessaged but handles variations
  userMessaged?: { message?: string; content?: string; [key: string]: unknown }; // Python SDK name
  artifacts?: ApiArtifact[];
  message?: string;
  content?: string;
  text?: string;
  description?: string;
  diff?: string;
  bashOutput?: string;
  [key: string]: unknown;
}

export class JulesAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'JulesAPIError';
  }
}

export class JulesClient {
  private baseURL = '/api/jules';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Build URL with path as query param for our proxy
    const url = `${this.baseURL}?path=${encodeURIComponent(endpoint)}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Jules-Api-Key': this.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new JulesAPIError(
            'Invalid API key. Please check your Jules API key in settings.',
            response.status,
            error
          );
        }

        if (response.status === 403) {
          throw new JulesAPIError(
            'Access forbidden. Please ensure your API key has the correct permissions.',
            response.status,
            error
          );
        }

        if (response.status === 404) {
          if (endpoint.includes('/activities')) {
            // Return structure matching list response for activities
            return { activities: [] } as T;
          }
          throw new JulesAPIError(
            'Resource not found. The requested endpoint may not exist.',
            response.status,
            error
          );
        }

        throw new JulesAPIError(
          error.message || `Request failed with status ${response.status}`,
          response.status,
          error
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof JulesAPIError) throw error;

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new JulesAPIError(
          'Unable to connect to the server. Please check your internet connection and try again.',
          undefined,
          error
        );
      }

      throw new JulesAPIError(
        error instanceof Error ? error.message : 'Network request failed. Please try again.',
        undefined,
        error
      );
    }
  }

  // Sources
  async listSources(filter?: string): Promise<Source[]> {
    let allSources: ApiSource[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (pageToken) params.set('pageToken', pageToken);
      if (filter) params.set('filter', filter);

      const endpoint = `/sources?${params.toString()}`;
      const response = await this.request<{ sources?: ApiSource[]; nextPageToken?: string }>(endpoint);

      if (response.sources) {
        allSources = allSources.concat(response.sources);
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    const sources = allSources.map((source: ApiSource) => {
      const sourcePath = source.source || source.name || '';
      const match = sourcePath.match(/sources\/github\/(.+)/);
      const repoPath = match ? match[1] : sourcePath;

      return {
        id: sourcePath,
        name: repoPath,
        type: 'github' as const,
        metadata: source as Record<string, unknown>
      };
    });

    // Sort logic same as before...
     const missingRepo = 'sbhavani/dgx-spark-playbooks';
    const missingRepoId = `sources/github/${missingRepo}`;
    if (!sources.some(s => s.id === missingRepoId)) {
      sources.push({
        id: missingRepoId,
        name: missingRepo,
        type: 'github',
        metadata: { source: missingRepoId, name: missingRepoId }
      });
    }

    // Sort by latest activity if possible
    try {
      const allSessions = await this.listSessions();
      const latestActivityMap = new Map<string, string>();
      for (const session of allSessions) {
        const sourceId = `sources/github/${session.sourceId}`;
        const activityTime = session.lastActivityAt || session.updatedAt || session.createdAt;
        if (!latestActivityMap.has(sourceId) || (activityTime && activityTime > latestActivityMap.get(sourceId)!)) {
          latestActivityMap.set(sourceId, activityTime);
        }
      }
      sources.sort((a, b) => {
        const aTime = latestActivityMap.get(a.id) || '';
        const bTime = latestActivityMap.get(b.id) || '';
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        return bTime.localeCompare(aTime);
      });
    } catch { /* ignore */ }

    return sources;
  }

  async getSource(id: string): Promise<Source> {
    return this.request<Source>(`/sources/${id}`);
  }

  // Sessions
  async listSessions(sourceId?: string): Promise<Session[]> {
    let allSessions: ApiSession[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (sourceId) params.set('sourceId', sourceId);
      if (pageToken) params.set('pageToken', pageToken);

      const endpoint = `/sessions?${params.toString()}`;
      const response = await this.request<{ sessions?: ApiSession[]; nextPageToken?: string }>(endpoint);

      if (response.sessions) {
        allSessions = allSessions.concat(response.sessions);
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    return allSessions.map((session: ApiSession) => this.transformSession(session));
  }

  private mapState(state: string): Session['status'] {
    const stateMap: Record<string, Session['status']> = {
      'COMPLETED': 'completed',
      'ACTIVE': 'active',
      'PLANNING': 'active',
      'QUEUED': 'active',
      'IN_PROGRESS': 'active',
      'AWAITING_USER_FEEDBACK': 'active',
      'AWAITING_PLAN_APPROVAL': 'awaiting_approval',
      'FAILED': 'failed',
      'PAUSED': 'paused'
    };
    return stateMap[state] || 'active';
  }

  private transformSession(session: ApiSession): Session {
      const outputs: SessionOutput[] = (session.outputs || []).map(o => ({
          pullRequest: o.pullRequest,
          ...o
      }));

      return {
        id: session.id,
        sourceId: session.sourceContext?.source?.replace('sources/github/', '') || '',
        title: session.title || '',
        status: this.mapState(session.state || ''),
        rawState: session.state,
        createdAt: session.createTime,
        updatedAt: session.updateTime,
        lastActivityAt: session.lastActivityAt,
        branch: session.sourceContext?.githubRepoContext?.startingBranch || 'main',
        outputs: outputs.length > 0 ? outputs : undefined
      };
  }

  async getSession(id: string): Promise<Session> {
    const response = await this.request<ApiSession>(`/sessions/${id}`);
    return this.transformSession(response);
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    let prompt = data.prompt;
    if (data.autoCreatePr) {
      prompt += '\n\nIMPORTANT: Automatically create a pull request when code changes are ready.';
    }

    const requestBody = {
      prompt: prompt,
      sourceContext: {
        source: data.sourceId,
        githubRepoContext: {
          startingBranch: data.startingBranch || 'main' // Default to main branch
        }
      },
      title: data.title || 'Untitled Session',
      requirePlanApproval: true // Enable plan approval as per requirements
    };

    const response = await this.request<ApiSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    return this.transformSession(response);
  }

  async deleteSession(id: string): Promise<void> {
    await this.request<void>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  async updateSession(id: string, data: Partial<Session>): Promise<Session> {
    // TODO: Implement actual API call when available
    console.warn('updateSession not implemented in API client', id, data);
    return this.getSession(id);
  }

  async approvePlan(sessionId: string): Promise<void> {
    // Matches Python SDK: self.client.post(f"{session_id}:approvePlan")
    await this.request<void>(`/sessions/${sessionId}:approvePlan`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async resumeSession(sessionId: string): Promise<void> {
    await this.createActivity({
      sessionId,
      content: 'Please resume working on this task.',
      type: 'message'
    });
  }

  // Activities (Paged)
  async listActivitiesPaged(sessionId: string, pageSize: number = 100, pageToken?: string): Promise<{ activities: Activity[], nextPageToken?: string }> {
      const params = new URLSearchParams();
      params.set('pageSize', pageSize.toString());
      if (pageToken) params.set('pageToken', pageToken);

      const response = await this.request<{ activities?: ApiActivity[]; nextPageToken?: string }>(
          `/sessions/${sessionId}/activities?${params.toString()}`
      );

      const activities = (response.activities || []).map(a => this.transformActivity(a, sessionId));
      return { activities, nextPageToken: response.nextPageToken };
  }

  // Activities (Fetch All - Legacy/Convenience)
  async listActivities(sessionId: string): Promise<Activity[]> {
    let allActivities: Activity[] = [];
    let pageToken: string | undefined;

    do {
        const result = await this.listActivitiesPaged(sessionId, 100, pageToken);
        allActivities = allActivities.concat(result.activities);
        pageToken = result.nextPageToken;
    } while (pageToken);

    return allActivities;
  }

  async getActivity(sessionId: string, activityId: string): Promise<Activity> {
    const response = await this.request<ApiActivity>(`/sessions/${sessionId}/activities/${activityId}`);
    return this.transformActivity(response, sessionId);
  }

  private transformActivity(activity: ApiActivity, sessionId: string): Activity {
      const id = activity.name?.split('/').pop() || activity.id || '';
      let type: Activity['type'] = 'message';
      let content = '';
      let diff = activity.diff || undefined;
      let bashOutput = activity.bashOutput || undefined;
      let media: { data: string; mimeType: string } | undefined = undefined;

      // Extract specific content based on type
      if (activity.planGenerated) {
        type = 'plan';
        const plan = activity.planGenerated.plan || activity.planGenerated;
        content = plan.description || plan.summary || plan.title || JSON.stringify(plan.steps || plan, null, 2);
      } else if (activity.planApproved) {
        type = 'plan';
        content = 'Plan approved';
      } else if (activity.progressUpdated) {
        type = 'progress';
        content = activity.progressUpdated.progressDescription ||
                  activity.progressUpdated.description ||
                  activity.progressUpdated.message ||
                  JSON.stringify(activity.progressUpdated, null, 2);
      } else if (activity.sessionCompleted) {
        type = 'result';
        const result = activity.sessionCompleted;
        content = result.summary || result.message || 'Session completed';
      } else if (activity.agentMessaged) {
        type = 'message';
        content = activity.agentMessaged.agentMessage || activity.agentMessaged.message || '';
      } else if (activity.userMessage || activity.userMessaged) {
        type = 'message';
        const um = activity.userMessage || activity.userMessaged;
        content = um?.message || um?.content || (um?.text as string) || '';

        if (!content && typeof um === 'object' && um !== null) {
            if (Object.keys(um).length > 0) {
                 const stringVal = Object.values(um).find(v => typeof v === 'string' && v.length > 0);
                 if (stringVal) content = stringVal as string;
                 else content = JSON.stringify(um);
            }
        }
      }

      // Extract artifacts
      if (activity.artifacts && activity.artifacts.length > 0) {
        for (const artifact of activity.artifacts) {
          if (artifact.changeSet?.gitPatch?.unidiffPatch) {
            diff = artifact.changeSet.gitPatch.unidiffPatch;
          } else if (artifact.changeSet?.unidiffPatch) {
            diff = artifact.changeSet.unidiffPatch;
          }
          if (artifact.bashOutput?.output) {
            bashOutput = artifact.bashOutput.output;
          }
          if (artifact.media) {
             media = artifact.media;
          }
        }
      }

      // Fallback content
      if (!content) {
        content = activity.message ||
                  activity.content ||
                  activity.text ||
                  activity.description ||
                  (activity.artifacts ? JSON.stringify(activity.artifacts, null, 2) : '') ||
                  '';
      }

      return {
        id,
        sessionId,
        type,
        role: (activity.originator === 'agent' ? 'agent' : 'user') as Activity['role'],
        content,
        diff,
        bashOutput,
        media,
        createdAt: activity.createTime,
        metadata: activity as Record<string, unknown>
      };
  }

  async createActivity(data: CreateActivityRequest): Promise<Activity> {
    await this.request(`/sessions/${data.sessionId}:sendMessage`, {
      method: 'POST',
      body: JSON.stringify({ prompt: data.content }),
    });

    return {
      id: 'pending',
      sessionId: data.sessionId,
      type: 'message',
      role: 'user',
      content: data.content,
      createdAt: new Date().toISOString(),
    };
  }
}

export function createJulesClient(apiKey: string): JulesClient {
  return new JulesClient(apiKey);
}
