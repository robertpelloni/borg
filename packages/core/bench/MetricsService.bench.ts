import { bench, describe } from 'vitest';
import { MetricsService } from '../src/services/MetricsService.js';

describe('MetricsService Benchmarks', () => {
  const metrics = MetricsService.getInstance();

  bench('incCounter', () => {
    metrics.incCounter('bench_counter');
  });

  bench('incCounter with labels', () => {
    metrics.incCounter('bench_counter_labels', 1, { method: 'GET', path: '/api' });
  });

  bench('setGauge', () => {
    metrics.setGauge('bench_gauge', Math.random() * 100);
  });

  bench('observeHistogram', () => {
    metrics.observeHistogram('bench_histogram', Math.random() * 1000);
  });

  bench('getCounter', () => {
    metrics.getCounter('bench_counter');
  });

  bench('getHistogramStats', () => {
    for (let i = 0; i < 100; i++) {
      metrics.observeHistogram('stats_histogram', i);
    }
    metrics.getHistogramStats('stats_histogram');
  });

  bench('exportPrometheus (100 metrics)', () => {
    for (let i = 0; i < 100; i++) {
      metrics.incCounter(`prom_counter_${i}`);
      metrics.setGauge(`prom_gauge_${i}`, i);
    }
    metrics.exportPrometheus();
  });

  bench('timer start/stop', () => {
    const end = metrics.timer('bench_timer');
    end();
  });
});
