import { ContextService } from './context.service';

describe('ContextService', () => {
  let service: ContextService;

  const mockValues = jest.fn().mockResolvedValue(undefined);
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockWhere = jest.fn();
  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn();

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
  };

  const mockOpenAiHttp = {
    embedBatch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    mockWhere.mockResolvedValue([]);
    mockSelectFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });

    service = new ContextService(mockDb as any, mockOpenAiHttp as any);
  });

  describe('saveContext()', () => {
    it('should split content into chunks, embed, and insert each', async () => {
      const content = 'First paragraph\n\nSecond paragraph';
      mockOpenAiHttp.embedBatch.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);

      await service.saveContext('slack', 'msg-001', content);

      expect(mockOpenAiHttp.embedBatch).toHaveBeenCalledWith([
        'First paragraph',
        'Second paragraph',
      ]);
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it('should skip empty content', async () => {
      await service.saveContext('slack', 'msg-001', '');

      expect(mockOpenAiHttp.embedBatch).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should skip whitespace-only content', async () => {
      await service.saveContext('slack', 'msg-001', '   \n  ');

      expect(mockOpenAiHttp.embedBatch).not.toHaveBeenCalled();
    });

    it('should pass metadata when provided', async () => {
      mockOpenAiHttp.embedBatch.mockResolvedValue([[0.1, 0.2]]);

      await service.saveContext('jira', 'PROJ-123', 'ticket content', {
        priority: 'high',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { priority: 'high' } }),
      );
    });

    it('should default metadata to null', async () => {
      mockOpenAiHttp.embedBatch.mockResolvedValue([[0.1]]);

      await service.saveContext('slack', 'msg-002', 'some content');

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null }),
      );
    });

    it('should propagate embedding errors', async () => {
      mockOpenAiHttp.embedBatch.mockRejectedValue(new Error('API error'));

      await expect(
        service.saveContext('slack', 'msg-003', 'text'),
      ).rejects.toThrow('API error');
    });
  });

  describe('searchContext()', () => {
    it('should return scored results sorted by similarity', async () => {
      mockOpenAiHttp.embedBatch.mockResolvedValue([[1, 0, 0]]);
      mockWhere.mockResolvedValue([
        { content: 'relevant', sourceId: 's1', embedding: [0.9, 0.1, 0] },
        { content: 'less relevant', sourceId: 's2', embedding: [0.5, 0.5, 0.5] },
      ]);

      const results = await service.searchContext('query');

      expect(results.length).toBe(2);
      expect(results[0].content).toBe('relevant');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should respect limit parameter', async () => {
      mockOpenAiHttp.embedBatch.mockResolvedValue([[1, 0]]);
      mockWhere.mockResolvedValue([
        { content: 'a', sourceId: 's1', embedding: [0.9, 0.1] },
        { content: 'b', sourceId: 's2', embedding: [0.8, 0.2] },
        { content: 'c', sourceId: 's3', embedding: [0.7, 0.3] },
      ]);

      const results = await service.searchContext('query', 2);

      expect(results.length).toBe(2);
    });

    it('should skip rows with null embeddings', async () => {
      mockOpenAiHttp.embedBatch.mockResolvedValue([[1, 0]]);
      mockWhere.mockResolvedValue([
        { content: 'has embedding', sourceId: 's1', embedding: [0.9, 0.1] },
        { content: 'no embedding', sourceId: 's2', embedding: null },
      ]);

      const results = await service.searchContext('query');

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('has embedding');
    });

    it('should return empty array when embedding fails', async () => {
      mockOpenAiHttp.embedBatch.mockRejectedValue(new Error('API down'));

      const results = await service.searchContext('query');

      expect(results).toEqual([]);
    });
  });
});
