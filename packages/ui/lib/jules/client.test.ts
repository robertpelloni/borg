import { JulesClient, createJulesClient } from './client';

// Mock global fetch
global.fetch = jest.fn();

describe('JulesClient', () => {
  const mockApiKey = 'test-api-key';
  let client: JulesClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createJulesClient(mockApiKey);
  });

  describe('createSession', () => {
    it('should set requirePlanApproval to true', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'session/1',
          createTime: '2023-01-01T00:00:00Z',
          updateTime: '2023-01-01T00:00:00Z',
        }),
      });

      await client.createSession({
        prompt: 'test prompt',
        sourceId: 'test/repo',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/jules?path=%2Fsessions'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"requirePlanApproval":true'),
        })
      );
    });
  });

  describe('approvePlan', () => {
    it('should post to the correct endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await client.approvePlan('session-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/jules?path=%2Fsessions%2Fsession-123%3AapprovePlan'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('listActivitiesPaged', () => {
    it('should return activities and next page token', async () => {
      const mockResponse = {
        activities: [
          { name: 'activities/1', createTime: '2023-01-01T00:00:00Z' },
          { name: 'activities/2', createTime: '2023-01-01T00:00:01Z' },
        ],
        nextPageToken: 'next-token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listActivitiesPaged('session-123', 10, 'prev-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/jules?path=%2Fsessions%2Fsession-123%2Factivities%3FpageSize%3D10%26pageToken%3Dprev-token'),
        expect.any(Object)
      );
      expect(result.activities).toHaveLength(2);
      expect(result.nextPageToken).toBe('next-token');
      expect(result.activities[0].id).toBe('1');
    });
  });
});
