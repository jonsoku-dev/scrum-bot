import { RetrieverService } from './retriever.service';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mock-hash-abc'),
    }),
  }),
}));

describe('RetrieverService', () => {
  let service: RetrieverService;

  const mockValues = jest.fn().mockResolvedValue(undefined);
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockLimit = jest.fn();
  const mockWhere = jest.fn();
  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn();

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
  };

  const mockOpenAiHttp = {
    embedText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    mockLimit.mockResolvedValue([]);
    mockWhere.mockImplementation(() => {
      const p = Promise.resolve([]) as any;
      p.limit = mockLimit;
      return p;
    });
    mockSelectFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: mockWhere,
      }),
    }));

    service = new RetrieverService(mockDb as any, mockOpenAiHttp as any);
  });

  describe('search()', () => {
    it('should return results sorted by weighted similarity above threshold', async () => {
      mockOpenAiHttp.embedText.mockResolvedValue([1, 0, 0]);
      mockWhere.mockResolvedValue([
        {
          content: 'highly relevant',
          sourceId: 's1',
          embedding: [0.99, 0.01, 0],
          eventTime: null,
          weightConfidence: 1.0,
        },
        {
          content: 'somewhat relevant',
          sourceId: 's2',
          embedding: [0.7, 0.5, 0.3],
          eventTime: null,
          weightConfidence: 0.8,
        },
      ]);

      const results = await service.search('query');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toBe('highly relevant');
      results.forEach((r) => expect(r.similarity).toBeGreaterThanOrEqual(0.7));
    });

    it('should filter out results below minSimilarity threshold', async () => {
      mockOpenAiHttp.embedText.mockResolvedValue([1, 0]);
      mockWhere.mockResolvedValue([
        {
          content: 'low relevance',
          sourceId: 's1',
          embedding: [0.1, 0.9],
          eventTime: null,
          weightConfidence: 0.6,
        },
      ]);

      const results = await service.search('query', { minSimilarity: 0.8 });

      expect(results.length).toBe(0);
    });

    it('should apply temporal decay for old events', async () => {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const oldDate = new Date(Date.now() - thirtyDaysMs);
      mockOpenAiHttp.embedText.mockResolvedValue([1, 0]);
      mockWhere.mockResolvedValue([
        {
          content: 'old event',
          sourceId: 's1',
          embedding: [0.95, 0.05],
          eventTime: oldDate,
          weightConfidence: 1.0,
        },
        {
          content: 'recent event',
          sourceId: 's2',
          embedding: [0.95, 0.05],
          eventTime: null,
          weightConfidence: 1.0,
        },
      ]);

      const results = await service.search('query', { minSimilarity: 0 });

      const oldResult = results.find((r) => r.content === 'old event');
      const recentResult = results.find((r) => r.content === 'recent event');

      if (oldResult && recentResult) {
        expect(recentResult.similarity).toBeGreaterThan(oldResult.similarity);
      }
    });

    it('should respect limit option', async () => {
      mockOpenAiHttp.embedText.mockResolvedValue([1, 0]);
      const rows = Array.from({ length: 10 }, (_, i) => ({
        content: `item-${i}`,
        sourceId: `s${i}`,
        embedding: [0.9, 0.1],
        eventTime: null,
        weightConfidence: 1.0,
      }));
      mockWhere.mockResolvedValue(rows);

      const results = await service.search('query', { limit: 3, minSimilarity: 0 });

      expect(results.length).toBe(3);
    });

    it('should skip rows with null embeddings', async () => {
      mockOpenAiHttp.embedText.mockResolvedValue([1, 0]);
      mockWhere.mockResolvedValue([
        { content: 'valid', sourceId: 's1', embedding: [0.9, 0.1], eventTime: null, weightConfidence: 1.0 },
        { content: 'null embed', sourceId: 's2', embedding: null, eventTime: null, weightConfidence: 1.0 },
      ]);

      const results = await service.search('query', { minSimilarity: 0 });

      const contents = results.map((r) => r.content);
      expect(contents).not.toContain('null embed');
    });
  });

  describe('ingestAndEmbed()', () => {
    it('should embed content and insert into database', async () => {
      mockOpenAiHttp.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
      mockLimit.mockResolvedValue([]);
      mockWhere.mockImplementation(() => {
        const p = Promise.resolve([]) as any;
        p.limit = mockLimit;
        return p;
      });
      mockSelect.mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: mockWhere,
        }),
      }));

      await service.ingestAndEmbed('test content', 'slack', 'msg-001');

      expect(mockOpenAiHttp.embedText).toHaveBeenCalledWith('test content');
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'slack',
          sourceId: 'msg-001',
          content: 'test content',
          embedding: [0.1, 0.2, 0.3],
          piiRedacted: false,
        }),
      );
    });

    it('should skip empty content', async () => {
      await service.ingestAndEmbed('', 'slack', 'msg-001');

      expect(mockOpenAiHttp.embedText).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should skip whitespace-only content', async () => {
      await service.ingestAndEmbed('   ', 'slack', 'msg-001');

      expect(mockOpenAiHttp.embedText).not.toHaveBeenCalled();
    });

    it('should skip duplicate content by hash', async () => {
      mockLimit.mockResolvedValue([{ id: 'existing-chunk' }]);
      mockWhere.mockImplementation(() => {
        const p = Promise.resolve([{ id: 'existing-chunk' }]) as any;
        p.limit = mockLimit;
        return p;
      });
      mockSelect.mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: mockWhere,
        }),
      }));

      await service.ingestAndEmbed('duplicate text', 'slack', 'msg-002');

      expect(mockOpenAiHttp.embedText).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should pass metadata when provided', async () => {
      mockOpenAiHttp.embedText.mockResolvedValue([0.1]);
      mockLimit.mockResolvedValue([]);
      mockWhere.mockImplementation(() => {
        const p = Promise.resolve([]) as any;
        p.limit = mockLimit;
        return p;
      });
      mockSelect.mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: mockWhere,
        }),
      }));

      await service.ingestAndEmbed('text', 'jira', 'PROJ-1', { type: 'epic' });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { type: 'epic' } }),
      );
    });
  });
});
