import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsService } from '../../src/services/MetricsService.js';

describe('MetricsService', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = MetricsService.getInstance();
    metrics.reset();
  });

  describe('counters', () => {
    it('should increment counter', () => {
      metrics.incCounter('requests_total');
      expect(metrics.getCounter('requests_total')).toBe(1);
      
      metrics.incCounter('requests_total');
      expect(metrics.getCounter('requests_total')).toBe(2);
    });

    it('should increment counter by specific value', () => {
      metrics.incCounter('bytes_sent', 1024);
      expect(metrics.getCounter('bytes_sent')).toBe(1024);
    });

    it('should support labels', () => {
      metrics.incCounter('requests_total', 1, { method: 'GET', path: '/api' });
      metrics.incCounter('requests_total', 1, { method: 'POST', path: '/api' });
      
      expect(metrics.getCounter('requests_total', { method: 'GET', path: '/api' })).toBe(1);
      expect(metrics.getCounter('requests_total', { method: 'POST', path: '/api' })).toBe(1);
    });

    it('should return 0 for non-existent counter', () => {
      expect(metrics.getCounter('nonexistent')).toBe(0);
    });
  });

  describe('gauges', () => {
    it('should set gauge value', () => {
      metrics.setGauge('active_connections', 5);
      expect(metrics.getGauge('active_connections')).toBe(5);
    });

    it('should increment gauge', () => {
      metrics.setGauge('active_connections', 5);
      metrics.incGauge('active_connections');
      expect(metrics.getGauge('active_connections')).toBe(6);
    });

    it('should decrement gauge', () => {
      metrics.setGauge('active_connections', 5);
      metrics.decGauge('active_connections');
      expect(metrics.getGauge('active_connections')).toBe(4);
    });

    it('should support labels', () => {
      metrics.setGauge('temperature', 25, { location: 'office' });
      metrics.setGauge('temperature', 30, { location: 'server_room' });
      
      expect(metrics.getGauge('temperature', { location: 'office' })).toBe(25);
      expect(metrics.getGauge('temperature', { location: 'server_room' })).toBe(30);
    });
  });

  describe('histograms', () => {
    it('should observe values', () => {
      metrics.observeHistogram('request_duration_ms', 100);
      metrics.observeHistogram('request_duration_ms', 200);
      metrics.observeHistogram('request_duration_ms', 150);
      
      const stats = metrics.getHistogramStats('request_duration_ms');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.sum).toBe(450);
      expect(stats!.avg).toBe(150);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(200);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        metrics.observeHistogram('latency', i);
      }
      
      const stats = metrics.getHistogramStats('latency');
      expect(stats!.p50).toBeGreaterThanOrEqual(49);
      expect(stats!.p50).toBeLessThanOrEqual(51);
      expect(stats!.p95).toBeGreaterThanOrEqual(94);
      expect(stats!.p95).toBeLessThanOrEqual(96);
      expect(stats!.p99).toBeGreaterThanOrEqual(98);
      expect(stats!.p99).toBeLessThanOrEqual(100);
    });

    it('should return undefined for non-existent histogram', () => {
      expect(metrics.getHistogramStats('nonexistent')).toBeUndefined();
    });
  });

  describe('timer', () => {
    it('should measure duration', async () => {
      const end = metrics.timer('operation_duration');
      await new Promise(resolve => setTimeout(resolve, 50));
      end();
      
      const stats = metrics.getHistogramStats('operation_duration');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(1);
      expect(stats!.min).toBeGreaterThanOrEqual(40);
      expect(stats!.max).toBeLessThan(200);
    });
  });

  describe('events', () => {
    it('should emit metric event on counter increment', () => {
      const handler = vi.fn();
      metrics.on('metric', handler);
      
      metrics.incCounter('test_counter');
      
      expect(handler).toHaveBeenCalledWith({
        name: 'test_counter',
        type: 'counter',
        value: 1,
        labels: {}
      });
    });

    it('should emit metric event on gauge set', () => {
      const handler = vi.fn();
      metrics.on('metric', handler);
      
      metrics.setGauge('test_gauge', 42);
      
      expect(handler).toHaveBeenCalledWith({
        name: 'test_gauge',
        type: 'gauge',
        value: 42,
        labels: {}
      });
    });
  });

  describe('exportPrometheus', () => {
    it('should export metrics in Prometheus format', () => {
      metrics.incCounter('http_requests_total', 10, { method: 'GET' });
      metrics.setGauge('active_users', 5);
      
      const output = metrics.exportPrometheus();
      
      expect(output).toContain('# TYPE http_requests_total counter');
      expect(output).toContain('http_requests_total{method="GET"} 10');
      expect(output).toContain('# TYPE active_users gauge');
      expect(output).toContain('active_users 5');
    });
  });

  describe('getAll', () => {
    it('should return all metrics', () => {
      metrics.incCounter('counter1', 5);
      metrics.setGauge('gauge1', 10);
      metrics.observeHistogram('hist1', 100);
      
      const all = metrics.getAll();
      
      expect(all.counters).toHaveProperty('counter1', 5);
      expect(all.gauges).toHaveProperty('gauge1', 10);
      expect(all.histograms).toHaveProperty('hist1');
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      metrics.incCounter('counter1');
      metrics.setGauge('gauge1', 10);
      
      metrics.reset();
      
      expect(metrics.getCounter('counter1')).toBe(0);
      expect(metrics.getGauge('gauge1')).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = MetricsService.getInstance();
      const instance2 = MetricsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
