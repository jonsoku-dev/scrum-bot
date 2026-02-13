import { AgentRunService } from './agent-run.service';

describe('AgentRunService', () => {
  let service: AgentRunService;
  let selectResults: unknown[];

  const mockValues = jest.fn();
  const mockInsert = jest.fn();

  const mockSetWhere = jest.fn();
  const mockSet = jest.fn();
  const mockUpdate = jest.fn();

  const mockLimit = jest.fn();
  const mockWhere = jest.fn();
  const mockOrderBy = jest.fn();
  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn();

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  };

  const fakeRun = {
    id: 'run-001',
    draftId: 'draft-001',
    agentName: 'summarize-agent',
    input: { text: 'hello' },
    output: null,
    status: 'running',
    tokenUsage: null,
    durationMs: null,
    error: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  function setupSelectChain() {
    mockLimit.mockImplementation(() => Promise.resolve(selectResults));
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
      limit: mockLimit,
    }));
    mockSelect.mockReturnValue({ from: mockSelectFrom });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    selectResults = [];

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockSetWhere });
    mockSetWhere.mockResolvedValue(undefined);

    setupSelectChain();

    service = new AgentRunService(mockDb as any);
  });

  describe('startRun()', () => {
    it('should insert a new run with running status and return it', async () => {
      selectResults = [fakeRun];

      const result = await service.startRun(
        'draft-001',
        'summarize-agent',
        { text: 'hello' },
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          draftId: 'draft-001',
          agentName: 'summarize-agent',
          input: { text: 'hello' },
          status: 'running',
        }),
      );
      expect(result).toEqual(fakeRun);
    });
  });

  describe('completeRun()', () => {
    it('should update run with output, token usage, and duration', async () => {
      const completed = {
        ...fakeRun,
        status: 'completed',
        output: { summary: 'done' },
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
        durationMs: 3200,
      };
      selectResults = [completed];

      const result = await service.completeRun(
        'run-001',
        { summary: 'done' },
        { prompt: 100, completion: 50, total: 150 },
        3200,
      );

      expect(mockSet).toHaveBeenCalledWith({
        output: { summary: 'done' },
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
        durationMs: 3200,
        status: 'completed',
      });
      expect(result.status).toBe('completed');
    });

    it('should throw when run not found after complete', async () => {
      selectResults = [];

      await expect(
        service.completeRun(
          'missing-id',
          {},
          { prompt: 0, completion: 0, total: 0 },
          0,
        ),
      ).rejects.toThrow('AgentRun missing-id not found after complete');
    });
  });

  describe('failRun()', () => {
    it('should mark run as failed with error message', async () => {
      const failed = {
        ...fakeRun,
        status: 'failed',
        error: 'LLM timeout',
      };
      selectResults = [failed];

      const result = await service.failRun('run-001', 'LLM timeout');

      expect(mockSet).toHaveBeenCalledWith({
        status: 'failed',
        error: 'LLM timeout',
      });
      expect(result.status).toBe('failed');
      expect(result.error).toBe('LLM timeout');
    });

    it('should throw when run not found after fail', async () => {
      selectResults = [];

      await expect(
        service.failRun('missing-id', 'error'),
      ).rejects.toThrow('AgentRun missing-id not found after fail');
    });
  });

  describe('getAllRuns()', () => {
    it('should return runs ordered by createdAt with limit 100', async () => {
      selectResults = [fakeRun];

      const result = await service.getAllRuns();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual([fakeRun]);
    });
  });

  describe('getRunsByDraft()', () => {
    it('should return runs filtered by draftId', async () => {
      selectResults = [fakeRun];

      const result = await service.getRunsByDraft('draft-001');

      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual([fakeRun]);
    });
  });

  describe('getRunById()', () => {
    it('should return a run when found', async () => {
      selectResults = [fakeRun];

      const result = await service.getRunById('run-001');

      expect(result).toEqual(fakeRun);
    });

    it('should return null when not found', async () => {
      selectResults = [];

      const result = await service.getRunById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
