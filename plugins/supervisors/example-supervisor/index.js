/**
 * Example Supervisor Plugin
 * 
 * This demonstrates how to create a custom supervisor plugin for AIOS.
 * Plugins must export a factory function that returns a SupervisorPluginInstance.
 */

export default function createSupervisor(config) {
  return {
    name: 'example-supervisor',
    provider: 'custom',
    
    async chat(messages) {
      const lastMessage = messages[messages.length - 1];
      return `[Example Supervisor] Received: ${lastMessage?.content?.slice(0, 100)}...`;
    },
    
    async isAvailable() {
      return true;
    },
    
    getSpecialties() {
      return ['code-quality', 'general'];
    },
    
    async dispose() {
      console.log('Example supervisor disposed');
    }
  };
}

export const manifest = {
  name: 'example-supervisor',
  version: '1.0.0',
  specialties: ['code-quality', 'general']
};
