/**
 * AIOS Integration Service
 * 
 * Manages connections to external services with support for:
 * - GitHub/GitLab for code repositories and CI/CD
 * - Jira/Linear for project management
 * - Slack/Discord for team communication
 * - OAuth flows and token management
 * - Webhook registration and handling
 * - Rate limiting and retry logic
 * 
 * @module services/IntegrationService
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================
// Types & Interfaces
// ============================================

export type IntegrationType = 
    | 'github'
    | 'gitlab'
    | 'bitbucket'
    | 'jira'
    | 'linear'
    | 'slack'
    | 'discord'
    | 'teams'
    | 'notion'
    | 'confluence'
    | 'custom';

export type IntegrationStatus = 
    | 'connected'
    | 'disconnected'
    | 'expired'
    | 'error'
    | 'pending';

export type AuthType = 
    | 'oauth2'
    | 'api_key'
    | 'personal_token'
    | 'webhook_secret'
    | 'basic';

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    redirectUri: string;
}

export interface Integration {
    id: string;
    name: string;
    type: IntegrationType;
    description?: string;
    enabled: boolean;
    status: IntegrationStatus;
    
    // Authentication
    auth: {
        type: AuthType;
        
        // OAuth2
        oauth?: {
            config: OAuthConfig;
            accessToken?: string;
            refreshToken?: string;
            tokenType?: string;
            expiresAt?: Date;
            scope?: string;
        };
        
        // API Key / Personal Token
        apiKey?: string;
        personalToken?: string;
        
        // Basic Auth
        username?: string;
        password?: string;
        
        // Webhook Secret
        webhookSecret?: string;
    };
    
    // Connection details
    config: {
        baseUrl?: string;           // API base URL
        organization?: string;       // Org/workspace name
        project?: string;           // Project/repo name
        defaultChannel?: string;    // Slack/Discord channel
        
        // Custom headers
        headers?: Record<string, string>;
        
        // Rate limiting
        rateLimit?: {
            requestsPerMinute?: number;
            requestsPerHour?: number;
        };
        
        // Webhook configuration
        webhooks?: Array<{
            id: string;
            url: string;
            events: string[];
            secret?: string;
            active: boolean;
        }>;
    };
    
    // Usage tracking
    usage: {
        lastUsed?: Date;
        requestCount: number;
        errorCount: number;
        lastError?: string;
    };
    
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IntegrationTemplate {
    type: IntegrationType;
    name: string;
    description: string;
    authTypes: AuthType[];
    defaultScopes?: string[];
    oauthConfig?: Partial<OAuthConfig>;
    requiredFields: string[];
    optionalFields: string[];
    documentation?: string;
}

export interface WebhookEvent {
    id: string;
    integrationId: string;
    type: string;
    payload: Record<string, unknown>;
    headers: Record<string, string>;
    signature?: string;
    verified: boolean;
    processedAt?: Date;
    error?: string;
    receivedAt: Date;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    rateLimit?: {
        limit: number;
        remaining: number;
        reset: Date;
    };
}

// ============================================
// Integration Templates
// ============================================

const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
    {
        type: 'github',
        name: 'GitHub',
        description: 'Connect to GitHub for repository access, issues, PRs, and actions',
        authTypes: ['oauth2', 'personal_token'],
        defaultScopes: ['repo', 'read:user', 'read:org', 'workflow'],
        oauthConfig: {
            authorizationUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
        },
        requiredFields: [],
        optionalFields: ['organization', 'project'],
        documentation: 'https://docs.github.com/en/rest',
    },
    {
        type: 'gitlab',
        name: 'GitLab',
        description: 'Connect to GitLab for repository access, issues, MRs, and CI/CD',
        authTypes: ['oauth2', 'personal_token'],
        defaultScopes: ['api', 'read_user', 'read_repository'],
        oauthConfig: {
            authorizationUrl: 'https://gitlab.com/oauth/authorize',
            tokenUrl: 'https://gitlab.com/oauth/token',
        },
        requiredFields: [],
        optionalFields: ['baseUrl', 'organization', 'project'],
        documentation: 'https://docs.gitlab.com/ee/api/',
    },
    {
        type: 'jira',
        name: 'Jira',
        description: 'Connect to Jira for issue tracking and project management',
        authTypes: ['oauth2', 'api_key'],
        defaultScopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
        oauthConfig: {
            authorizationUrl: 'https://auth.atlassian.com/authorize',
            tokenUrl: 'https://auth.atlassian.com/oauth/token',
        },
        requiredFields: ['baseUrl'],
        optionalFields: ['project'],
        documentation: 'https://developer.atlassian.com/cloud/jira/platform/rest/',
    },
    {
        type: 'linear',
        name: 'Linear',
        description: 'Connect to Linear for issue tracking and project management',
        authTypes: ['oauth2', 'api_key'],
        defaultScopes: ['read', 'write', 'issues:create'],
        oauthConfig: {
            authorizationUrl: 'https://linear.app/oauth/authorize',
            tokenUrl: 'https://api.linear.app/oauth/token',
        },
        requiredFields: [],
        optionalFields: ['organization'],
        documentation: 'https://developers.linear.app/docs',
    },
    {
        type: 'slack',
        name: 'Slack',
        description: 'Connect to Slack for team messaging and notifications',
        authTypes: ['oauth2', 'webhook_secret'],
        defaultScopes: ['channels:read', 'chat:write', 'users:read', 'files:write'],
        oauthConfig: {
            authorizationUrl: 'https://slack.com/oauth/v2/authorize',
            tokenUrl: 'https://slack.com/api/oauth.v2.access',
        },
        requiredFields: [],
        optionalFields: ['defaultChannel'],
        documentation: 'https://api.slack.com/docs',
    },
    {
        type: 'discord',
        name: 'Discord',
        description: 'Connect to Discord for server messaging and notifications',
        authTypes: ['oauth2', 'webhook_secret'],
        defaultScopes: ['bot', 'applications.commands'],
        oauthConfig: {
            authorizationUrl: 'https://discord.com/api/oauth2/authorize',
            tokenUrl: 'https://discord.com/api/oauth2/token',
        },
        requiredFields: [],
        optionalFields: ['defaultChannel'],
        documentation: 'https://discord.com/developers/docs',
    },
    {
        type: 'notion',
        name: 'Notion',
        description: 'Connect to Notion for documentation and knowledge base',
        authTypes: ['oauth2', 'api_key'],
        defaultScopes: [],
        oauthConfig: {
            authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
            tokenUrl: 'https://api.notion.com/v1/oauth/token',
        },
        requiredFields: [],
        optionalFields: [],
        documentation: 'https://developers.notion.com/',
    },
    {
        type: 'custom',
        name: 'Custom Integration',
        description: 'Create a custom integration with any REST API',
        authTypes: ['api_key', 'personal_token', 'basic', 'oauth2'],
        requiredFields: ['baseUrl'],
        optionalFields: ['headers'],
        documentation: '',
    },
];

// ============================================
// Integration Service Implementation
// ============================================

export class IntegrationService extends EventEmitter {
    private static instance: IntegrationService;
    
    // Storage
    private integrations: Map<string, Integration> = new Map();
    private webhookEvents: WebhookEvent[] = [];
    private oauthStates: Map<string, { integrationId: string; expiresAt: Date }> = new Map();
    
    // Rate limiting tracking
    private rateLimitState: Map<string, {
        minuteCount: number;
        hourCount: number;
        minuteReset: Date;
        hourReset: Date;
    }> = new Map();
    
    // Persistence
    private dataDir: string;
    private encryptionKey: Buffer;
    
    private constructor() {
        super();
        this.dataDir = path.join(process.cwd(), '.aios', 'integrations');
        this.encryptionKey = this.getOrCreateEncryptionKey();
        this.ensureDataDir();
        this.loadState();
        this.startTokenRefresh();
    }
    
    static getInstance(): IntegrationService {
        if (!IntegrationService.instance) {
            IntegrationService.instance = new IntegrationService();
        }
        return IntegrationService.instance;
    }
    
    private getOrCreateEncryptionKey(): Buffer {
        const keyFile = path.join(process.cwd(), '.aios', '.integration-key');
        
        try {
            if (fs.existsSync(keyFile)) {
                return Buffer.from(fs.readFileSync(keyFile, 'utf-8'), 'hex');
            }
        } catch {
            // Generate new key
        }
        
        const key = crypto.randomBytes(32);
        try {
            fs.mkdirSync(path.dirname(keyFile), { recursive: true });
            fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
        } catch {
            // Continue with ephemeral key
        }
        return key;
    }
    
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
    
    private decrypt(encrypted: string): string {
        const [ivHex, authTagHex, content] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    
    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    
    private loadState(): void {
        try {
            const integrationsFile = path.join(this.dataDir, 'integrations.json');
            if (fs.existsSync(integrationsFile)) {
                const data = JSON.parse(fs.readFileSync(integrationsFile, 'utf-8'));
                for (const integration of data) {
                    // Decrypt sensitive fields
                    if (integration.auth.oauth?.accessToken) {
                        try {
                            integration.auth.oauth.accessToken = this.decrypt(integration.auth.oauth.accessToken);
                        } catch { /* Invalid encryption, clear token */ }
                    }
                    if (integration.auth.oauth?.refreshToken) {
                        try {
                            integration.auth.oauth.refreshToken = this.decrypt(integration.auth.oauth.refreshToken);
                        } catch { /* Invalid encryption, clear token */ }
                    }
                    if (integration.auth.apiKey) {
                        try {
                            integration.auth.apiKey = this.decrypt(integration.auth.apiKey);
                        } catch { /* Invalid encryption, clear token */ }
                    }
                    if (integration.auth.personalToken) {
                        try {
                            integration.auth.personalToken = this.decrypt(integration.auth.personalToken);
                        } catch { /* Invalid encryption, clear token */ }
                    }
                    
                    // Parse dates
                    integration.createdAt = new Date(integration.createdAt);
                    integration.updatedAt = new Date(integration.updatedAt);
                    if (integration.auth.oauth?.expiresAt) {
                        integration.auth.oauth.expiresAt = new Date(integration.auth.oauth.expiresAt);
                    }
                    if (integration.usage.lastUsed) {
                        integration.usage.lastUsed = new Date(integration.usage.lastUsed);
                    }
                    
                    this.integrations.set(integration.id, integration);
                }
            }
            
            // Load webhook events (last 1000)
            const eventsFile = path.join(this.dataDir, 'webhook-events.json');
            if (fs.existsSync(eventsFile)) {
                const data = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'));
                for (const event of data.slice(-1000)) {
                    event.receivedAt = new Date(event.receivedAt);
                    if (event.processedAt) event.processedAt = new Date(event.processedAt);
                    this.webhookEvents.push(event);
                }
            }
        } catch (error) {
            console.error('Failed to load integration state:', error);
        }
    }
    
    private saveState(): void {
        try {
            // Encrypt sensitive fields before saving
            const integrationsToSave = Array.from(this.integrations.values()).map(integration => {
                const copy = JSON.parse(JSON.stringify(integration));
                
                if (copy.auth.oauth?.accessToken) {
                    copy.auth.oauth.accessToken = this.encrypt(copy.auth.oauth.accessToken);
                }
                if (copy.auth.oauth?.refreshToken) {
                    copy.auth.oauth.refreshToken = this.encrypt(copy.auth.oauth.refreshToken);
                }
                if (copy.auth.apiKey) {
                    copy.auth.apiKey = this.encrypt(copy.auth.apiKey);
                }
                if (copy.auth.personalToken) {
                    copy.auth.personalToken = this.encrypt(copy.auth.personalToken);
                }
                
                return copy;
            });
            
            fs.writeFileSync(
                path.join(this.dataDir, 'integrations.json'),
                JSON.stringify(integrationsToSave, null, 2)
            );
            
            // Save recent webhook events
            fs.writeFileSync(
                path.join(this.dataDir, 'webhook-events.json'),
                JSON.stringify(this.webhookEvents.slice(-1000), null, 2)
            );
        } catch (error) {
            console.error('Failed to save integration state:', error);
        }
    }
    
    private startTokenRefresh(): void {
        // Check for expiring tokens every 5 minutes
        setInterval(() => {
            this.refreshExpiringTokens();
        }, 300000);
    }
    
    private async refreshExpiringTokens(): Promise<void> {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 300000);
        
        for (const [id, integration] of this.integrations) {
            if (!integration.enabled) continue;
            if (integration.auth.type !== 'oauth2') continue;
            if (!integration.auth.oauth?.refreshToken) continue;
            if (!integration.auth.oauth.expiresAt) continue;
            
            if (integration.auth.oauth.expiresAt <= fiveMinutesFromNow) {
                try {
                    await this.refreshOAuthToken(id);
                } catch (error) {
                    console.error(`Failed to refresh token for ${integration.name}:`, error);
                    integration.status = 'expired';
                    this.emit('integration.token.expired', integration);
                }
            }
        }
    }
    
    // ============================================
    // Integration Management
    // ============================================
    
    getTemplate(type: IntegrationType): IntegrationTemplate | undefined {
        return INTEGRATION_TEMPLATES.find(t => t.type === type);
    }
    
    listTemplates(): IntegrationTemplate[] {
        return [...INTEGRATION_TEMPLATES];
    }
    
    createIntegration(input: {
        name: string;
        type: IntegrationType;
        description?: string;
        authType: AuthType;
        config?: Integration['config'];
        metadata?: Record<string, unknown>;
    }): Integration {
        const template = this.getTemplate(input.type);
        
        const integration: Integration = {
            id: this.generateId('int'),
            name: input.name,
            type: input.type,
            description: input.description,
            enabled: true,
            status: 'disconnected',
            auth: {
                type: input.authType,
            },
            config: {
                ...input.config,
            },
            usage: {
                requestCount: 0,
                errorCount: 0,
            },
            metadata: input.metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        
        // Set up OAuth config from template if applicable
        if (input.authType === 'oauth2' && template?.oauthConfig) {
            integration.auth.oauth = {
                config: {
                    clientId: '',
                    clientSecret: '',
                    authorizationUrl: template.oauthConfig.authorizationUrl || '',
                    tokenUrl: template.oauthConfig.tokenUrl || '',
                    scopes: template.defaultScopes || [],
                    redirectUri: '',
                },
            };
        }
        
        this.integrations.set(integration.id, integration);
        this.saveState();
        this.emit('integration.created', integration);
        
        return integration;
    }
    
    updateIntegration(id: string, updates: Partial<Integration>): Integration | null {
        const integration = this.integrations.get(id);
        if (!integration) return null;
        
        const updated: Integration = {
            ...integration,
            ...updates,
            id: integration.id,
            createdAt: integration.createdAt,
            updatedAt: new Date(),
        };
        
        this.integrations.set(id, updated);
        this.saveState();
        this.emit('integration.updated', updated);
        
        return updated;
    }
    
    deleteIntegration(id: string): boolean {
        const deleted = this.integrations.delete(id);
        if (deleted) {
            this.saveState();
            this.emit('integration.deleted', { id });
        }
        return deleted;
    }
    
    getIntegration(id: string): Integration | undefined {
        return this.integrations.get(id);
    }
    
    listIntegrations(filter?: {
        type?: IntegrationType;
        status?: IntegrationStatus;
        enabled?: boolean;
    }): Integration[] {
        let integrations = Array.from(this.integrations.values());
        
        if (filter?.type) {
            integrations = integrations.filter(i => i.type === filter.type);
        }
        if (filter?.status) {
            integrations = integrations.filter(i => i.status === filter.status);
        }
        if (filter?.enabled !== undefined) {
            integrations = integrations.filter(i => i.enabled === filter.enabled);
        }
        
        return integrations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    
    // ============================================
    // OAuth Flow
    // ============================================
    
    configureOAuth(id: string, config: OAuthConfig): Integration | null {
        const integration = this.integrations.get(id);
        if (!integration) return null;
        
        if (integration.auth.type !== 'oauth2') {
            throw new Error('Integration is not configured for OAuth2');
        }
        
        integration.auth.oauth = {
            ...integration.auth.oauth,
            config,
        };
        integration.updatedAt = new Date();
        
        this.integrations.set(id, integration);
        this.saveState();
        
        return integration;
    }
    
    generateAuthorizationUrl(id: string, additionalParams?: Record<string, string>): string {
        const integration = this.integrations.get(id);
        if (!integration) throw new Error('Integration not found');
        if (!integration.auth.oauth?.config) throw new Error('OAuth not configured');
        
        const config = integration.auth.oauth.config;
        const state = crypto.randomBytes(32).toString('hex');
        
        // Store state for verification
        this.oauthStates.set(state, {
            integrationId: id,
            expiresAt: new Date(Date.now() + 600000), // 10 minutes
        });
        
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scopes.join(' '),
            state,
            response_type: 'code',
            ...additionalParams,
        });
        
        return `${config.authorizationUrl}?${params.toString()}`;
    }
    
    async handleOAuthCallback(code: string, state: string): Promise<Integration> {
        const stateData = this.oauthStates.get(state);
        if (!stateData) throw new Error('Invalid or expired state');
        if (stateData.expiresAt < new Date()) {
            this.oauthStates.delete(state);
            throw new Error('State expired');
        }
        
        this.oauthStates.delete(state);
        
        const integration = this.integrations.get(stateData.integrationId);
        if (!integration) throw new Error('Integration not found');
        if (!integration.auth.oauth?.config) throw new Error('OAuth not configured');
        
        const config = integration.auth.oauth.config;
        
        // Exchange code for tokens
        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                redirect_uri: config.redirectUri,
            }),
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OAuth token exchange failed: ${error}`);
        }
        
        const tokens = await response.json();
        
        integration.auth.oauth.accessToken = tokens.access_token;
        integration.auth.oauth.refreshToken = tokens.refresh_token;
        integration.auth.oauth.tokenType = tokens.token_type;
        integration.auth.oauth.scope = tokens.scope;
        
        if (tokens.expires_in) {
            integration.auth.oauth.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        }
        
        integration.status = 'connected';
        integration.updatedAt = new Date();
        
        this.integrations.set(integration.id, integration);
        this.saveState();
        this.emit('integration.connected', integration);
        
        return integration;
    }
    
    async refreshOAuthToken(id: string): Promise<Integration> {
        const integration = this.integrations.get(id);
        if (!integration) throw new Error('Integration not found');
        if (!integration.auth.oauth?.refreshToken) throw new Error('No refresh token available');
        if (!integration.auth.oauth?.config) throw new Error('OAuth not configured');
        
        const config = integration.auth.oauth.config;
        
        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: integration.auth.oauth.refreshToken,
            }),
        });
        
        if (!response.ok) {
            integration.status = 'expired';
            this.integrations.set(id, integration);
            this.saveState();
            throw new Error('Token refresh failed');
        }
        
        const tokens = await response.json();
        
        integration.auth.oauth.accessToken = tokens.access_token;
        if (tokens.refresh_token) {
            integration.auth.oauth.refreshToken = tokens.refresh_token;
        }
        if (tokens.expires_in) {
            integration.auth.oauth.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        }
        
        integration.status = 'connected';
        integration.updatedAt = new Date();
        
        this.integrations.set(id, integration);
        this.saveState();
        this.emit('integration.token.refreshed', integration);
        
        return integration;
    }
    
    // ============================================
    // API Key / Token Authentication
    // ============================================
    
    setApiKey(id: string, apiKey: string): Integration | null {
        const integration = this.integrations.get(id);
        if (!integration) return null;
        
        integration.auth.apiKey = apiKey;
        integration.status = 'connected';
        integration.updatedAt = new Date();
        
        this.integrations.set(id, integration);
        this.saveState();
        this.emit('integration.connected', integration);
        
        return integration;
    }
    
    setPersonalToken(id: string, token: string): Integration | null {
        const integration = this.integrations.get(id);
        if (!integration) return null;
        
        integration.auth.personalToken = token;
        integration.status = 'connected';
        integration.updatedAt = new Date();
        
        this.integrations.set(id, integration);
        this.saveState();
        this.emit('integration.connected', integration);
        
        return integration;
    }
    
    setBasicAuth(id: string, username: string, password: string): Integration | null {
        const integration = this.integrations.get(id);
        if (!integration) return null;
        
        integration.auth.username = username;
        integration.auth.password = password;
        integration.status = 'connected';
        integration.updatedAt = new Date();
        
        this.integrations.set(id, integration);
        this.saveState();
        this.emit('integration.connected', integration);
        
        return integration;
    }
    
    // ============================================
    // API Requests
    // ============================================
    
    async request<T = unknown>(
        integrationId: string,
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
            body?: unknown;
            headers?: Record<string, string>;
            query?: Record<string, string>;
        } = {}
    ): Promise<ApiResponse<T>> {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            return { success: false, error: 'Integration not found' };
        }
        
        if (!integration.enabled) {
            return { success: false, error: 'Integration is disabled' };
        }
        
        if (integration.status !== 'connected') {
            return { success: false, error: `Integration status: ${integration.status}` };
        }
        
        // Check rate limits
        if (!this.checkRateLimit(integrationId, integration.config.rateLimit)) {
            return { success: false, error: 'Rate limit exceeded' };
        }
        
        // Build URL
        let url = integration.config.baseUrl || this.getDefaultBaseUrl(integration.type);
        url = url.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');
        
        if (options.query) {
            const params = new URLSearchParams(options.query);
            url += '?' + params.toString();
        }
        
        // Build headers
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...integration.config.headers,
            ...options.headers,
        };
        
        // Add authentication
        this.addAuthHeaders(integration, headers);
        
        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });
            
            // Update usage
            integration.usage.requestCount++;
            integration.usage.lastUsed = new Date();
            this.incrementRateLimit(integrationId);
            
            // Parse rate limit headers
            const rateLimit = this.parseRateLimitHeaders(response.headers);
            
            if (!response.ok) {
                integration.usage.errorCount++;
                integration.usage.lastError = `HTTP ${response.status}`;
                
                if (response.status === 401) {
                    integration.status = 'expired';
                }
                
                this.integrations.set(integrationId, integration);
                this.saveState();
                
                let errorBody: string;
                try {
                    errorBody = await response.text();
                } catch {
                    errorBody = response.statusText;
                }
                
                return {
                    success: false,
                    error: errorBody,
                    statusCode: response.status,
                    rateLimit,
                };
            }
            
            this.integrations.set(integrationId, integration);
            
            let data: T;
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text() as unknown as T;
            }
            
            return {
                success: true,
                data,
                statusCode: response.status,
                rateLimit,
            };
        } catch (error) {
            integration.usage.errorCount++;
            integration.usage.lastError = error instanceof Error ? error.message : 'Unknown error';
            integration.status = 'error';
            this.integrations.set(integrationId, integration);
            this.saveState();
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Request failed',
            };
        }
    }
    
    private getDefaultBaseUrl(type: IntegrationType): string {
        switch (type) {
            case 'github': return 'https://api.github.com';
            case 'gitlab': return 'https://gitlab.com/api/v4';
            case 'slack': return 'https://slack.com/api';
            case 'discord': return 'https://discord.com/api/v10';
            case 'linear': return 'https://api.linear.app';
            case 'notion': return 'https://api.notion.com/v1';
            default: return '';
        }
    }
    
    private addAuthHeaders(integration: Integration, headers: Record<string, string>): void {
        switch (integration.auth.type) {
            case 'oauth2':
                if (integration.auth.oauth?.accessToken) {
                    headers['Authorization'] = `Bearer ${integration.auth.oauth.accessToken}`;
                }
                break;
            case 'api_key':
                if (integration.auth.apiKey) {
                    // Different services use different header names
                    if (integration.type === 'linear') {
                        headers['Authorization'] = integration.auth.apiKey;
                    } else {
                        headers['Authorization'] = `Bearer ${integration.auth.apiKey}`;
                    }
                }
                break;
            case 'personal_token':
                if (integration.auth.personalToken) {
                    if (integration.type === 'github') {
                        headers['Authorization'] = `token ${integration.auth.personalToken}`;
                    } else if (integration.type === 'gitlab') {
                        headers['PRIVATE-TOKEN'] = integration.auth.personalToken;
                    } else {
                        headers['Authorization'] = `Bearer ${integration.auth.personalToken}`;
                    }
                }
                break;
            case 'basic':
                if (integration.auth.username && integration.auth.password) {
                    const credentials = Buffer.from(`${integration.auth.username}:${integration.auth.password}`).toString('base64');
                    headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
        }
    }
    
    private checkRateLimit(integrationId: string, config?: Integration['config']['rateLimit']): boolean {
        if (!config) return true;
        
        const now = new Date();
        let state = this.rateLimitState.get(integrationId);
        
        if (!state) {
            state = {
                minuteCount: 0,
                hourCount: 0,
                minuteReset: new Date(now.getTime() + 60000),
                hourReset: new Date(now.getTime() + 3600000),
            };
            this.rateLimitState.set(integrationId, state);
        }
        
        // Reset counters if windows expired
        if (now >= state.minuteReset) {
            state.minuteCount = 0;
            state.minuteReset = new Date(now.getTime() + 60000);
        }
        if (now >= state.hourReset) {
            state.hourCount = 0;
            state.hourReset = new Date(now.getTime() + 3600000);
        }
        
        if (config.requestsPerMinute && state.minuteCount >= config.requestsPerMinute) {
            return false;
        }
        if (config.requestsPerHour && state.hourCount >= config.requestsPerHour) {
            return false;
        }
        
        return true;
    }
    
    private incrementRateLimit(integrationId: string): void {
        const state = this.rateLimitState.get(integrationId);
        if (state) {
            state.minuteCount++;
            state.hourCount++;
        }
    }
    
    private parseRateLimitHeaders(headers: Headers): ApiResponse['rateLimit'] | undefined {
        const limit = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
        const remaining = headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining');
        const reset = headers.get('x-ratelimit-reset') || headers.get('ratelimit-reset');
        
        if (limit && remaining && reset) {
            return {
                limit: parseInt(limit, 10),
                remaining: parseInt(remaining, 10),
                reset: new Date(parseInt(reset, 10) * 1000),
            };
        }
        
        return undefined;
    }
    
    // ============================================
    // Webhook Management
    // ============================================
    
    async registerWebhook(
        integrationId: string,
        config: {
            url: string;
            events: string[];
            secret?: string;
        }
    ): Promise<{ id: string; url: string }> {
        const integration = this.integrations.get(integrationId);
        if (!integration) throw new Error('Integration not found');
        
        const webhookId = this.generateId('wh');
        const secret = config.secret || crypto.randomBytes(32).toString('hex');
        
        // Register webhook with the external service
        let externalId: string;
        
        switch (integration.type) {
            case 'github':
                const ghResponse = await this.request<{ id: number }>(integrationId, `repos/${integration.config.organization}/${integration.config.project}/hooks`, {
                    method: 'POST',
                    body: {
                        name: 'web',
                        config: {
                            url: config.url,
                            content_type: 'json',
                            secret,
                        },
                        events: config.events,
                        active: true,
                    },
                });
                if (!ghResponse.success) throw new Error(ghResponse.error);
                externalId = String(ghResponse.data?.id);
                break;
                
            case 'gitlab':
                const glResponse = await this.request<{ id: number }>(integrationId, `projects/${encodeURIComponent(`${integration.config.organization}/${integration.config.project}`)}/hooks`, {
                    method: 'POST',
                    body: {
                        url: config.url,
                        token: secret,
                        push_events: config.events.includes('push'),
                        merge_requests_events: config.events.includes('merge_request'),
                        issues_events: config.events.includes('issues'),
                    },
                });
                if (!glResponse.success) throw new Error(glResponse.error);
                externalId = String(glResponse.data?.id);
                break;
                
            default:
                externalId = webhookId;
        }
        
        // Store webhook config
        if (!integration.config.webhooks) {
            integration.config.webhooks = [];
        }
        
        integration.config.webhooks.push({
            id: externalId,
            url: config.url,
            events: config.events,
            secret,
            active: true,
        });
        
        integration.updatedAt = new Date();
        this.integrations.set(integrationId, integration);
        this.saveState();
        
        return { id: externalId, url: config.url };
    }
    
    async deleteWebhook(integrationId: string, webhookId: string): Promise<boolean> {
        const integration = this.integrations.get(integrationId);
        if (!integration) return false;
        
        const webhookIndex = integration.config.webhooks?.findIndex(w => w.id === webhookId);
        if (webhookIndex === undefined || webhookIndex === -1) return false;
        
        // Delete from external service
        try {
            switch (integration.type) {
                case 'github':
                    await this.request(integrationId, `repos/${integration.config.organization}/${integration.config.project}/hooks/${webhookId}`, {
                        method: 'DELETE',
                    });
                    break;
                case 'gitlab':
                    await this.request(integrationId, `projects/${encodeURIComponent(`${integration.config.organization}/${integration.config.project}`)}/hooks/${webhookId}`, {
                        method: 'DELETE',
                    });
                    break;
            }
        } catch {
            // Continue with local deletion even if remote fails
        }
        
        integration.config.webhooks!.splice(webhookIndex, 1);
        integration.updatedAt = new Date();
        this.integrations.set(integrationId, integration);
        this.saveState();
        
        return true;
    }
    
    verifyWebhookSignature(
        integrationId: string,
        payload: string | Buffer,
        signature: string,
        webhookId?: string
    ): boolean {
        const integration = this.integrations.get(integrationId);
        if (!integration) return false;
        
        let secret: string | undefined;
        
        if (webhookId) {
            const webhook = integration.config.webhooks?.find(w => w.id === webhookId);
            secret = webhook?.secret;
        } else if (integration.auth.webhookSecret) {
            secret = integration.auth.webhookSecret;
        }
        
        if (!secret) return false;
        
        // Different services use different signature schemes
        switch (integration.type) {
            case 'github':
                const expectedSig = 'sha256=' + crypto
                    .createHmac('sha256', secret)
                    .update(payload)
                    .digest('hex');
                return crypto.timingSafeEqual(
                    Buffer.from(signature),
                    Buffer.from(expectedSig)
                );
                
            case 'gitlab':
                return signature === secret;
                
            case 'slack':
                // Slack uses a different format: v0=<signature>
                const [version, sig] = signature.split('=');
                if (version !== 'v0') return false;
                const slackSig = crypto
                    .createHmac('sha256', secret)
                    .update(payload)
                    .digest('hex');
                return crypto.timingSafeEqual(
                    Buffer.from(sig),
                    Buffer.from(slackSig)
                );
                
            default:
                const defaultSig = crypto
                    .createHmac('sha256', secret)
                    .update(payload)
                    .digest('hex');
                return signature === defaultSig || signature === `sha256=${defaultSig}`;
        }
    }
    
    recordWebhookEvent(event: Omit<WebhookEvent, 'id' | 'receivedAt'>): WebhookEvent {
        const webhookEvent: WebhookEvent = {
            ...event,
            id: this.generateId('whe'),
            receivedAt: new Date(),
        };
        
        this.webhookEvents.push(webhookEvent);
        
        // Trim old events
        if (this.webhookEvents.length > 1000) {
            this.webhookEvents = this.webhookEvents.slice(-1000);
        }
        
        this.emit('webhook.received', webhookEvent);
        
        // Periodically save
        if (this.webhookEvents.length % 100 === 0) {
            this.saveState();
        }
        
        return webhookEvent;
    }
    
    listWebhookEvents(filter?: {
        integrationId?: string;
        type?: string;
        since?: Date;
        limit?: number;
    }): WebhookEvent[] {
        let events = [...this.webhookEvents];
        
        if (filter?.integrationId) {
            events = events.filter(e => e.integrationId === filter.integrationId);
        }
        if (filter?.type) {
            events = events.filter(e => e.type === filter.type);
        }
        if (filter?.since) {
            events = events.filter(e => e.receivedAt >= filter.since!);
        }
        
        events.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
        
        if (filter?.limit) {
            events = events.slice(0, filter.limit);
        }
        
        return events;
    }
    
    // ============================================
    // Service-Specific Helpers
    // ============================================
    
    // GitHub
    async githubGetUser(integrationId: string): Promise<ApiResponse<{ login: string; name: string; email: string }>> {
        return this.request(integrationId, 'user');
    }
    
    async githubListRepos(integrationId: string, options?: { page?: number; per_page?: number }): Promise<ApiResponse<Array<{ id: number; name: string; full_name: string }>>> {
        return this.request(integrationId, 'user/repos', { query: options as Record<string, string> });
    }
    
    async githubCreateIssue(integrationId: string, owner: string, repo: string, issue: { title: string; body?: string; labels?: string[] }): Promise<ApiResponse<{ number: number; html_url: string }>> {
        return this.request(integrationId, `repos/${owner}/${repo}/issues`, {
            method: 'POST',
            body: issue,
        });
    }
    
    async githubCreatePR(integrationId: string, owner: string, repo: string, pr: { title: string; body?: string; head: string; base: string }): Promise<ApiResponse<{ number: number; html_url: string }>> {
        return this.request(integrationId, `repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            body: pr,
        });
    }
    
    // Slack
    async slackPostMessage(integrationId: string, channel: string, text: string, options?: { blocks?: unknown[]; thread_ts?: string }): Promise<ApiResponse<{ ok: boolean; ts: string }>> {
        return this.request(integrationId, 'chat.postMessage', {
            method: 'POST',
            body: {
                channel,
                text,
                ...options,
            },
        });
    }
    
    async slackListChannels(integrationId: string): Promise<ApiResponse<{ channels: Array<{ id: string; name: string }> }>> {
        return this.request(integrationId, 'conversations.list');
    }
    
    // Discord
    async discordSendMessage(integrationId: string, channelId: string, content: string, options?: { embeds?: unknown[] }): Promise<ApiResponse<{ id: string }>> {
        return this.request(integrationId, `channels/${channelId}/messages`, {
            method: 'POST',
            body: {
                content,
                ...options,
            },
        });
    }
    
    // Linear
    async linearCreateIssue(integrationId: string, issue: { title: string; description?: string; teamId: string; priority?: number }): Promise<ApiResponse<{ issueCreate: { issue: { id: string; url: string } } }>> {
        return this.request(integrationId, 'graphql', {
            method: 'POST',
            body: {
                query: `
                    mutation CreateIssue($title: String!, $description: String, $teamId: String!, $priority: Int) {
                        issueCreate(input: { title: $title, description: $description, teamId: $teamId, priority: $priority }) {
                            issue {
                                id
                                url
                            }
                        }
                    }
                `,
                variables: issue,
            },
        });
    }
    
    // ============================================
    // Connection Testing
    // ============================================
    
    async testConnection(id: string): Promise<{ success: boolean; message: string; details?: unknown }> {
        const integration = this.integrations.get(id);
        if (!integration) {
            return { success: false, message: 'Integration not found' };
        }
        
        try {
            let result: ApiResponse;
            
            switch (integration.type) {
                case 'github':
                    result = await this.request(id, 'user');
                    if (result.success) {
                        return { success: true, message: `Connected as ${(result.data as { login: string }).login}`, details: result.data };
                    }
                    break;
                    
                case 'gitlab':
                    result = await this.request(id, 'user');
                    if (result.success) {
                        return { success: true, message: `Connected as ${(result.data as { username: string }).username}`, details: result.data };
                    }
                    break;
                    
                case 'slack':
                    result = await this.request(id, 'auth.test');
                    if (result.success && (result.data as { ok: boolean }).ok) {
                        return { success: true, message: `Connected to ${(result.data as { team: string }).team}`, details: result.data };
                    }
                    break;
                    
                case 'discord':
                    result = await this.request(id, 'users/@me');
                    if (result.success) {
                        return { success: true, message: `Connected as ${(result.data as { username: string }).username}`, details: result.data };
                    }
                    break;
                    
                case 'linear':
                    result = await this.request(id, 'graphql', {
                        method: 'POST',
                        body: { query: '{ viewer { id name } }' },
                    });
                    if (result.success) {
                        const viewer = ((result.data as { data: { viewer: { name: string } } }).data?.viewer);
                        return { success: true, message: `Connected as ${viewer?.name}`, details: result.data };
                    }
                    break;
                    
                default:
                    // For custom integrations, just try a HEAD request
                    result = await this.request(id, '', { method: 'GET' });
                    if (result.success || result.statusCode === 200 || result.statusCode === 401) {
                        return { success: true, message: 'Connection established' };
                    }
            }
            
            return { success: false, message: result?.error || 'Connection test failed' };
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
        }
    }
    
    // ============================================
    // Utility Methods
    // ============================================
    
    private generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    disconnect(id: string): Integration | null {
        const integration = this.integrations.get(id);
        if (!integration) return null;
        
        // Clear tokens
        if (integration.auth.oauth) {
            integration.auth.oauth.accessToken = undefined;
            integration.auth.oauth.refreshToken = undefined;
            integration.auth.oauth.expiresAt = undefined;
        }
        integration.auth.apiKey = undefined;
        integration.auth.personalToken = undefined;
        
        integration.status = 'disconnected';
        integration.updatedAt = new Date();
        
        this.integrations.set(id, integration);
        this.saveState();
        this.emit('integration.disconnected', integration);
        
        return integration;
    }
    
    getStats(): {
        total: number;
        connected: number;
        disconnected: number;
        byType: Record<IntegrationType, number>;
        totalRequests: number;
        totalErrors: number;
    } {
        const integrations = Array.from(this.integrations.values());
        
        const byType: Record<IntegrationType, number> = {
            github: 0,
            gitlab: 0,
            bitbucket: 0,
            jira: 0,
            linear: 0,
            slack: 0,
            discord: 0,
            teams: 0,
            notion: 0,
            confluence: 0,
            custom: 0,
        };
        
        let totalRequests = 0;
        let totalErrors = 0;
        
        for (const integration of integrations) {
            byType[integration.type]++;
            totalRequests += integration.usage.requestCount;
            totalErrors += integration.usage.errorCount;
        }
        
        return {
            total: integrations.length,
            connected: integrations.filter(i => i.status === 'connected').length,
            disconnected: integrations.filter(i => i.status === 'disconnected').length,
            byType,
            totalRequests,
            totalErrors,
        };
    }
    
    async shutdown(): Promise<void> {
        this.saveState();
        this.emit('shutdown');
    }
}

// ============================================
// Singleton Export
// ============================================

let integrationServiceInstance: IntegrationService | null = null;

export function getIntegrationService(): IntegrationService {
    if (!integrationServiceInstance) {
        integrationServiceInstance = IntegrationService.getInstance();
    }
    return integrationServiceInstance;
}

export default IntegrationService;
