/**
 * AIOS Unified Profile Manager
 * 
 * Manages user profiles, API profiles, and CLI proxy variants in a unified way.
 * Consolidates functionality from superai-cli's profile-registry, profile-reader,
 * and profile-writer into a single cohesive manager.
 * 
 * Features:
 * - Account profiles (Claude CLI accounts)
 * - API profiles (OpenRouter, custom API keys)
 * - CLI proxy variants (Gemini, Codex, etc.)
 * - Unified config file support (YAML)
 * - Legacy config file support (JSON)
 * - Model tier mapping per profile
 * - Active profile tracking
 * 
 * @module managers/UnifiedProfileManager
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';

// ============================================
// Types & Interfaces
// ============================================

export interface AccountProfile {
    type: 'account';
    created: string;
    lastUsed: string | null;
    email?: string;
    displayName?: string;
}

export interface ApiProfile {
    type: 'api';
    provider: string;
    settings?: string;
    modelMapping?: ModelMapping;
    apiKeyConfigured: boolean;
    created: string;
    lastUsed: string | null;
}

export interface CliProxyVariant {
    type: 'cliproxy';
    provider: string;
    settings?: string;
    port?: number;
    created: string;
}

export interface ModelMapping {
    default: string;
    opus: string;
    sonnet: string;
    haiku: string;
}

export type ProfileEntry = AccountProfile | ApiProfile | CliProxyVariant;

export interface UnifiedConfig {
    version: string;
    default?: string;
    accounts: Record<string, {
        created: string;
        last_used: string | null;
    }>;
    profiles: Record<string, {
        type?: string;
        settings?: string;
        provider?: string;
        models?: ModelMapping;
    }>;
    cliproxy?: {
        enabled?: boolean;
        port?: number;
        variants?: Record<string, {
            provider: string;
            settings?: string;
        }>;
    };
}

export interface LegacyConfig {
    profiles: Record<string, string>;
    cliproxy?: Record<string, {
        provider: string;
        settings: string;
    }>;
}

export interface ProfileListItem {
    name: string;
    type: 'account' | 'api' | 'cliproxy';
    provider?: string;
    isDefault: boolean;
    isConfigured: boolean;
    lastUsed: string | null;
}

// ============================================
// Unified Profile Manager Class
// ============================================

export class UnifiedProfileManager extends EventEmitter {
    private configDir: string;
    private unifiedConfigPath: string;
    private legacyConfigPath: string;
    private legacyProfilesPath: string;
    private useUnifiedConfig: boolean = false;

    // Default model mappings per provider
    private providerModelMappings: Record<string, ModelMapping> = {
        anthropic: {
            default: 'claude-sonnet-4-20250514',
            opus: 'claude-opus-4-20250514',
            sonnet: 'claude-sonnet-4-20250514',
            haiku: 'claude-3-5-haiku-20241022',
        },
        openai: {
            default: 'gpt-4o',
            opus: 'gpt-4o',
            sonnet: 'gpt-4o-mini',
            haiku: 'gpt-4o-mini',
        },
        openrouter: {
            default: 'anthropic/claude-sonnet-4-20250514',
            opus: 'anthropic/claude-opus-4-20250514',
            sonnet: 'anthropic/claude-sonnet-4-20250514',
            haiku: 'anthropic/claude-3-5-haiku',
        },
        gemini: {
            default: 'gemini-2.0-flash',
            opus: 'gemini-2.5-pro',
            sonnet: 'gemini-2.0-flash',
            haiku: 'gemini-2.0-flash-lite',
        },
        qwen: {
            default: 'qwen-plus',
            opus: 'qwen-max',
            sonnet: 'qwen-plus',
            haiku: 'qwen-turbo',
        },
        deepseek: {
            default: 'deepseek-chat',
            opus: 'deepseek-reasoner',
            sonnet: 'deepseek-chat',
            haiku: 'deepseek-coder',
        },
    };

    constructor(configDir?: string) {
        super();
        
        this.configDir = configDir || path.join(os.homedir(), '.ccs');
        this.unifiedConfigPath = path.join(this.configDir, 'config.yaml');
        this.legacyConfigPath = path.join(this.configDir, 'config.json');
        this.legacyProfilesPath = path.join(this.configDir, 'profiles.json');
        
        // Ensure config directory exists
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
        }
        
        // Detect config mode
        this.useUnifiedConfig = fs.existsSync(this.unifiedConfigPath);
    }

    // ============================================
    // Config Mode Detection
    // ============================================

    /**
     * Check if using unified YAML config
     */
    isUnifiedMode(): boolean {
        return this.useUnifiedConfig;
    }

    /**
     * Migrate from legacy to unified config
     */
    async migrateToUnified(): Promise<void> {
        if (this.useUnifiedConfig) {
            return; // Already unified
        }

        const legacyConfig = this.loadLegacyConfig();
        const legacyProfiles = this.loadLegacyProfiles();

        const unified: UnifiedConfig = {
            version: '1.0.0',
            accounts: {},
            profiles: {},
        };

        // Migrate account profiles
        for (const [name, meta] of Object.entries(legacyProfiles.profiles || {})) {
            unified.accounts[name] = {
                created: meta.created || new Date().toISOString(),
                last_used: meta.last_used || null,
            };
        }

        // Migrate API profiles
        for (const [name, settingsPath] of Object.entries(legacyConfig.profiles || {})) {
            unified.profiles[name] = {
                type: 'api',
                settings: settingsPath as string,
            };
        }

        // Migrate cliproxy variants
        if (legacyConfig.cliproxy) {
            unified.cliproxy = {
                enabled: true,
                variants: {},
            };
            for (const [name, variant] of Object.entries(legacyConfig.cliproxy)) {
                unified.cliproxy.variants![name] = {
                    provider: variant.provider,
                    settings: variant.settings,
                };
            }
        }

        // Set default
        unified.default = legacyProfiles.default || undefined;

        // Save unified config
        this.saveUnifiedConfig(unified);
        this.useUnifiedConfig = true;

        this.emit('migrated', { from: 'legacy', to: 'unified' });
    }

    // ============================================
    // Account Profile Management
    // ============================================

    /**
     * Create a new account profile
     */
    createAccount(name: string, metadata?: { email?: string; displayName?: string }): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (config.accounts[name]) {
                throw new Error(`Account already exists: ${name}`);
            }
            config.accounts[name] = {
                created: new Date().toISOString(),
                last_used: null,
            };
            this.saveUnifiedConfig(config);
        } else {
            const profiles = this.loadLegacyProfiles();
            if (profiles.profiles[name]) {
                throw new Error(`Account already exists: ${name}`);
            }
            profiles.profiles[name] = {
                type: 'account',
                created: new Date().toISOString(),
                last_used: null,
            };
            this.saveLegacyProfiles(profiles);
        }

        this.emit('account:created', { name, ...metadata });
    }

    /**
     * Delete an account profile
     */
    deleteAccount(name: string): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (!config.accounts[name]) {
                throw new Error(`Account not found: ${name}`);
            }
            delete config.accounts[name];
            if (config.default === name) {
                config.default = undefined;
            }
            this.saveUnifiedConfig(config);
        } else {
            const profiles = this.loadLegacyProfiles();
            if (!profiles.profiles[name]) {
                throw new Error(`Account not found: ${name}`);
            }
            delete profiles.profiles[name];
            if (profiles.default === name) {
                profiles.default = null;
            }
            this.saveLegacyProfiles(profiles);
        }

        this.emit('account:deleted', { name });
    }

    /**
     * Get all account profiles
     */
    getAccounts(): Record<string, AccountProfile> {
        const accounts: Record<string, AccountProfile> = {};

        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            for (const [name, data] of Object.entries(config.accounts)) {
                accounts[name] = {
                    type: 'account',
                    created: data.created,
                    lastUsed: data.last_used,
                };
            }
        } else {
            const profiles = this.loadLegacyProfiles();
            for (const [name, data] of Object.entries(profiles.profiles || {})) {
                if (data.type === 'account' || !data.type) {
                    accounts[name] = {
                        type: 'account',
                        created: data.created,
                        lastUsed: data.last_used,
                    };
                }
            }
        }

        return accounts;
    }

    // ============================================
    // API Profile Management
    // ============================================

    /**
     * Create a new API profile
     */
    createApiProfile(name: string, params: {
        provider: string;
        settings?: string;
        models?: ModelMapping;
    }): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (config.profiles[name]) {
                throw new Error(`API profile already exists: ${name}`);
            }
            config.profiles[name] = {
                type: 'api',
                provider: params.provider,
                settings: params.settings,
                models: params.models || this.providerModelMappings[params.provider],
            };
            this.saveUnifiedConfig(config);
        } else {
            const config = this.loadLegacyConfig();
            if (config.profiles[name]) {
                throw new Error(`API profile already exists: ${name}`);
            }
            const settingsPath = params.settings || path.join(this.configDir, `${name}.settings.json`);
            config.profiles[name] = settingsPath;
            this.saveLegacyConfig(config);
        }

        this.emit('api:created', { name, ...params });
    }

    /**
     * Delete an API profile
     */
    deleteApiProfile(name: string): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (!config.profiles[name]) {
                throw new Error(`API profile not found: ${name}`);
            }
            delete config.profiles[name];
            if (config.default === name) {
                config.default = undefined;
            }
            this.saveUnifiedConfig(config);
        } else {
            const config = this.loadLegacyConfig();
            if (!config.profiles[name]) {
                throw new Error(`API profile not found: ${name}`);
            }
            delete config.profiles[name];
            this.saveLegacyConfig(config);
        }

        this.emit('api:deleted', { name });
    }

    /**
     * Get all API profiles
     */
    getApiProfiles(): Record<string, ApiProfile> {
        const profiles: Record<string, ApiProfile> = {};

        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            for (const [name, data] of Object.entries(config.profiles)) {
                profiles[name] = {
                    type: 'api',
                    provider: data.provider || 'unknown',
                    settings: data.settings,
                    modelMapping: data.models,
                    apiKeyConfigured: this.isApiKeyConfigured(name),
                    created: new Date().toISOString(),
                    lastUsed: null,
                };
            }
        } else {
            const config = this.loadLegacyConfig();
            for (const [name, settingsPath] of Object.entries(config.profiles || {})) {
                profiles[name] = {
                    type: 'api',
                    provider: 'unknown',
                    settings: settingsPath as string,
                    apiKeyConfigured: this.isApiKeyConfigured(name),
                    created: new Date().toISOString(),
                    lastUsed: null,
                };
            }
        }

        return profiles;
    }

    /**
     * Check if API key is configured for a profile
     */
    private isApiKeyConfigured(name: string): boolean {
        try {
            const settingsPath = path.join(this.configDir, `${name}.settings.json`);
            if (!fs.existsSync(settingsPath)) return false;

            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            const token = settings?.env?.ANTHROPIC_AUTH_TOKEN || 
                          settings?.env?.OPENAI_API_KEY || 
                          settings?.env?.API_KEY || '';
            return token.length > 0 && !token.includes('YOUR_') && !token.includes('your-');
        } catch {
            return false;
        }
    }

    // ============================================
    // CLI Proxy Variant Management
    // ============================================

    /**
     * Create a CLI proxy variant
     */
    createCliProxyVariant(name: string, params: {
        provider: string;
        settings?: string;
        port?: number;
    }): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (!config.cliproxy) {
                config.cliproxy = { enabled: true, variants: {} };
            }
            if (!config.cliproxy.variants) {
                config.cliproxy.variants = {};
            }
            if (config.cliproxy.variants[name]) {
                throw new Error(`CLI proxy variant already exists: ${name}`);
            }
            config.cliproxy.variants[name] = {
                provider: params.provider,
                settings: params.settings,
            };
            this.saveUnifiedConfig(config);
        } else {
            const config = this.loadLegacyConfig();
            if (!config.cliproxy) {
                config.cliproxy = {};
            }
            if (config.cliproxy[name]) {
                throw new Error(`CLI proxy variant already exists: ${name}`);
            }
            config.cliproxy[name] = {
                provider: params.provider,
                settings: params.settings || '',
            };
            this.saveLegacyConfig(config);
        }

        this.emit('cliproxy:created', { name, ...params });
    }

    /**
     * Delete a CLI proxy variant
     */
    deleteCliProxyVariant(name: string): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (!config.cliproxy?.variants?.[name]) {
                throw new Error(`CLI proxy variant not found: ${name}`);
            }
            delete config.cliproxy.variants[name];
            if (config.default === name) {
                config.default = undefined;
            }
            this.saveUnifiedConfig(config);
        } else {
            const config = this.loadLegacyConfig();
            if (!config.cliproxy?.[name]) {
                throw new Error(`CLI proxy variant not found: ${name}`);
            }
            delete config.cliproxy[name];
            this.saveLegacyConfig(config);
        }

        this.emit('cliproxy:deleted', { name });
    }

    /**
     * Get all CLI proxy variants
     */
    getCliProxyVariants(): Record<string, CliProxyVariant> {
        const variants: Record<string, CliProxyVariant> = {};

        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            for (const [name, data] of Object.entries(config.cliproxy?.variants || {})) {
                variants[name] = {
                    type: 'cliproxy',
                    provider: data.provider,
                    settings: data.settings,
                    created: new Date().toISOString(),
                };
            }
        } else {
            const config = this.loadLegacyConfig();
            for (const [name, data] of Object.entries(config.cliproxy || {})) {
                variants[name] = {
                    type: 'cliproxy',
                    provider: data.provider,
                    settings: data.settings,
                    created: new Date().toISOString(),
                };
            }
        }

        return variants;
    }

    // ============================================
    // Default Profile Management
    // ============================================

    /**
     * Set the default profile
     */
    setDefault(name: string): void {
        // Verify profile exists
        const accounts = this.getAccounts();
        const apiProfiles = this.getApiProfiles();
        const variants = this.getCliProxyVariants();

        if (!accounts[name] && !apiProfiles[name] && !variants[name]) {
            throw new Error(`Profile not found: ${name}`);
        }

        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            config.default = name;
            this.saveUnifiedConfig(config);
        } else {
            const profiles = this.loadLegacyProfiles();
            profiles.default = name;
            this.saveLegacyProfiles(profiles);
        }

        this.emit('default:changed', { name });
    }

    /**
     * Clear the default profile
     */
    clearDefault(): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            config.default = undefined;
            this.saveUnifiedConfig(config);
        } else {
            const profiles = this.loadLegacyProfiles();
            profiles.default = null;
            this.saveLegacyProfiles(profiles);
        }

        this.emit('default:cleared');
    }

    /**
     * Get the default profile name
     */
    getDefault(): string | null {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            return config.default || null;
        } else {
            const profiles = this.loadLegacyProfiles();
            return profiles.default;
        }
    }

    // ============================================
    // Unified Listing
    // ============================================

    /**
     * List all profiles (accounts, API, cliproxy)
     */
    listAllProfiles(): ProfileListItem[] {
        const items: ProfileListItem[] = [];
        const defaultProfile = this.getDefault();

        // Accounts
        const accounts = this.getAccounts();
        for (const [name, data] of Object.entries(accounts)) {
            items.push({
                name,
                type: 'account',
                isDefault: name === defaultProfile,
                isConfigured: true,
                lastUsed: data.lastUsed,
            });
        }

        // API Profiles
        const apiProfiles = this.getApiProfiles();
        for (const [name, data] of Object.entries(apiProfiles)) {
            items.push({
                name,
                type: 'api',
                provider: data.provider,
                isDefault: name === defaultProfile,
                isConfigured: data.apiKeyConfigured,
                lastUsed: data.lastUsed,
            });
        }

        // CLI Proxy Variants
        const variants = this.getCliProxyVariants();
        for (const [name, data] of Object.entries(variants)) {
            items.push({
                name,
                type: 'cliproxy',
                provider: data.provider,
                isDefault: name === defaultProfile,
                isConfigured: true,
                lastUsed: null,
            });
        }

        return items;
    }

    /**
     * Get profile by name (any type)
     */
    getProfile(name: string): ProfileEntry | null {
        const accounts = this.getAccounts();
        if (accounts[name]) return accounts[name];

        const apiProfiles = this.getApiProfiles();
        if (apiProfiles[name]) return apiProfiles[name];

        const variants = this.getCliProxyVariants();
        if (variants[name]) return variants[name];

        return null;
    }

    /**
     * Touch profile (update lastUsed)
     */
    touchProfile(name: string): void {
        if (this.useUnifiedConfig) {
            const config = this.loadUnifiedConfig();
            if (config.accounts[name]) {
                config.accounts[name].last_used = new Date().toISOString();
                this.saveUnifiedConfig(config);
            }
        } else {
            const profiles = this.loadLegacyProfiles();
            if (profiles.profiles[name]) {
                profiles.profiles[name].last_used = new Date().toISOString();
                this.saveLegacyProfiles(profiles);
            }
        }

        this.emit('profile:touched', { name });
    }

    // ============================================
    // Model Mapping
    // ============================================

    /**
     * Get model mapping for a provider
     */
    getModelMapping(provider: string): ModelMapping {
        return this.providerModelMappings[provider] || this.providerModelMappings.anthropic;
    }

    /**
     * Set custom model mapping for a profile
     */
    setProfileModelMapping(name: string, mapping: ModelMapping): void {
        if (!this.useUnifiedConfig) {
            throw new Error('Model mapping only supported in unified config mode');
        }

        const config = this.loadUnifiedConfig();
        if (!config.profiles[name]) {
            throw new Error(`API profile not found: ${name}`);
        }

        config.profiles[name].models = mapping;
        this.saveUnifiedConfig(config);

        this.emit('profile:modelMapping', { name, mapping });
    }

    // ============================================
    // Config File Operations
    // ============================================

    private loadUnifiedConfig(): UnifiedConfig {
        if (!fs.existsSync(this.unifiedConfigPath)) {
            return {
                version: '1.0.0',
                accounts: {},
                profiles: {},
            };
        }

        try {
            const content = fs.readFileSync(this.unifiedConfigPath, 'utf8');
            return yaml.parse(content) as UnifiedConfig;
        } catch (error) {
            throw new Error(`Failed to load unified config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private saveUnifiedConfig(config: UnifiedConfig): void {
        const content = yaml.stringify(config, { indent: 2 });
        const tempPath = `${this.unifiedConfigPath}.tmp`;

        try {
            fs.writeFileSync(tempPath, content, { mode: 0o600 });
            fs.renameSync(tempPath, this.unifiedConfigPath);
        } catch (error) {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            throw new Error(`Failed to save unified config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private loadLegacyConfig(): LegacyConfig {
        if (!fs.existsSync(this.legacyConfigPath)) {
            return { profiles: {} };
        }

        try {
            const content = fs.readFileSync(this.legacyConfigPath, 'utf8');
            return JSON.parse(content) as LegacyConfig;
        } catch (error) {
            throw new Error(`Failed to load legacy config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private saveLegacyConfig(config: LegacyConfig): void {
        const content = JSON.stringify(config, null, 2);
        fs.writeFileSync(this.legacyConfigPath, content, { mode: 0o600 });
    }

    private loadLegacyProfiles(): { 
        version: string; 
        profiles: Record<string, { type: string; created: string; last_used: string | null }>; 
        default: string | null 
    } {
        if (!fs.existsSync(this.legacyProfilesPath)) {
            return { version: '2.0.0', profiles: {}, default: null };
        }

        try {
            const content = fs.readFileSync(this.legacyProfilesPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load legacy profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private saveLegacyProfiles(profiles: { 
        version: string; 
        profiles: Record<string, { type: string; created: string; last_used: string | null }>; 
        default: string | null 
    }): void {
        const content = JSON.stringify(profiles, null, 2);
        fs.writeFileSync(this.legacyProfilesPath, content, { mode: 0o600 });
    }

    // ============================================
    // Stats
    // ============================================

    /**
     * Get profile statistics
     */
    getStats(): {
        totalProfiles: number;
        accounts: number;
        apiProfiles: number;
        cliproxyVariants: number;
        configMode: 'unified' | 'legacy';
        defaultProfile: string | null;
    } {
        const accounts = Object.keys(this.getAccounts()).length;
        const apiProfiles = Object.keys(this.getApiProfiles()).length;
        const cliproxyVariants = Object.keys(this.getCliProxyVariants()).length;

        return {
            totalProfiles: accounts + apiProfiles + cliproxyVariants,
            accounts,
            apiProfiles,
            cliproxyVariants,
            configMode: this.useUnifiedConfig ? 'unified' : 'legacy',
            defaultProfile: this.getDefault(),
        };
    }
}

// Singleton instance
let managerInstance: UnifiedProfileManager | null = null;

export function getUnifiedProfileManager(configDir?: string): UnifiedProfileManager {
    if (!managerInstance) {
        managerInstance = new UnifiedProfileManager(configDir);
    }
    return managerInstance;
}
