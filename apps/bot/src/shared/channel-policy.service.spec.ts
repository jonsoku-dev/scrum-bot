import { ChannelPolicyService } from './channel-policy.service';

describe('ChannelPolicyService', () => {
  let service: ChannelPolicyService;
  let selectResults: unknown[];

  const mockValues = jest.fn().mockResolvedValue(undefined);
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockUpdateSetWhere = jest.fn().mockResolvedValue(undefined);
  const mockUpdateSet = jest.fn().mockReturnValue({ where: mockUpdateSetWhere });
  const mockUpdate = jest.fn().mockReturnValue({ set: mockUpdateSet });

  const mockLimit = jest.fn();
  const mockWhere = jest.fn();
  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn();

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  };

  function setupSelectChain() {
    mockLimit.mockImplementation(() => Promise.resolve(selectResults));
    mockWhere.mockImplementation(() => {
      const p = Promise.resolve(selectResults) as any;
      p.limit = mockLimit;
      return p;
    });
    mockSelectFrom.mockImplementation(() => ({
      where: mockWhere,
      limit: mockLimit,
    }));
    mockSelect.mockReturnValue({ from: mockSelectFrom });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    selectResults = [];

    mockInsert.mockReturnValue({ values: mockValues });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateSetWhere });

    setupSelectChain();

    service = new ChannelPolicyService(mockDb as any);
  });

  describe('getPolicy()', () => {
    it('should return default policy when no custom policy exists', async () => {
      selectResults = [];

      const result = await service.getPolicy('C-unknown');

      expect(result).toEqual({
        channelId: 'C-unknown',
        enableSummary: true,
        enableReview: true,
        enableDecisionDetection: true,
      });
    });

    it('should return stored policy for known channel', async () => {
      selectResults = [{
        key: 'channel_policies',
        value: {
          'C123': {
            channelId: 'C123',
            enableSummary: false,
            enableReview: true,
            enableDecisionDetection: false,
          },
        },
      }];

      const result = await service.getPolicy('C123');

      expect(result.channelId).toBe('C123');
      expect(result.enableSummary).toBe(false);
      expect(result.enableDecisionDetection).toBe(false);
    });

    it('should use cache on subsequent calls within TTL', async () => {
      selectResults = [{
        key: 'channel_policies',
        value: {
          'C123': { enableSummary: true, enableReview: false },
        },
      }];

      await service.getPolicy('C123');
      await service.getPolicy('C123');

      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('isEnabled()', () => {
    it('should return true for enabled feature', async () => {
      selectResults = [];

      const result = await service.isEnabled('C123', 'enableSummary');

      expect(result).toBe(true);
    });

    it('should return false for disabled feature', async () => {
      selectResults = [{
        key: 'channel_policies',
        value: {
          'C123': { channelId: 'C123', enableSummary: false },
        },
      }];

      const result = await service.isEnabled('C123', 'enableSummary');

      expect(result).toBe(false);
    });
  });

  describe('setPolicies()', () => {
    it('should update existing policies', async () => {
      selectResults = [{ key: 'channel_policies', value: {} }];

      await service.setPolicies([
        {
          channelId: 'C123',
          enableSummary: true,
          enableReview: false,
          enableDecisionDetection: true,
        },
      ]);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          value: { 'C123': expect.objectContaining({ channelId: 'C123' }) },
        }),
      );
    });

    it('should insert when no existing policies', async () => {
      selectResults = [];

      await service.setPolicies([
        {
          channelId: 'C456',
          enableSummary: false,
          enableReview: true,
          enableDecisionDetection: false,
        },
      ]);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        key: 'channel_policies',
        value: { 'C456': expect.objectContaining({ channelId: 'C456' }) },
      });
    });

    it('should invalidate cache after setting policies', async () => {
      selectResults = [{
        key: 'channel_policies',
        value: { 'C123': { enableSummary: true } },
      }];

      await service.getPolicy('C123');
      expect(mockSelect).toHaveBeenCalledTimes(1);

      await service.setPolicies([{
        channelId: 'C123',
        enableSummary: false,
        enableReview: true,
        enableDecisionDetection: true,
      }]);

      await service.getPolicy('C123');
      expect(mockSelect).toHaveBeenCalledTimes(3);
    });
  });
});
