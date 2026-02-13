import { DraftService } from './draft.service.js';

describe('DraftService', () => {
  let service: DraftService;
  let selectResults: unknown[];

  const mockValues = jest.fn();
  const mockInsert = jest.fn();

  const mockSetWhere = jest.fn();
  const mockSet = jest.fn();
  const mockUpdate = jest.fn();

  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn();

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const fakeDraft = {
    id: 'draft-001',
    type: 'story',
    sourceEventIds: ['evt-1'],
    content: { summary: 'Test' },
    status: 'pending',
    approvedBy: null,
    executedAt: null,
    metadata: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    createdFrom: null,
    humanEditablePayload: null,
    committedIssueKey: null,
  };

  function setupSelectChain() {
    mockSelectFrom.mockImplementation(() => ({
      where: jest.fn().mockImplementation(() => {
        const p = Promise.resolve(selectResults) as any;
        p.limit = jest.fn().mockImplementation(() => Promise.resolve(selectResults));
        p.orderBy = jest.fn().mockImplementation(() => Promise.resolve(selectResults));
        return p;
      }),
      orderBy: jest.fn().mockImplementation(() => Promise.resolve(selectResults)),
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

    service = new DraftService(mockDb as any, mockAuditLogService as any);
  });

  describe('create()', () => {
    it('should insert a draft and return it', async () => {
      selectResults = [fakeDraft];

      const result = await service.create({
        type: 'story',
        sourceEventIds: ['evt-1'],
        content: { summary: 'Test' },
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'story',
          sourceEventIds: ['evt-1'],
          content: { summary: 'Test' },
          metadata: null,
        }),
      );
      expect(result).toEqual(fakeDraft);
    });

    it('should pass metadata when provided', async () => {
      selectResults = [{ ...fakeDraft, metadata: { priority: 'high' } }];

      await service.create({
        type: 'story',
        sourceEventIds: ['evt-1'],
        content: { summary: 'Test' },
        metadata: { priority: 'high' },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { priority: 'high' } }),
      );
    });
  });

  describe('findById()', () => {
    it('should return a draft when found', async () => {
      selectResults = [fakeDraft];

      const result = await service.findById('draft-001');

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(fakeDraft);
    });

    it('should return null when draft not found', async () => {
      selectResults = [];

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return all drafts without filters', async () => {
      selectResults = [fakeDraft];

      const result = await service.findAll();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual([fakeDraft]);
    });

    it('should accept status and type filters', async () => {
      selectResults = [fakeDraft];

      const result = await service.findAll({ status: 'pending', type: 'story' });

      expect(result).toEqual([fakeDraft]);
    });
  });

  describe('update()', () => {
    it('should update content and return updated draft', async () => {
      const updated = { ...fakeDraft, content: { summary: 'Updated' } };
      selectResults = [updated];

      const result = await service.update('draft-001', {
        content: { summary: 'Updated' },
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ content: { summary: 'Updated' } }),
      );
      expect(result).toEqual(updated);
    });

    it('should update status field', async () => {
      const updated = { ...fakeDraft, status: 'needs_review' };
      selectResults = [updated];

      const result = await service.update('draft-001', { status: 'needs_review' });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'needs_review' }),
      );
      expect(result.status).toBe('needs_review');
    });

    it('should throw when draft not found after update', async () => {
      selectResults = [];

      await expect(
        service.update('missing-id', { content: { x: 1 } }),
      ).rejects.toThrow('Draft missing-id not found after update');
    });
  });

  describe('approve()', () => {
    it('should set status to approved and return draft', async () => {
      const approved = { ...fakeDraft, status: 'approved', approvedBy: 'U123' };
      selectResults = [approved];

      const result = await service.approve('draft-001', 'U123');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', approvedBy: 'U123' }),
      );
      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('U123');
    });

    it('should throw when draft not found after approve', async () => {
      selectResults = [];

      await expect(service.approve('missing-id', 'U123')).rejects.toThrow(
        'Draft missing-id not found after approve',
      );
    });
  });

  describe('reject()', () => {
    it('should set status to rejected and return draft', async () => {
      const rejected = { ...fakeDraft, status: 'rejected' };
      selectResults = [rejected];

      const result = await service.reject('draft-001');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected' }),
      );
      expect(result.status).toBe('rejected');
    });

    it('should throw when draft not found after reject', async () => {
      selectResults = [];

      await expect(service.reject('missing-id')).rejects.toThrow(
        'Draft missing-id not found after reject',
      );
    });
  });
});
