import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { GET, POST, DELETE } from './route';
import { NextRequest } from 'next/server';

// Mock global fetch
global.fetch = vi.fn();

describe('Jules API Proxy', () => {
  const mockApiKey = 'test-api-key';
  const baseUrl = 'http://localhost:3002/api/jules';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if API key is missing', async () => {
      const req = new NextRequest(baseUrl);
      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'API key required' });
    });

    it('should proxy GET request successfully', async () => {
      const mockResponseData = { data: 'test' };
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponseData,
      });

      const req = new NextRequest(`${baseUrl}?path=/test`, {
        headers: { 'x-jules-api-key': mockApiKey },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Goog-Api-Key': mockApiKey }),
        })
      );
      expect(res.status).toBe(200);
      expect(data).toEqual(mockResponseData);
    });

    it('should handle fetch errors', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const req = new NextRequest(`${baseUrl}?path=/test`, {
        headers: { 'x-jules-api-key': mockApiKey },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({ error: 'Proxy error', message: 'Network error' });
    });
  });

  describe('POST', () => {
    it('should return 401 if API key is missing', async () => {
      const req = new NextRequest(baseUrl, { method: 'POST' });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'API key required' });
    });

    it('should proxy POST request successfully', async () => {
      const mockRequestBody = { foo: 'bar' };
      const mockResponseData = { success: true };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponseData,
      });

      const req = new NextRequest(`${baseUrl}?path=/create`, {
        method: 'POST',
        headers: { 'x-jules-api-key': mockApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Goog-Api-Key': mockApiKey }),
        })
      );
      expect(res.status).toBe(201);
      expect(data).toEqual(mockResponseData);
    });
  });

  describe('DELETE', () => {
    it('should return 401 if API key is missing', async () => {
      const req = new NextRequest(baseUrl, { method: 'DELETE' });
      const res = await DELETE(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data).toEqual({ error: 'API key required' });
    });

    it('should proxy DELETE request successfully', async () => {
      const mockResponseData = { deleted: true };
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponseData,
      });

      const req = new NextRequest(`${baseUrl}?path=/delete/1`, {
        method: 'DELETE',
        headers: { 'x-jules-api-key': mockApiKey },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/delete/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({ 'X-Goog-Api-Key': mockApiKey }),
        })
      );
      expect(res.status).toBe(200);
      expect(data).toEqual(mockResponseData);
    });
  });
});
