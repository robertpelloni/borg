import { EventEmitter } from 'events';

type MetricType = 'counter' | 'gauge' | 'histogram';

interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramMetric {
  name: string;
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  labels: Record<string, string>;
}

export class MetricsService extends EventEmitter {
  private static instance: MetricsService;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, { values: number[]; labels: Record<string, string> }> = new Map();
  private labels: Map<string, Record<string, string>> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private getKey(name: string, labels: Record<string, string> = {}): string {
    const labelStr = Object.entries(labels).sort().map(([k, v]) => `${k}="${v}"`).join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  incCounter(name: string, value = 1, labels: Record<string, string> = {}): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.labels.set(key, labels);
    this.emit('metric', { name, type: 'counter', value: current + value, labels });
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    this.labels.set(key, labels);
    this.emit('metric', { name, type: 'gauge', value, labels });
  }

  incGauge(name: string, value = 1, labels: Record<string, string> = {}): void {
    const key = this.getKey(name, labels);
    const current = this.gauges.get(key) || 0;
    this.setGauge(name, current + value, labels);
  }

  decGauge(name: string, value = 1, labels: Record<string, string> = {}): void {
    this.incGauge(name, -value, labels);
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(name, labels);
    let hist = this.histograms.get(key);
    if (!hist) {
      hist = { values: [], labels };
      this.histograms.set(key, hist);
    }
    hist.values.push(value);
    this.emit('metric', { name, type: 'histogram', value, labels });
  }

  timer(name: string, labels: Record<string, string> = {}): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.observeHistogram(name, durationMs, labels);
    };
  }

  getCounter(name: string, labels: Record<string, string> = {}): number {
    return this.counters.get(this.getKey(name, labels)) || 0;
  }

  getGauge(name: string, labels: Record<string, string> = {}): number {
    return this.gauges.get(this.getKey(name, labels)) || 0;
  }

  getHistogramStats(name: string, labels: Record<string, string> = {}): { 
    count: number; 
    sum: number; 
    avg: number; 
    min: number; 
    max: number; 
    p50: number; 
    p95: number; 
    p99: number 
  } | undefined {
    const hist = this.histograms.get(this.getKey(name, labels));
    if (!hist || hist.values.length === 0) return undefined;

    const sorted = [...hist.values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    return {
      count,
      sum,
      avg: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  exportPrometheus(): string {
    const lines: string[] = [];

    for (const [key, value] of this.counters) {
      lines.push(`# TYPE ${key.split('{')[0]} counter`);
      lines.push(`${key} ${value}`);
    }

    for (const [key, value] of this.gauges) {
      lines.push(`# TYPE ${key.split('{')[0]} gauge`);
      lines.push(`${key} ${value}`);
    }

    for (const [key, hist] of this.histograms) {
      const name = key.split('{')[0];
      const stats = this.getHistogramStats(name, hist.labels);
      if (stats) {
        lines.push(`# TYPE ${name} histogram`);
        lines.push(`${name}_sum${key.includes('{') ? key.slice(key.indexOf('{')) : ''} ${stats.sum}`);
        lines.push(`${name}_count${key.includes('{') ? key.slice(key.indexOf('{')) : ''} ${stats.count}`);
      }
    }

    return lines.join('\n');
  }

  getAll(): { counters: Record<string, number>; gauges: Record<string, number>; histograms: Record<string, unknown> } {
    const histogramStats: Record<string, unknown> = {};
    for (const [key, hist] of this.histograms) {
      histogramStats[key] = this.getHistogramStats(key.split('{')[0], hist.labels);
    }

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: histogramStats
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labels.clear();
  }
}

export const metrics = MetricsService.getInstance();
