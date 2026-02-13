import { CostTrackingService } from './cost-tracking.service';

describe('CostTrackingService', () => {
  let service: CostTrackingService;
  const mockDb = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockResolvedValue(undefined),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  };
  const mockConfig = {
    get: jest.fn().mockReturnValue(10),
    getOrThrow: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    service = new CostTrackingService(mockDb as any, mockConfig as any);
  });

  describe('shouldDegrade()', () => {
    it('should return degrade=true when cost >= budget', () => {
      const result = service.shouldDegrade(10);
      expect(result.degrade).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should return degrade=true when cost exceeds budget', () => {
      const result = service.shouldDegrade(15.5);
      expect(result.degrade).toBe(true);
    });

    it('should return degrade=false when cost < budget', () => {
      const result = service.shouldDegrade(5);
      expect(result.degrade).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should return degrade=false when cost is zero', () => {
      const result = service.shouldDegrade(0);
      expect(result.degrade).toBe(false);
    });
  });
});
