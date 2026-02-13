import { DecisionService } from './decision.service';

describe('DecisionService', () => {
  let service: DecisionService;
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

  const fakeDecision = {
    id: 'dec-001',
    draftId: 'draft-001',
    content: { title: 'Use PostgreSQL' },
    decidedBy: 'U100',
    sourceRefs: ['msg-1'],
    status: 'active',
    supersededBy: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  function setupSelectChain() {
    mockLimit.mockImplementation(() => Promise.resolve(selectResults));
    mockOrderBy.mockImplementation(() => Promise.resolve(selectResults));
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

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockSetWhere });
    mockSetWhere.mockResolvedValue(undefined);

    setupSelectChain();

    service = new DecisionService(mockDb as any);
  });

  describe('create()', () => {
    it('should insert a decision and return it', async () => {
      selectResults = [fakeDecision];

      const result = await service.create({
        draftId: 'draft-001',
        content: { title: 'Use PostgreSQL' },
        decidedBy: 'U100',
        sourceRefs: ['msg-1'],
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          draftId: 'draft-001',
          content: { title: 'Use PostgreSQL' },
          decidedBy: 'U100',
          sourceRefs: ['msg-1'],
        }),
      );
      expect(result).toEqual(fakeDecision);
    });

    it('should default draftId and sourceRefs to null when not provided', async () => {
      selectResults = [{ ...fakeDecision, draftId: null, sourceRefs: null }];

      await service.create({
        content: { title: 'Deploy on Friday' },
        decidedBy: 'U200',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          draftId: null,
          sourceRefs: null,
        }),
      );
    });
  });

  describe('findAll()', () => {
    it('should return all decisions without filters', async () => {
      selectResults = [fakeDecision];

      const result = await service.findAll();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual([fakeDecision]);
    });

    it('should filter by status when provided', async () => {
      selectResults = [fakeDecision];

      const result = await service.findAll({ status: 'active' });

      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual([fakeDecision]);
    });
  });

  describe('findById()', () => {
    it('should return a decision when found', async () => {
      selectResults = [fakeDecision];

      const result = await service.findById('dec-001');

      expect(result).toEqual(fakeDecision);
    });

    it('should return null when not found', async () => {
      selectResults = [];

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus()', () => {
    it('should update status and return decision', async () => {
      const updated = { ...fakeDecision, status: 'archived' };
      selectResults = [updated];

      const result = await service.updateStatus('dec-001', 'archived');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ status: 'archived' });
      expect(result.status).toBe('archived');
    });

    it('should throw when decision not found after update', async () => {
      selectResults = [];

      await expect(
        service.updateStatus('missing-id', 'archived'),
      ).rejects.toThrow('Decision missing-id not found after status update');
    });
  });

  describe('supersede()', () => {
    it('should mark decision as superseded with reference to new decision', async () => {
      const superseded = {
        ...fakeDecision,
        status: 'superseded',
        supersededBy: 'dec-002',
      };
      selectResults = [superseded];

      const result = await service.supersede('dec-001', 'dec-002');

      expect(mockSet).toHaveBeenCalledWith({
        status: 'superseded',
        supersededBy: 'dec-002',
      });
      expect(result.status).toBe('superseded');
      expect(result.supersededBy).toBe('dec-002');
    });

    it('should throw when decision not found after supersede', async () => {
      selectResults = [];

      await expect(
        service.supersede('missing-id', 'dec-002'),
      ).rejects.toThrow('Decision missing-id not found after supersede');
    });
  });
});
