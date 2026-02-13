import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  const mockValues = jest.fn().mockResolvedValue(undefined);
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockDb = {
    insert: mockInsert,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    service = new AuditLogService(mockDb as any);
  });

  describe('log()', () => {
    it('should insert an audit log entry with all fields', async () => {
      await service.log({
        actorType: 'HUMAN',
        actorId: 'U123',
        action: 'APPROVE_DRAFT',
        targetType: 'DRAFT',
        targetId: 'draft-001',
        payload: { reason: 'looks good' },
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        actorType: 'HUMAN',
        actorId: 'U123',
        action: 'APPROVE_DRAFT',
        targetType: 'DRAFT',
        targetId: 'draft-001',
        payload: { reason: 'looks good' },
      });
    });

    it('should default payload to null when not provided', async () => {
      await service.log({
        actorType: 'AI',
        actorId: 'agent-summarize',
        action: 'CREATE_SUMMARY',
        targetType: 'SUMMARY',
        targetId: 'sum-001',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ payload: null }),
      );
    });

    it('should handle SYSTEM actor type', async () => {
      await service.log({
        actorType: 'SYSTEM',
        actorId: 'retention-cron',
        action: 'DELETE_OLD_EVENTS',
        targetType: 'SLACK_EVENT',
        targetId: 'batch-001',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          actorId: 'retention-cron',
        }),
      );
    });

    it('should propagate database errors', async () => {
      mockValues.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.log({
          actorType: 'HUMAN',
          actorId: 'U999',
          action: 'REJECT_DRAFT',
          targetType: 'DRAFT',
          targetId: 'draft-002',
        }),
      ).rejects.toThrow('DB connection lost');
    });
  });
});
