import { bench, describe } from 'vitest';
import { TelemetryService } from '../src/services/TelemetryService.js';

describe('TelemetryService Benchmarks', () => {
  const telemetry = TelemetryService.getInstance();

  bench('startSpan', () => {
    const span = telemetry.startSpan('bench-operation');
    telemetry.endSpan(span.spanId);
  });

  bench('startSpan with parent context', () => {
    const parent = telemetry.startSpan('parent');
    const ctx = telemetry.getContext(parent.spanId);
    const child = telemetry.startSpan('child', ctx);
    telemetry.endSpan(child.spanId);
    telemetry.endSpan(parent.spanId);
  });

  bench('addSpanAttribute', () => {
    const span = telemetry.startSpan('attr-test');
    telemetry.addSpanAttribute(span.spanId, 'key', 'value');
    telemetry.endSpan(span.spanId);
  });

  bench('addSpanEvent', () => {
    const span = telemetry.startSpan('event-test');
    telemetry.addSpanEvent(span.spanId, 'test-event', { data: 'value' });
    telemetry.endSpan(span.spanId);
  });

  bench('exportW3CTraceContext', () => {
    const span = telemetry.startSpan('w3c-test');
    telemetry.exportW3CTraceContext(span.spanId);
    telemetry.endSpan(span.spanId);
  });

  bench('parseW3CTraceContext', () => {
    telemetry.parseW3CTraceContext('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
  });

  bench('getRecentSpans (1000 spans)', () => {
    for (let i = 0; i < 100; i++) {
      const span = telemetry.startSpan(`batch-${i}`);
      telemetry.endSpan(span.spanId);
    }
    telemetry.getRecentSpans(100);
  });

  bench('trace wrapper', async () => {
    await telemetry.trace('traced-op', async () => {
      return 42;
    });
  });
});
