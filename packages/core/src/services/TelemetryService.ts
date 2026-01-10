import { EventEmitter } from 'events';
import { MetricsService } from './MetricsService.js';

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

interface TraceContext {
  traceId: string;
  spanId: string;
}

export class TelemetryService extends EventEmitter {
  private static instance: TelemetryService;
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private maxCompletedSpans = 1000;
  private metrics: MetricsService;
  private serviceName: string;
  private enabled: boolean;

  private constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
    this.metrics = MetricsService.getInstance();
    this.enabled = process.env.TELEMETRY_ENABLED !== 'false';
  }

  static getInstance(serviceName = 'aios-core'): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService(serviceName);
    }
    return TelemetryService.instance;
  }

  private generateId(): string {
    return Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  startSpan(name: string, parentContext?: TraceContext): Span {
    const span: Span = {
      traceId: parentContext?.traceId || this.generateId(),
      spanId: this.generateId(),
      parentSpanId: parentContext?.spanId,
      name,
      startTime: Date.now(),
      status: 'unset',
      attributes: {
        'service.name': this.serviceName
      },
      events: []
    };

    this.activeSpans.set(span.spanId, span);
    this.metrics.incGauge('telemetry_active_spans');
    this.emit('spanStarted', span);

    return span;
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = status;

    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    if (this.completedSpans.length > this.maxCompletedSpans) {
      this.completedSpans.shift();
    }

    const duration = span.endTime - span.startTime;
    this.metrics.decGauge('telemetry_active_spans');
    this.metrics.observeHistogram('span_duration_ms', duration, { name: span.name });
    this.metrics.incCounter('spans_total', 1, { name: span.name, status });

    this.emit('spanEnded', span);
  }

  addSpanAttribute(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({ name, timestamp: Date.now(), attributes });
    }
  }

  getContext(spanId: string): TraceContext | undefined {
    const span = this.activeSpans.get(spanId);
    if (span) {
      return { traceId: span.traceId, spanId: span.spanId };
    }
    return undefined;
  }

  async trace<T>(name: string, fn: (span: Span) => Promise<T>, parentContext?: TraceContext): Promise<T> {
    const span = this.startSpan(name, parentContext);
    try {
      const result = await fn(span);
      this.endSpan(span.spanId, 'ok');
      return result;
    } catch (error) {
      this.addSpanEvent(span.spanId, 'exception', { 
        message: error instanceof Error ? error.message : String(error) 
      });
      this.endSpan(span.spanId, 'error');
      throw error;
    }
  }

  getRecentSpans(limit = 100): Span[] {
    return this.completedSpans.slice(-limit);
  }

  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  getSpansByTrace(traceId: string): Span[] {
    return this.completedSpans.filter(s => s.traceId === traceId);
  }

  exportW3CTraceContext(spanId: string): string | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) return undefined;
    return `00-${span.traceId}-${span.spanId}-01`;
  }

  parseW3CTraceContext(header: string): TraceContext | undefined {
    const parts = header.split('-');
    if (parts.length >= 3) {
      return { traceId: parts[1], spanId: parts[2] };
    }
    return undefined;
  }

  getStats(): { activeSpans: number; completedSpans: number; enabled: boolean } {
    return {
      activeSpans: this.activeSpans.size,
      completedSpans: this.completedSpans.length,
      enabled: this.enabled
    };
  }
}

export const telemetry = TelemetryService.getInstance();
