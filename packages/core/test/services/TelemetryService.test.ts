import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelemetryService } from '../../src/services/TelemetryService.js';

describe('TelemetryService', () => {
  let telemetry: TelemetryService;

  beforeEach(() => {
    telemetry = TelemetryService.getInstance();
    for (const span of telemetry.getActiveSpans()) {
      telemetry.endSpan(span.spanId);
    }
  });

  describe('span lifecycle', () => {
    it('should start a new span', () => {
      const span = telemetry.startSpan('test-operation');
      
      expect(span).toBeDefined();
      expect(span.name).toBe('test-operation');
      expect(span.traceId).toHaveLength(16);
      expect(span.spanId).toHaveLength(16);
      expect(span.status).toBe('unset');
      expect(span.startTime).toBeLessThanOrEqual(Date.now());
      
      telemetry.endSpan(span.spanId);
    });

    it('should end span with status', () => {
      const span = telemetry.startSpan('test-operation');
      telemetry.endSpan(span.spanId, 'ok');
      
      const recentSpans = telemetry.getRecentSpans();
      const endedSpan = recentSpans.find(s => s.spanId === span.spanId);
      
      expect(endedSpan).toBeDefined();
      expect(endedSpan!.status).toBe('ok');
      expect(endedSpan!.endTime).toBeDefined();
    });

    it('should create child spans with parent context', () => {
      const parentSpan = telemetry.startSpan('parent-operation');
      const parentContext = telemetry.getContext(parentSpan.spanId);
      
      const childSpan = telemetry.startSpan('child-operation', parentContext);
      
      expect(childSpan.traceId).toBe(parentSpan.traceId);
      expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
      
      telemetry.endSpan(childSpan.spanId);
      telemetry.endSpan(parentSpan.spanId);
    });
  });

  describe('span attributes', () => {
    it('should add attributes to span', () => {
      const span = telemetry.startSpan('test-operation');
      
      telemetry.addSpanAttribute(span.spanId, 'user.id', '12345');
      telemetry.addSpanAttribute(span.spanId, 'request.count', 10);
      telemetry.addSpanAttribute(span.spanId, 'is.authenticated', true);
      
      const activeSpan = telemetry.getActiveSpans().find(s => s.spanId === span.spanId);
      
      expect(activeSpan!.attributes['user.id']).toBe('12345');
      expect(activeSpan!.attributes['request.count']).toBe(10);
      expect(activeSpan!.attributes['is.authenticated']).toBe(true);
      
      telemetry.endSpan(span.spanId);
    });

    it('should include service name attribute', () => {
      const span = telemetry.startSpan('test');
      expect(span.attributes['service.name']).toBe('aios-core');
      telemetry.endSpan(span.spanId);
    });
  });

  describe('span events', () => {
    it('should add events to span', () => {
      const span = telemetry.startSpan('test-operation');
      
      telemetry.addSpanEvent(span.spanId, 'cache-miss', { key: 'user:123' });
      telemetry.addSpanEvent(span.spanId, 'database-query', { table: 'users' });
      
      const activeSpan = telemetry.getActiveSpans().find(s => s.spanId === span.spanId);
      
      expect(activeSpan!.events).toHaveLength(2);
      expect(activeSpan!.events[0].name).toBe('cache-miss');
      expect(activeSpan!.events[1].name).toBe('database-query');
      
      telemetry.endSpan(span.spanId);
    });
  });

  describe('trace helper', () => {
    it('should wrap async function with span', async () => {
      let spanReceived: { spanId: string } | undefined;
      
      const result = await telemetry.trace('traced-operation', async (span) => {
        spanReceived = span;
        return 42;
      });
      
      expect(result).toBe(42);
      expect(spanReceived).toBeDefined();
      
      const completedSpan = telemetry.getRecentSpans().find(s => s.spanId === spanReceived!.spanId);
      expect(completedSpan!.status).toBe('ok');
    });

    it('should record error status on exception', async () => {
      let spanId: string | undefined;
      
      await expect(telemetry.trace('failing-operation', async (span) => {
        spanId = span.spanId;
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
      
      const completedSpan = telemetry.getRecentSpans().find(s => s.spanId === spanId);
      expect(completedSpan!.status).toBe('error');
      expect(completedSpan!.events.some(e => e.name === 'exception')).toBe(true);
    });

    it('should support parent context', async () => {
      const parentSpan = telemetry.startSpan('parent');
      const parentContext = telemetry.getContext(parentSpan.spanId);
      
      let childTraceId: string | undefined;
      
      await telemetry.trace('child', async (span) => {
        childTraceId = span.traceId;
      }, parentContext);
      
      expect(childTraceId).toBe(parentSpan.traceId);
      
      telemetry.endSpan(parentSpan.spanId);
    });
  });

  describe('W3C trace context', () => {
    it('should export W3C trace context header', () => {
      const span = telemetry.startSpan('test');
      const header = telemetry.exportW3CTraceContext(span.spanId);
      
      expect(header).toMatch(/^00-[a-f0-9]{16}-[a-f0-9]{16}-01$/);
      
      telemetry.endSpan(span.spanId);
    });

    it('should parse W3C trace context header', () => {
      const header = '00-0af7651916cd43dd-b7ad6b7169203331-01';
      const context = telemetry.parseW3CTraceContext(header);
      
      expect(context).toBeDefined();
      expect(context!.traceId).toBe('0af7651916cd43dd');
      expect(context!.spanId).toBe('b7ad6b7169203331');
    });

    it('should return undefined for invalid header', () => {
      const context = telemetry.parseW3CTraceContext('invalid');
      expect(context).toBeUndefined();
    });
  });

  describe('span queries', () => {
    it('should get recent spans with limit', () => {
      for (let i = 0; i < 10; i++) {
        const span = telemetry.startSpan(`op-${i}`);
        telemetry.endSpan(span.spanId);
      }
      
      const recent = telemetry.getRecentSpans(5);
      expect(recent.length).toBeLessThanOrEqual(5);
    });

    it('should get active spans', () => {
      const span1 = telemetry.startSpan('active-1');
      const span2 = telemetry.startSpan('active-2');
      
      const activeSpans = telemetry.getActiveSpans();
      expect(activeSpans.length).toBeGreaterThanOrEqual(2);
      
      telemetry.endSpan(span1.spanId);
      telemetry.endSpan(span2.spanId);
    });

    it('should get spans by trace ID', () => {
      const parentSpan = telemetry.startSpan('parent');
      const parentContext = telemetry.getContext(parentSpan.spanId);
      
      const childSpan = telemetry.startSpan('child', parentContext);
      
      telemetry.endSpan(childSpan.spanId);
      telemetry.endSpan(parentSpan.spanId);
      
      const traceSpans = telemetry.getSpansByTrace(parentSpan.traceId);
      expect(traceSpans.length).toBeGreaterThanOrEqual(2);
      expect(traceSpans.every(s => s.traceId === parentSpan.traceId)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return telemetry statistics', () => {
      const span = telemetry.startSpan('test');
      
      const stats = telemetry.getStats();
      
      expect(stats.activeSpans).toBeGreaterThanOrEqual(1);
      expect(typeof stats.completedSpans).toBe('number');
      expect(typeof stats.enabled).toBe('boolean');
      
      telemetry.endSpan(span.spanId);
    });
  });

  describe('events', () => {
    it('should emit spanStarted event', () => {
      const handler = vi.fn();
      telemetry.on('spanStarted', handler);
      
      const span = telemetry.startSpan('test');
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        spanId: span.spanId
      }));
      
      telemetry.endSpan(span.spanId);
    });

    it('should emit spanEnded event', () => {
      const handler = vi.fn();
      telemetry.on('spanEnded', handler);
      
      const span = telemetry.startSpan('test');
      telemetry.endSpan(span.spanId, 'ok');
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        spanId: span.spanId,
        status: 'ok'
      }));
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = TelemetryService.getInstance();
      const instance2 = TelemetryService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
