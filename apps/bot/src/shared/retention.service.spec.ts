import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  let service: RetentionService;

  const mockDeleteWhere = jest.fn();
  const mockDelete = jest.fn();

  const mockUpdateSetWhere = jest.fn();
  const mockUpdateSet = jest.fn();
  const mockUpdate = jest.fn();

  const mockDb = {
    delete: mockDelete,
    update: mockUpdate,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue([{ affectedRows: 0 }]);

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateSetWhere });
    mockUpdateSetWhere.mockResolvedValue([{ affectedRows: 0 }]);

    service = new RetentionService(mockDb as any);
  });

  describe('runRetentionPolicy()', () => {
    it('should delete old slack events and token logs', async () => {
      mockDeleteWhere
        .mockResolvedValueOnce([{ affectedRows: 42 }])
        .mockResolvedValueOnce([{ affectedRows: 15 }]);

      const result = await service.runRetentionPolicy();

      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(result.deletedSlackEvents).toBe(42);
      expect(result.deletedTokenLogs).toBe(15);
    });

    it('should return zeros when no old data exists', async () => {
      mockDeleteWhere
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await service.runRetentionPolicy();

      expect(result.deletedSlackEvents).toBe(0);
      expect(result.deletedTokenLogs).toBe(0);
    });

    it('should handle non-standard result formats gracefully', async () => {
      mockDeleteWhere
        .mockResolvedValueOnce({ affectedRows: 10 })
        .mockResolvedValueOnce({ affectedRows: 5 });

      const result = await service.runRetentionPolicy();

      expect(result.deletedSlackEvents).toBe(10);
      expect(result.deletedTokenLogs).toBe(5);
    });

    it('should return 0 when result has no affectedRows property', async () => {
      mockDeleteWhere
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(null);

      const result = await service.runRetentionPolicy();

      expect(result.deletedSlackEvents).toBe(0);
      expect(result.deletedTokenLogs).toBe(0);
    });
  });

  describe('expirePendingApprovals()', () => {
    it('should expire pending approvals past their expiration date', async () => {
      mockUpdateSetWhere.mockResolvedValue([{ affectedRows: 3 }]);

      const result = await service.expirePendingApprovals();

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith({ status: 'EXPIRED' });
      expect(result).toBe(3);
    });

    it('should return 0 when no approvals need expiring', async () => {
      mockUpdateSetWhere.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await service.expirePendingApprovals();

      expect(result).toBe(0);
    });
  });
});
