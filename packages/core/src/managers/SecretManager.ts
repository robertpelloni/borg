import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface Secret {
  key: string;
  value: string; // Stored in memory, masked in API responses
  lastModified: number;
}

export class SecretManager extends EventEmitter {
  private secretsFile: string;
  private secrets: Map<string, Secret> = new Map();

  constructor(workspaceRoot: string) {
    super();
    this.secretsFile = path.join(workspaceRoot, '.secrets.json');
    this.loadSecrets();
  }

  private loadSecrets() {
    if (fs.existsSync(this.secretsFile)) {
      try {
        const data = fs.readFileSync(this.secretsFile, 'utf-8');
        const json = JSON.parse(data);
        if (Array.isArray(json)) {
          this.secrets = new Map(json.map((s: Secret) => [s.key, s]));
        }
      } catch (error) {
        console.error("Failed to load secrets:", error);
      }
    }
  }

  private saveSecrets() {
    try {
      const data = JSON.stringify(Array.from(this.secrets.values()), null, 2);
      fs.writeFileSync(this.secretsFile, data, 'utf-8');
      this.emit('change', this.getAllSecrets());
    } catch (error) {
      console.error("Failed to save secrets:", error);
    }
  }

  public setSecret(key: string, value: string) {
    this.secrets.set(key, {
      key,
      value,
      lastModified: Date.now()
    });
    this.saveSecrets();
  }

  public getSecret(key: string): string | undefined {
    return this.secrets.get(key)?.value;
  }

  public deleteSecret(key: string) {
    if (this.secrets.delete(key)) {
      this.saveSecrets();
    }
  }

  public getAllSecrets() {
    return Array.from(this.secrets.values()).map(s => ({
      key: s.key,
      value: '********', // Masked
      lastModified: s.lastModified
    }));
  }

  public getEnvVars(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, secret] of this.secrets) {
      env[key] = secret.value;
    }
    return env;
  }

  public rotateSecret(key: string, newValue: string): { success: boolean; previousValue?: string } {
    const existing = this.secrets.get(key);
    if (!existing) {
      return { success: false };
    }

    const previousValue = existing.value;
    this.secrets.set(key, {
      key,
      value: newValue,
      lastModified: Date.now()
    });
    this.saveSecrets();
    
    this.emit('rotation', { key, timestamp: Date.now() });
    
    return { success: true, previousValue };
  }

  public scheduleRotation(key: string, intervalMs: number, generator: () => string): NodeJS.Timeout {
    const timer = setInterval(() => {
      const newValue = generator();
      const result = this.rotateSecret(key, newValue);
      if (result.success) {
        console.log(`[SecretManager] Rotated secret: ${key}`);
      }
    }, intervalMs);

    return timer;
  }

  public getSecretAge(key: string): number | undefined {
    const secret = this.secrets.get(key);
    if (!secret) return undefined;
    return Date.now() - secret.lastModified;
  }

  public getExpiredSecrets(maxAgeMs: number): string[] {
    const expired: string[] = [];
    const now = Date.now();
    
    for (const [key, secret] of this.secrets) {
      if (now - secret.lastModified > maxAgeMs) {
        expired.push(key);
      }
    }
    
    return expired;
  }
}
