import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SupervisorPluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  specialties?: string[];
  provider?: string;
  model?: string;
  config?: Record<string, unknown>;
}

export interface SupervisorPluginInstance {
  name: string;
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  isAvailable(): Promise<boolean>;
  getSpecialties?(): string[];
  dispose?(): Promise<void>;
}

export interface LoadedPlugin {
  id: string;
  manifest: SupervisorPluginManifest;
  instance: SupervisorPluginInstance;
  path: string;
  loadedAt: Date;
  status: 'active' | 'error' | 'disabled';
  error?: string;
}

export interface PluginLoadResult {
  success: boolean;
  pluginId?: string;
  error?: string;
}

export interface PluginManagerConfig {
  pluginsDir?: string;
  autoLoad?: boolean;
  allowRemotePlugins?: boolean;
  trustedSources?: string[];
}

type PluginFactory = (config?: Record<string, unknown>) => SupervisorPluginInstance | Promise<SupervisorPluginInstance>;

export class SupervisorPluginManager extends EventEmitter {
  private static instance: SupervisorPluginManager | null = null;
  private plugins: Map<string, LoadedPlugin> = new Map();
  private config: Required<PluginManagerConfig>;

  private constructor(config: PluginManagerConfig = {}) {
    super();
    this.config = {
      pluginsDir: config.pluginsDir ?? './plugins/supervisors',
      autoLoad: config.autoLoad ?? false,
      allowRemotePlugins: config.allowRemotePlugins ?? false,
      trustedSources: config.trustedSources ?? [],
    };
  }

  static getInstance(config?: PluginManagerConfig): SupervisorPluginManager {
    if (!SupervisorPluginManager.instance) {
      SupervisorPluginManager.instance = new SupervisorPluginManager(config);
    }
    return SupervisorPluginManager.instance;
  }

  static resetInstance(): void {
    SupervisorPluginManager.instance = null;
  }

  async loadFromDirectory(directory?: string): Promise<PluginLoadResult[]> {
    const pluginsDir = directory ?? this.config.pluginsDir;
    const results: PluginLoadResult[] = [];

    if (!fs.existsSync(pluginsDir)) {
      return results;
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const pluginPath = path.join(pluginsDir, entry.name);
      const result = await this.loadPlugin(pluginPath);
      results.push(result);
    }

    this.emit('directoryLoaded', { directory: pluginsDir, results });
    return results;
  }

  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      
      if (!fs.existsSync(manifestPath)) {
        return { success: false, error: `No manifest.json found at ${pluginPath}` };
      }

      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: SupervisorPluginManifest = JSON.parse(manifestContent);

      if (!manifest.name || !manifest.version || !manifest.main) {
        return { success: false, error: 'Invalid manifest: name, version, and main are required' };
      }

      const mainPath = path.join(pluginPath, manifest.main);
      if (!fs.existsSync(mainPath)) {
        return { success: false, error: `Main file not found: ${manifest.main}` };
      }

      const pluginModule = await import(mainPath);
      const factory: PluginFactory = pluginModule.default || pluginModule.createSupervisor;

      if (typeof factory !== 'function') {
        return { success: false, error: 'Plugin must export a default function or createSupervisor' };
      }

      const instance = await factory(manifest.config);
      
      if (!instance.name || typeof instance.chat !== 'function') {
        return { success: false, error: 'Plugin instance must have name and chat method' };
      }

      const pluginId = `${manifest.name}@${manifest.version}`;
      
      const loadedPlugin: LoadedPlugin = {
        id: pluginId,
        manifest,
        instance,
        path: pluginPath,
        loadedAt: new Date(),
        status: 'active',
      };

      this.plugins.set(pluginId, loadedPlugin);
      this.emit('pluginLoaded', { plugin: loadedPlugin });

      return { success: true, pluginId };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.emit('pluginError', { path: pluginPath, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async loadFromNpm(packageName: string): Promise<PluginLoadResult> {
    if (!this.config.allowRemotePlugins) {
      return { success: false, error: 'Remote plugins are disabled' };
    }

    if (this.config.trustedSources.length > 0) {
      const isTrusted = this.config.trustedSources.some(source => 
        packageName.startsWith(source) || packageName === source
      );
      if (!isTrusted) {
        return { success: false, error: `Package ${packageName} is not from a trusted source` };
      }
    }

    try {
      const pluginModule = await import(packageName);
      const manifest: SupervisorPluginManifest = pluginModule.manifest || {
        name: packageName,
        version: '1.0.0',
        main: 'index.js',
      };

      const factory: PluginFactory = pluginModule.default || pluginModule.createSupervisor;

      if (typeof factory !== 'function') {
        return { success: false, error: 'NPM plugin must export a default function or createSupervisor' };
      }

      const instance = await factory(manifest.config);
      const pluginId = `npm:${packageName}@${manifest.version}`;

      const loadedPlugin: LoadedPlugin = {
        id: pluginId,
        manifest,
        instance,
        path: `npm:${packageName}`,
        loadedAt: new Date(),
        status: 'active',
      };

      this.plugins.set(pluginId, loadedPlugin);
      this.emit('pluginLoaded', { plugin: loadedPlugin });

      return { success: true, pluginId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  registerInlinePlugin(
    name: string,
    chatFn: (messages: Array<{ role: string; content: string }>) => Promise<string>,
    options?: { specialties?: string[]; provider?: string }
  ): string {
    const pluginId = `inline:${name}-${crypto.randomBytes(4).toString('hex')}`;

    const instance: SupervisorPluginInstance = {
      name,
      chat: chatFn,
      isAvailable: async () => true,
      getSpecialties: () => options?.specialties || [],
    };

    const manifest: SupervisorPluginManifest = {
      name,
      version: '1.0.0',
      main: 'inline',
      specialties: options?.specialties,
      provider: options?.provider || 'custom',
    };

    const loadedPlugin: LoadedPlugin = {
      id: pluginId,
      manifest,
      instance,
      path: 'inline',
      loadedAt: new Date(),
      status: 'active',
    };

    this.plugins.set(pluginId, loadedPlugin);
    this.emit('pluginLoaded', { plugin: loadedPlugin });

    return pluginId;
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      if (plugin.instance.dispose) {
        await plugin.instance.dispose();
      }
      this.plugins.delete(pluginId);
      this.emit('pluginUnloaded', { pluginId });
      return true;
    } catch (error) {
      this.emit('pluginError', { pluginId, error: (error as Error).message });
      return false;
    }
  }

  disablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    
    plugin.status = 'disabled';
    this.emit('pluginDisabled', { pluginId });
    return true;
  }

  enablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    
    plugin.status = 'active';
    this.emit('pluginEnabled', { pluginId });
    return true;
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginInstance(pluginId: string): SupervisorPluginInstance | undefined {
    return this.plugins.get(pluginId)?.instance;
  }

  listPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getActivePlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.status === 'active');
  }

  getPluginsBySpecialty(specialty: string): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => 
      p.status === 'active' && p.manifest.specialties?.includes(specialty)
    );
  }

  async checkPluginHealth(pluginId: string): Promise<{ available: boolean; error?: string }> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { available: false, error: 'Plugin not found' };
    }

    try {
      const available = await plugin.instance.isAvailable();
      return { available };
    } catch (error) {
      return { available: false, error: (error as Error).message };
    }
  }

  async checkAllHealth(): Promise<Map<string, { available: boolean; error?: string }>> {
    const results = new Map<string, { available: boolean; error?: string }>();
    
    for (const [id] of this.plugins) {
      results.set(id, await this.checkPluginHealth(id));
    }
    
    return results;
  }

  getStats(): { total: number; active: number; disabled: number; error: number } {
    const plugins = Array.from(this.plugins.values());
    return {
      total: plugins.length,
      active: plugins.filter(p => p.status === 'active').length,
      disabled: plugins.filter(p => p.status === 'disabled').length,
      error: plugins.filter(p => p.status === 'error').length,
    };
  }

  async disposeAll(): Promise<void> {
    for (const [id] of this.plugins) {
      await this.unloadPlugin(id);
    }
  }
}
