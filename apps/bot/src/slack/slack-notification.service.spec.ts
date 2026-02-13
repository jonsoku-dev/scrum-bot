import { SlackNotificationService } from './slack-notification.service';

describe('SlackNotificationService', () => {
  let service: SlackNotificationService;

  const mockPostMessage = jest.fn().mockResolvedValue({ ok: true });
  const mockConversationsHistory = jest.fn();

  const mockSlackService = {
    client: {
      chat: { postMessage: mockPostMessage },
      conversations: { history: mockConversationsHistory },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostMessage.mockResolvedValue({ ok: true });
    mockConversationsHistory.mockResolvedValue({
      messages: [{ text: 'hello world' }],
    });

    service = new SlackNotificationService(mockSlackService as any);
  });

  describe('fetchMessageText()', () => {
    it('should return message text when found', async () => {
      const result = await service.fetchMessageText('C123', '1700000000.000001');

      expect(mockConversationsHistory).toHaveBeenCalledWith({
        channel: 'C123',
        latest: '1700000000.000001',
        inclusive: true,
        limit: 1,
      });
      expect(result).toBe('hello world');
    });

    it('should return null when no messages returned', async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });

      const result = await service.fetchMessageText('C123', '1700000000.000001');

      expect(result).toBeNull();
    });

    it('should return null when messages is undefined', async () => {
      mockConversationsHistory.mockResolvedValue({});

      const result = await service.fetchMessageText('C123', '1700000000.000001');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockConversationsHistory.mockRejectedValue(new Error('channel_not_found'));

      const result = await service.fetchMessageText('C-invalid', '123');

      expect(result).toBeNull();
    });
  });

  describe('postMessage()', () => {
    it('should post a simple text message', async () => {
      await service.postMessage('C123', 'Hello team!');

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Hello team!',
      });
    });

    it('should not throw on API error (logs instead)', async () => {
      mockPostMessage.mockRejectedValue(new Error('not_in_channel'));

      await expect(
        service.postMessage('C123', 'test'),
      ).resolves.toBeUndefined();
    });
  });

  describe('postDecisionCard()', () => {
    it('should post a decision card with blocks', async () => {
      await service.postDecisionCard('C123', 'Use Postgres', 0.92, 'dec-001');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: 'Decision Detected: Use Postgres',
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
            expect.objectContaining({ type: 'actions' }),
          ]),
        }),
      );
    });

    it('should include summary when provided', async () => {
      await service.postDecisionCard('C123', 'Decision', 0.8, 'dec-001', {
        summary: 'We chose Postgres for its reliability',
      });

      const call = mockPostMessage.mock.calls[0][0];
      const summaryBlock = call.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Summary'),
      );
      expect(summaryBlock).toBeDefined();
    });

    it('should include impact areas when provided', async () => {
      await service.postDecisionCard('C123', 'Decision', 0.8, 'dec-001', {
        impactAreas: ['backend', 'database'],
      });

      const call = mockPostMessage.mock.calls[0][0];
      const contextBlock = call.blocks.find(
        (b: any) => b.type === 'context',
      );
      expect(contextBlock).toBeDefined();
    });

    it('should include related tickets when provided', async () => {
      await service.postDecisionCard('C123', 'Decision', 0.8, 'dec-001', {
        relatedTickets: ['https://jira.example.com/PROJ-123'],
      });

      const call = mockPostMessage.mock.calls[0][0];
      const contextBlocks = call.blocks.filter(
        (b: any) => b.type === 'context',
      );
      expect(contextBlocks.length).toBeGreaterThan(0);
    });

    it('should not throw on API error', async () => {
      mockPostMessage.mockRejectedValue(new Error('invalid_blocks'));

      await expect(
        service.postDecisionCard('C123', 'Test', 0.5, 'dec-001'),
      ).resolves.toBeUndefined();
    });
  });

  describe('postDraftCard()', () => {
    it('should post a draft card with approve/edit/reject buttons', async () => {
      await service.postDraftCard('C123', 'draft-001', 'Create user auth module');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
            expect.objectContaining({ type: 'actions' }),
          ]),
        }),
      );

      const call = mockPostMessage.mock.calls[0][0];
      const actionsBlock = call.blocks.find((b: any) => b.type === 'actions');
      const actionIds = actionsBlock.elements.map((e: any) => e.action_id);
      expect(actionIds).toContain('approve_draft');
      expect(actionIds).toContain('edit_then_approve_draft');
      expect(actionIds).toContain('reject_draft');
    });

    it('should not throw on API error', async () => {
      mockPostMessage.mockRejectedValue(new Error('channel_not_found'));

      await expect(
        service.postDraftCard('C-invalid', 'draft-001', 'summary'),
      ).resolves.toBeUndefined();
    });
  });

  describe('postJiraNotification()', () => {
    const jiraData = {
      issueKey: 'PROJ-123',
      summary: 'Fix login bug',
      status: 'In Progress',
      priority: 'High',
      assignee: 'John',
      changedFields: [
        { field: 'status', fromString: 'To Do', toString: 'In Progress' },
      ],
      eventType: 'jira:issue_updated',
    };

    it('should post Jira notification with field changes', async () => {
      await service.postJiraNotification('C123', jiraData);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: expect.stringContaining('PROJ-123'),
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
          ]),
        }),
      );
    });

    it('should include View in Jira button when URL is provided', async () => {
      await service.postJiraNotification(
        'C123',
        jiraData,
        'https://jira.example.com/browse/PROJ-123',
      );

      const call = mockPostMessage.mock.calls[0][0];
      const actionsBlock = call.blocks.find((b: any) => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock.elements[0].url).toBe(
        'https://jira.example.com/browse/PROJ-123',
      );
    });

    it('should not include actions block when no URL provided', async () => {
      await service.postJiraNotification('C123', jiraData);

      const call = mockPostMessage.mock.calls[0][0];
      const actionsBlock = call.blocks.find((b: any) => b.type === 'actions');
      expect(actionsBlock).toBeUndefined();
    });

    it('should handle empty changedFields', async () => {
      const dataNoChanges = { ...jiraData, changedFields: [] };

      await service.postJiraNotification('C123', dataNoChanges);

      const call = mockPostMessage.mock.calls[0][0];
      const changesBlock = call.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Changes'),
      );
      expect(changesBlock.text.text).toContain('No field changes');
    });

    it('should not throw on API error', async () => {
      mockPostMessage.mockRejectedValue(new Error('not_authed'));

      await expect(
        service.postJiraNotification('C123', jiraData),
      ).resolves.toBeUndefined();
    });
  });
});
