import { SummarizeService } from './summarize.service';

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid'),
}));

jest.mock('../shared/tracing.js', () => ({
  createSpan: jest.fn().mockReturnValue({ traceId: 'trace-1' }),
  endSpan: jest.fn(),
}));

describe('SummarizeService', () => {
  let service: SummarizeService;
  let selectResults: unknown[];

  const mockValues = jest.fn().mockResolvedValue(undefined);
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockLimit = jest.fn();
  const mockOrderBy = jest.fn();
  const mockWhere = jest.fn();
  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn();

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
  };

  const mockGraph = {
    invoke: jest.fn(),
  };

  const mockGraphBuilder = {
    build: jest.fn().mockReturnValue({
      graph: mockGraph,
      recursionLimit: 25,
    }),
  };

  const mockPiiMasking = {
    mask: jest.fn().mockReturnValue({ masked: 'masked text', redactedCount: 0, redactedTypes: [] }),
  };

  const mockEvalService = {
    evaluateSummary: jest.fn().mockResolvedValue({
      overallScore: 85,
      dimensions: [],
    }),
  };

  const mockMetricsService = {
    recordSummarizeDuration: jest.fn(),
  };

  const fakeMessage = {
    userId: 'U100',
    text: 'We decided to use PostgreSQL',
    messageTs: '1700000000.000001',
    permalink: 'https://slack.com/msg/1',
    channelId: 'C123',
    createdAt: new Date('2025-01-01'),
  };

  function setupSelectChain() {
    mockLimit.mockImplementation(() => Promise.resolve(selectResults));
    mockOrderBy.mockImplementation(() => {
      const p = Promise.resolve(selectResults) as any;
      p.limit = mockLimit;
      return p;
    });
    mockWhere.mockImplementation(() => {
      const p = Promise.resolve(selectResults) as any;
      p.limit = mockLimit;
      p.orderBy = mockOrderBy;
      return p;
    });
    mockSelectFrom.mockImplementation(() => ({
      where: mockWhere,
      orderBy: mockOrderBy,
    }));
    mockSelect.mockReturnValue({ from: mockSelectFrom });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    selectResults = [];

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    mockGraphBuilder.build.mockReturnValue({
      graph: mockGraph,
      recursionLimit: 25,
    });

    setupSelectChain();

    service = new SummarizeService(
      mockDb as any,
      mockGraphBuilder as any,
      mockPiiMasking as any,
      mockEvalService as any,
      mockMetricsService as any,
    );
  });

  describe('summarizeChannel()', () => {
    it('should return empty result when no messages found', async () => {
      selectResults = [];

      const result = await service.summarizeChannel('C123');

      expect(result.summary).toBe('No messages found in this channel to summarize.');
      expect(result.channelId).toBe('C123');
      expect(result.messageCount).toBe(0);
      expect(result.actions).toEqual([]);
    });

    it('should process messages through PII masking and graph', async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return {
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([fakeMessage]),
                }),
              } as any;
            }
            const p = Promise.resolve([{
              id: 'mock-uuid',
              channelId: 'C123',
              summary: 'AI summary',
            }]) as any;
            p.limit = jest.fn().mockResolvedValue([{
              id: 'mock-uuid',
              channelId: 'C123',
              summary: 'AI summary',
            }]);
            return p;
          }),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([fakeMessage]),
          }),
        })),
      }));

      mockGraph.invoke.mockResolvedValue({
        summary: 'AI summary',
        actions: [{ type: 'task', description: 'Do something' }],
      });

      const result = await service.summarizeChannel('C123', 50);

      expect(mockPiiMasking.mask).toHaveBeenCalled();
      expect(mockGraph.invoke).toHaveBeenCalled();
      expect(result.summary).toBe('AI summary');
      expect(result.messageCount).toBe(1);
      expect(result.actions).toEqual([{ type: 'task', description: 'Do something' }]);
    });

    it('should throw when graph invocation fails', async () => {
      mockSelect.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([fakeMessage]),
            }),
          })),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([fakeMessage]),
          }),
        })),
      }));

      mockGraph.invoke.mockRejectedValue(new Error('LLM rate limit'));

      await expect(service.summarizeChannel('C123')).rejects.toThrow(
        'LLM rate limit',
      );
    });
  });

  describe('processMeetingMinutes()', () => {
    it('should process meeting text and return summary with actions', async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            const record = {
              id: 'mock-uuid',
              channelId: 'meeting-upload',
              summary: 'Meeting summary',
            };
            const p = Promise.resolve([record]) as any;
            p.limit = jest.fn().mockResolvedValue([record]);
            return p;
          }),
        })),
      }));

      mockGraph.invoke.mockResolvedValue({
        summary: 'Meeting summary',
        actions: [{ type: 'action', description: 'Follow up', assignee: 'U100' }],
      });

      const result = await service.processMeetingMinutes(
        'Sprint Retro',
        'We discussed improving CI/CD pipeline',
      );

      expect(mockPiiMasking.mask).toHaveBeenCalledWith(
        'We discussed improving CI/CD pipeline',
      );
      expect(mockInsert).toHaveBeenCalled();
      expect(result.summaryId).toBe('mock-uuid');
      expect(result.summary).toBe('Meeting summary');
      expect(result.actions).toHaveLength(1);
    });

    it('should throw when graph invocation fails during meeting processing', async () => {
      mockGraph.invoke.mockRejectedValue(new Error('timeout'));

      await expect(
        service.processMeetingMinutes('Standup', 'notes'),
      ).rejects.toThrow('timeout');
    });
  });
});
