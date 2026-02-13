import { IngestService } from '../drafts/ingest.service';
import type { PiiMaskResult } from '../shared/pii-masking.service';

describe('Slack Signature & Idempotency Integration', () => {
  let service: IngestService;

  const mockOnDuplicateKeyUpdate = jest.fn().mockResolvedValue(undefined);
  const mockValues = jest.fn().mockImplementation(() => ({
    onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate,
  }));
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockDb = { insert: mockInsert };

  const mockPiiMasking = {
    mask: jest.fn().mockReturnValue({
      masked: 'cleaned text',
      redactedCount: 0,
      redactedTypes: [],
    } satisfies PiiMaskResult),
    hasPii: jest.fn().mockReturnValue(false),
  };

  const mockRetriever = {
    ingestAndEmbed: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([]),
  };

  const mockSlackQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockChannelPolicy = {
    isEnabled: jest.fn().mockResolvedValue(true),
    getPolicy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockImplementation(() => ({
      onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate,
    }));
    mockOnDuplicateKeyUpdate.mockResolvedValue(undefined);

    service = new IngestService(
      mockDb as never,
      mockSlackQueue as never,
      mockPiiMasking as never,
      mockChannelPolicy as never,
      mockRetriever as never,
    );
  });

  describe('event pipeline: controller to service', () => {
    it('should pass through PII masking before DB insert', async () => {
      await service.processMessage({
        channel: 'C-test',
        ts: '111.001',
        user: 'U-1',
        text: 'Raw text with user@example.com',
      });

      expect(mockPiiMasking.mask).toHaveBeenCalledWith('Raw text with user@example.com');
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'cleaned text' }),
      );
    });

    it('should set correct eventType for each message', async () => {
      await service.processMessage({
        channel: 'C-test',
        ts: '111.002',
        text: 'Hello',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'message' }),
      );
    });
  });

  describe('idempotency: same (channel_id, message_ts) must not duplicate', () => {
    it('should use onDuplicateKeyUpdate for every insert', async () => {
      await service.processMessage({
        channel: 'C-dup',
        ts: '222.001',
        text: 'First insert',
      });

      expect(mockOnDuplicateKeyUpdate).toHaveBeenCalledWith({
        set: { eventType: 'message' },
      });
    });

    it('should process same channel+ts twice without error', async () => {
      const msg = { channel: 'C-dup', ts: '333.001', text: 'Duplicate' };

      await service.processMessage(msg);
      await service.processMessage(msg);

      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(mockOnDuplicateKeyUpdate).toHaveBeenCalledTimes(2);
    });

    it('should differentiate messages by timestamp', async () => {
      await service.processMessage({ channel: 'C-same', ts: '100.001', text: 'A' });
      await service.processMessage({ channel: 'C-same', ts: '100.002', text: 'B' });

      expect(mockValues).toHaveBeenCalledTimes(2);
      const calls = mockValues.mock.calls;
      expect(calls[0][0].messageTs).toBe('100.001');
      expect(calls[1][0].messageTs).toBe('100.002');
    });
  });

  describe('DB failure fallback', () => {
    it('should enqueue to slackQueue when DB insert fails', async () => {
      mockValues.mockImplementation(() => ({
        onDuplicateKeyUpdate: jest.fn().mockRejectedValue(new Error('DB down')),
      }));

      await service.processMessage({
        channel: 'C-fail',
        ts: '444.001',
        text: 'Should retry',
      });

      expect(mockSlackQueue.add).toHaveBeenCalledWith(
        'db-fallback-retry',
        expect.objectContaining({
          channel: 'C-fail',
          ts: '444.001',
        }),
        expect.objectContaining({
          attempts: 5,
          backoff: expect.objectContaining({ type: 'exponential' }),
        }),
      );
    });
  });
});
