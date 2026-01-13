import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface OidcProvider {
  id: string;
  name: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OidcConfig {
  providers: OidcProvider[];
  defaultProviderId?: string;
  sessionTimeout: number;
  allowedRedirectUrls: string[];
}

export interface OidcTokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  tokenType: string;
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  groups?: string[];
}

export class OidcManager extends EventEmitter {
  private config: OidcConfig;
  private sessions: Map<string, { userId: string; providerId: string; tokens: OidcTokenSet; userInfo: OidcUserInfo }> = new Map();

  constructor() {
    super();
    this.config = {
      providers: [],
      sessionTimeout: 3600000,
      allowedRedirectUrls: ['http://localhost:3000/auth/callback'],
    };
  }

  addProvider(provider: Omit<OidcProvider, 'id' | 'createdAt' | 'updatedAt'>): OidcProvider {
    const newProvider: OidcProvider = {
      ...provider,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.config.providers.push(newProvider);
    this.emit('providerAdded', newProvider);
    return newProvider;
  }

  updateProvider(id: string, updates: Partial<Omit<OidcProvider, 'id' | 'createdAt'>>): OidcProvider | null {
    const index = this.config.providers.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.config.providers[index] = {
      ...this.config.providers[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.emit('providerUpdated', this.config.providers[index]);
    return this.config.providers[index];
  }

  removeProvider(id: string): boolean {
    const index = this.config.providers.findIndex(p => p.id === id);
    if (index === -1) return false;

    const removed = this.config.providers.splice(index, 1)[0];
    if (this.config.defaultProviderId === id) {
      this.config.defaultProviderId = undefined;
    }
    this.emit('providerRemoved', removed);
    return true;
  }

  getProvider(id: string): OidcProvider | null {
    return this.config.providers.find(p => p.id === id) ?? null;
  }

  getProviders(): OidcProvider[] {
    return this.config.providers.map(p => ({
      ...p,
      clientSecret: '***REDACTED***',
    }));
  }

  setDefaultProvider(id: string): boolean {
    if (!this.config.providers.find(p => p.id === id)) return false;
    this.config.defaultProviderId = id;
    return true;
  }

  getDefaultProvider(): OidcProvider | null {
    if (!this.config.defaultProviderId) return null;
    return this.getProvider(this.config.defaultProviderId);
  }

  buildAuthorizationUrl(providerId: string, state: string, redirectUri: string): string | null {
    const provider = this.config.providers.find(p => p.id === providerId && p.enabled);
    if (!provider) return null;

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
    });

    return `${provider.issuerUrl}/authorize?${params.toString()}`;
  }

  async exchangeCode(providerId: string, code: string, redirectUri: string): Promise<OidcTokenSet | null> {
    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider) return null;

    try {
      const response = await fetch(`${provider.issuerUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type,
      };
    } catch {
      return null;
    }
  }

  async getUserInfo(providerId: string, accessToken: string): Promise<OidcUserInfo | null> {
    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider) return null;

    try {
      const response = await fetch(`${provider.issuerUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  createSession(providerId: string, tokens: OidcTokenSet, userInfo: OidcUserInfo): string {
    const sessionId = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(sessionId, {
      userId: userInfo.sub,
      providerId,
      tokens,
      userInfo,
    });
    this.emit('sessionCreated', { sessionId, userId: userInfo.sub });
    return sessionId;
  }

  getSession(sessionId: string): { userId: string; userInfo: OidcUserInfo } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.tokens.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return { userId: session.userId, userInfo: session.userInfo };
  }

  revokeSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.emit('sessionRevoked', sessionId);
    }
    return deleted;
  }

  setAllowedRedirectUrls(urls: string[]): void {
    this.config.allowedRedirectUrls = urls;
  }

  getAllowedRedirectUrls(): string[] {
    return this.config.allowedRedirectUrls;
  }

  setSessionTimeout(ms: number): void {
    this.config.sessionTimeout = ms;
  }

  getStatus(): {
    providerCount: number;
    enabledProviders: number;
    activeSessionCount: number;
    defaultProvider: string | null;
  } {
    return {
      providerCount: this.config.providers.length,
      enabledProviders: this.config.providers.filter(p => p.enabled).length,
      activeSessionCount: this.sessions.size,
      defaultProvider: this.config.defaultProviderId ?? null,
    };
  }
}
