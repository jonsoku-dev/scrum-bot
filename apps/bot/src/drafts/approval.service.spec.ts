import { ApprovalService } from './approval.service.js';

describe('ApprovalService', () => {
  let service: ApprovalService;
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

  const fakeApproval = {
    id: 'appr-001',
    approvalType: 'JIRA_CREATE',
    status: 'PENDING',
    requestedBy: 'U100',
    requestedVia: 'SLACK',
    slackActionPayload: null,
    draftId: 'draft-001',
    expiresAt: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date('2025-01-01'),
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

    service = new ApprovalService(mockDb as any, mockAuditLogService as any);
  });

  describe('create()', () => {
    it('should insert an approval and return it', async () => {
      selectResults = [fakeApproval];

      const result = await service.create({
        approvalType: 'JIRA_CREATE',
        requestedBy: 'U100',
        requestedVia: 'SLACK',
        draftId: 'draft-001',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalType: 'JIRA_CREATE',
          status: 'PENDING',
          requestedBy: 'U100',
          requestedVia: 'SLACK',
          draftId: 'draft-001',
          expiresAt: null,
        }),
      );
      expect(result).toEqual(fakeApproval);
    });

    it('should pass expiresAt when provided', async () => {
      const expiresAt = new Date('2025-12-31');
      selectResults = [{ ...fakeApproval, expiresAt }];

      await service.create({
        approvalType: 'JIRA_UPDATE',
        requestedBy: 'U100',
        requestedVia: 'DASHBOARD',
        draftId: 'draft-002',
        expiresAt,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt }),
      );
    });
  });

  describe('findById()', () => {
    it('should return an approval when found', async () => {
      selectResults = [fakeApproval];

      const result = await service.findById('appr-001');

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(fakeApproval);
    });

    it('should return null when not found', async () => {
      selectResults = [];

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return all approvals without filters', async () => {
      selectResults = [fakeApproval];

      const result = await service.findAll();

      expect(result).toEqual([fakeApproval]);
    });

    it('should accept status and draftId filters', async () => {
      selectResults = [fakeApproval];

      const result = await service.findAll({ status: 'PENDING', draftId: 'draft-001' });

      expect(result).toEqual([fakeApproval]);
    });
  });

  describe('approve()', () => {
    it('should set status to APPROVED with decidedBy', async () => {
      const approved = { ...fakeApproval, status: 'APPROVED', decidedBy: 'U200' };
      selectResults = [approved];

      const result = await service.approve('appr-001', 'U200');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED', decidedBy: 'U200' }),
      );
      expect(result.status).toBe('APPROVED');
      expect(result.decidedBy).toBe('U200');
    });

    it('should throw when approval not found after approve', async () => {
      selectResults = [];

      await expect(service.approve('missing', 'U200')).rejects.toThrow(
        'Approval missing not found after approve',
      );
    });
  });

  describe('reject()', () => {
    it('should set status to REJECTED with decidedBy', async () => {
      const rejected = { ...fakeApproval, status: 'REJECTED', decidedBy: 'U300' };
      selectResults = [rejected];

      const result = await service.reject('appr-001', 'U300');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REJECTED', decidedBy: 'U300' }),
      );
      expect(result.status).toBe('REJECTED');
    });

    it('should throw when approval not found after reject', async () => {
      selectResults = [];

      await expect(service.reject('missing', 'U300')).rejects.toThrow(
        'Approval missing not found after reject',
      );
    });
  });

  describe('expire()', () => {
    it('should set status to EXPIRED', async () => {
      const expired = { ...fakeApproval, status: 'EXPIRED' };
      selectResults = [expired];

      const result = await service.expire('appr-001');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'EXPIRED' }),
      );
      expect(result.status).toBe('EXPIRED');
    });

    it('should throw when approval not found after expire', async () => {
      selectResults = [];

      await expect(service.expire('missing')).rejects.toThrow(
        'Approval missing not found after expire',
      );
    });
  });
});
