import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { SupervisorPluginManager } from '../managers/SupervisorPluginManager.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SupervisorPluginManager', () => {
  let manager: SupervisorPluginManager;
  let testPluginDir: string;

  beforeEach(() => {
    testPluginDir = path.join(os.tmpdir(), `supervisor-plugins-test-${Date.now()}`);
    fs.mkdirSync(testPluginDir, { recursive: true });
    
    SupervisorPluginManager.resetInstance();
    manager = SupervisorPluginManager.getInstance({
      pluginsDir: testPluginDir,
      autoLoad: false,
    });
  });

  afterEach(async () => {
    await manager.disposeAll();
    fs.rmSync(testPluginDir, { recursive: true, force: true });
  });

  describe('Inline Plugin Registration', () => {
    test('should register inline plugin', async () => {
      const pluginId = manager.registerInlinePlugin('Test Plugin', async (messages) => 'Test response');
      
      const registered = manager.getPlugin(pluginId);
      expect(registered).toBeDefined();
      expect(registered?.manifest.name).toBe('Test Plugin');
    });

    test('should allow multiple inline plugins', async () => {
      manager.registerInlinePlugin('Plugin 1', async () => '1');
      manager.registerInlinePlugin('Plugin 2', async () => '2');
      
      const plugins = manager.listPlugins();
      expect(plugins.length).toBe(2);
    });
  });

  describe('Plugin Discovery and Stats', () => {
    test('should list all registered plugins', async () => {
      manager.registerInlinePlugin('List Test 1', async () => '1');
      manager.registerInlinePlugin('List Test 2', async () => '2', { specialties: ['testing'] });

      const plugins = manager.listPlugins();
      expect(plugins.length).toBe(2);
    });

    test('should filter plugins by specialty', async () => {
      manager.registerInlinePlugin('Security Plugin', async () => '1', { specialties: ['security'] });
      manager.registerInlinePlugin('Code Plugin', async () => '2', { specialties: ['code-review'] });

      const securityPlugins = manager.getPluginsBySpecialty('security');
      expect(securityPlugins.length).toBe(1);
      expect(securityPlugins[0].manifest.name).toBe('Security Plugin');
    });

    test('should get manager stats', async () => {
      manager.registerInlinePlugin('Meta Plugin', async () => '1');
      const stats = manager.getStats();
      
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });
  });

  describe('Plugin Lifecycle', () => {
    test('should disable and enable plugin', async () => {
      const pluginId = manager.registerInlinePlugin('Status Test', async () => '1');
      
      manager.disablePlugin(pluginId);
      expect(manager.getPlugin(pluginId)?.status).toBe('disabled');
      expect(manager.getActivePlugins().length).toBe(0);

      manager.enablePlugin(pluginId);
      expect(manager.getPlugin(pluginId)?.status).toBe('active');
      expect(manager.getActivePlugins().length).toBe(1);
    });

    test('should unload plugin', async () => {
      const pluginId = manager.registerInlinePlugin('Unload Test', async () => '1');
      const success = await manager.unloadPlugin(pluginId);
      
      expect(success).toBe(true);
      expect(manager.getPlugin(pluginId)).toBeUndefined();
    });
  });

  describe('Plugin Evaluation', () => {
    test('should call chat method of plugin instance', async () => {
      const mockChat = mock(async () => 'Mocked response');
      const pluginId = manager.registerInlinePlugin('Chat Test', mockChat);
      
      const instance = manager.getPluginInstance(pluginId);
      const response = await instance?.chat([{ role: 'user', content: 'test' }]);
      
      expect(response).toBe('Mocked response');
      expect(mockChat).toHaveBeenCalled();
    });

    test('should check plugin health', async () => {
      const pluginId = manager.registerInlinePlugin('Health Test', async () => '1');
      const health = await manager.checkPluginHealth(pluginId);
      
      expect(health.available).toBe(true);
    });
  });
});
