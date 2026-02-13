import { IngestService } from './ingest.service';

describe('IngestService', () => {
  let service: IngestService;

  const mockInsert = jest.fn();
  const mockValues = jest.fn();
  const mockOnDuplicate = jest.fn();

  const mockDb = {
    insert: mockInsert,
  };

  const mockPiiMasking = {
    mask: jest.fn().mockReturnValue({ masked: 'safe text', redactedCount: 0, redactedTypes: [] }),
    hasPii: jest.fn().mockReturnValue(false),
  };

  const mockRetriever = {
    ingestAndEmbed: jest.fn().mockResolvedValue(undefined),
    search: jest.fn(),
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
    mockValues.mockReturnValue({ onDuplicateKeyUpdate: mockOnDuplicate });
    mockOnDuplicate.mockResolvedValue(undefined);

    service = new IngestService(mockDb as any, mockSlackQueue as any, mockPiiMasking as any, mockChannelPolicy as any, mockRetriever as any);
  });

  it('should store a message and call PII masking', async () => {
    await service.processMessage({
      channel: 'C123',
      ts: '1234567.890',
      user: 'U123',
      text: 'Hello world',
    });

    expect(mockPiiMasking.mask).toHaveBeenCalledWith('Hello world');
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'C123',
        messageTs: '1234567.890',
        userId: 'U123',
        text: 'safe text',
      }),
    );
  });

  it('should apply onDuplicateKeyUpdate for idempotency', async () => {
    await service.processMessage({
      channel: 'C123',
      ts: '1234567.890',
      text: 'test',
    });

    expect(mockOnDuplicate).toHaveBeenCalledWith({
      set: { eventType: 'message' },
    });
  });

  it('should call retriever.ingestAndEmbed for non-empty text', async () => {
    await service.processMessage({
      channel: 'C123',
      ts: '1234567.890',
      text: 'Some text',
    });

    expect(mockRetriever.ingestAndEmbed).toHaveBeenCalledWith(
      'safe text',
      'SLACK_MESSAGE',
      '1234567.890',
    );
  });

  it('should skip embedding when text is empty', async () => {
    await service.processMessage({
      channel: 'C123',
      ts: '1234567.890',
    });

    expect(mockRetriever.ingestAndEmbed).not.toHaveBeenCalled();
  });

  it('should handle embedding failure gracefully', async () => {
    mockRetriever.ingestAndEmbed.mockRejectedValueOnce(new Error('API error'));

    await expect(
      service.processMessage({
        channel: 'C123',
        ts: '1234567.890',
        text: 'test',
      }),
    ).resolves.toBeUndefined();
  });
});
