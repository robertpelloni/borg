import systeminformation from 'systeminformation';
import { EventEmitter } from 'events';

interface SerialPortModule {
  SerialPort: new (options: { path: string; baudRate: number }) => SerialPortInstance;
}

interface SerialPortInstance {
  on(event: 'data', callback: (data: Buffer) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'open', callback: () => void): void;
  on(event: 'close', callback: () => void): void;
  write(data: string | Buffer, callback?: (error: Error | null) => void): void;
  close(callback?: (error: Error | null) => void): void;
  isOpen: boolean;
}

export interface ActivityData {
  steps: number;
  heartRate: number;
  accelerometer: { x: number; y: number; z: number };
  danceScore: number;
  timestamp: Date;
}

export interface WearableDevice {
  path: string;
  name: string;
  connected: boolean;
  lastData?: ActivityData;
}

export class HardwareManager extends EventEmitter {
  private static instance: HardwareManager;
  private isMining: boolean = false;
  private serialPort: SerialPortInstance | null = null;
  private serialPortModule: SerialPortModule | null = null;
  private connectedDevices: Map<string, WearableDevice> = new Map();
  private activityBuffer: ActivityData[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  private constructor() {
    super();
    this.loadSerialPort();
  }

  private async loadSerialPort(): Promise<void> {
    try {
      const moduleName = 'serialport';
      this.serialPortModule = await import(moduleName) as unknown as SerialPortModule;
      console.log('[HardwareManager] SerialPort module loaded');
    } catch {
      console.log('[HardwareManager] SerialPort not available - physical mining disabled');
    }
  }

  public static getInstance(): HardwareManager {
    if (!HardwareManager.instance) {
      HardwareManager.instance = new HardwareManager();
    }
    return HardwareManager.instance;
  }

  public async listSerialPorts(): Promise<string[]> {
    try {
      const moduleName = 'serialport';
      const serialportModule = await import(moduleName).catch(() => null);
      if (!serialportModule) return [];
      
      const SerialPort = serialportModule.SerialPort || serialportModule.default?.SerialPort;
      if (!SerialPort || typeof SerialPort.list !== 'function') return [];
      
      const ports = await SerialPort.list();
      return ports.map((p: { path: string }) => p.path);
    } catch {
      return [];
    }
  }

  public async connectWearable(portPath: string, baudRate = 9600): Promise<boolean> {
    if (!this.serialPortModule) {
      throw new Error('SerialPort module not available');
    }

    if (this.connectedDevices.has(portPath)) {
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        const port = new this.serialPortModule!.SerialPort({ path: portPath, baudRate });
        
        port.on('open', () => {
          const device: WearableDevice = {
            path: portPath,
            name: `Wearable-${portPath}`,
            connected: true
          };
          this.connectedDevices.set(portPath, device);
          this.emit('deviceConnected', device);
          resolve(true);
        });

        port.on('data', (data: Buffer) => {
          this.processWearableData(portPath, data);
        });

        port.on('error', (err: Error) => {
          console.error(`[HardwareManager] Serial error on ${portPath}:`, err);
          this.emit('deviceError', { path: portPath, error: err });
          reject(err);
        });

        port.on('close', () => {
          const device = this.connectedDevices.get(portPath);
          if (device) {
            device.connected = false;
            this.emit('deviceDisconnected', device);
          }
          this.connectedDevices.delete(portPath);
        });

        this.serialPort = port;
      } catch (err) {
        reject(err);
      }
    });
  }

  private processWearableData(portPath: string, rawData: Buffer): void {
    try {
      const dataStr = rawData.toString().trim();
      const parsed = JSON.parse(dataStr);
      
      const activity: ActivityData = {
        steps: parsed.steps || 0,
        heartRate: parsed.hr || parsed.heartRate || 0,
        accelerometer: parsed.accel || { x: 0, y: 0, z: 0 },
        danceScore: this.calculateDanceScore(parsed.accel),
        timestamp: new Date()
      };

      const device = this.connectedDevices.get(portPath);
      if (device) {
        device.lastData = activity;
      }

      this.activityBuffer.push(activity);
      if (this.activityBuffer.length > this.MAX_BUFFER_SIZE) {
        this.activityBuffer.shift();
      }

      this.emit('activityData', activity);
    } catch {
      const numericMatch = rawData.toString().match(/\d+/g);
      if (numericMatch) {
        const activity: ActivityData = {
          steps: parseInt(numericMatch[0]) || 0,
          heartRate: parseInt(numericMatch[1]) || 0,
          accelerometer: { x: 0, y: 0, z: 0 },
          danceScore: 0,
          timestamp: new Date()
        };
        this.emit('activityData', activity);
      }
    }
  }

  private calculateDanceScore(accel?: { x: number; y: number; z: number }): number {
    if (!accel) return 0;
    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
    return Math.min(100, Math.round(magnitude * 10));
  }

  public disconnectWearable(portPath: string): void {
    if (this.serialPort && this.connectedDevices.has(portPath)) {
      this.serialPort.close();
      this.connectedDevices.delete(portPath);
    }
  }

  public getConnectedDevices(): WearableDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  public getActivityBuffer(): ActivityData[] {
    return [...this.activityBuffer];
  }

  public getAggregatedActivity(): { totalSteps: number; avgHeartRate: number; totalDanceScore: number } {
    if (this.activityBuffer.length === 0) {
      return { totalSteps: 0, avgHeartRate: 0, totalDanceScore: 0 };
    }

    const totalSteps = this.activityBuffer.reduce((sum, a) => sum + a.steps, 0);
    const avgHeartRate = this.activityBuffer.reduce((sum, a) => sum + a.heartRate, 0) / this.activityBuffer.length;
    const totalDanceScore = this.activityBuffer.reduce((sum, a) => sum + a.danceScore, 0);

    return { totalSteps, avgHeartRate: Math.round(avgHeartRate), totalDanceScore };
  }

  public clearActivityBuffer(): void {
    this.activityBuffer = [];
  }

  public async getSystemSpecs(): Promise<any> {
    const cpu = await systeminformation.cpu();
    const mem = await systeminformation.mem();
    const graphics = await systeminformation.graphics();
    
    return {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
      },
      memory: {
        total: mem.total,
        free: mem.free,
      },
      gpu: graphics.controllers.map(g => ({
        model: g.model,
        vram: g.vram,
      })),
      wearables: this.getConnectedDevices(),
      serialPortAvailable: !!this.serialPortModule
    };
  }

  public async getResourceUsage(): Promise<any> {
    const load = await systeminformation.currentLoad();
    const mem = await systeminformation.mem();
    
    return {
      cpuLoad: load.currentLoad,
      memoryUsed: mem.active,
      memoryTotal: mem.total
    };
  }

  public async calculateHashratePotential(): Promise<number> {
    const specs = await this.getSystemSpecs();
    let score = 0;
    
    score += specs.cpu.cores * 100;
    
    if (specs.gpu.length > 0) {
      score += 1000 * specs.gpu.length;
    }

    const activity = this.getAggregatedActivity();
    score += activity.totalDanceScore;

    return score;
  }

  public startMining(): void {
    if (this.isMining) return;
    this.isMining = true;
    this.emit('miningStarted');
  }

  public stopMining(): void {
    if (!this.isMining) return;
    this.isMining = false;
    this.emit('miningStopped');
  }

  public getMiningStatus(): boolean {
    return this.isMining;
  }

  public isSerialPortAvailable(): boolean {
    return !!this.serialPortModule;
  }
}
