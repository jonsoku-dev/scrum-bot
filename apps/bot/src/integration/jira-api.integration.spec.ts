import { JiraIssueService } from '../jira/jira-issue.service';
import { JiraClientService } from '../jira/jira-client.service';
import { JiraTransitionPolicyService } from '../jira/jira-transition-policy.service';
import { markdownToAdf } from '../jira/adf-converter';

describe('Jira API Integration', () => {
  let service: JiraIssueService;

  const syncLogStore: Array<Record<string, unknown>> = [];

  const mockSyncLogSelect = jest.fn();
  const mockSyncLogInsertValues = jest.fn().mockResolvedValue(undefined);
  const mockDb = {
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: jest.fn().mockReturnValue({
      values: mockSyncLogInsertValues,
    }),
  };

  const mockClient = {
    request: jest.fn(),
    baseUrl: 'https://jira.example.com',
  } as unknown as JiraClientService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const config: Record<string, string> = {
        JIRA_PROJECT_KEY: 'TEST',
        JIRA_BASE_URL: 'https://jira.example.com',
      };
      return config[key];
    }),
  };

  const mockTransitionPolicy = {
    findByTargetStatus: jest.fn().mockReturnValue(null),
    resolveTransitionId: jest.fn().mockReturnValue(null),
    listTransitions: jest.fn().mockReturnValue([]),
  } as unknown as JiraTransitionPolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    syncLogStore.length = 0;

    mockSyncLogInsertValues.mockImplementation(async (row: Record<string, unknown>) => {
      syncLogStore.push(row);
    });

    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValue([]),
        })),
      })),
    }));

    (mockClient.request as jest.Mock).mockResolvedValue({ key: 'TEST-1' });

    service = new JiraIssueService(
      mockDb as never,
      mockClient,
      mockConfigService as never,
      mockTransitionPolicy,
    );
  });

  describe('createIssue', () => {
    it('should call client.request with POST to /rest/api/3/issue', async () => {
      const result = await service.createIssue({
        summary: 'Test ticket',
        descriptionMd: 'Some description',
      });

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/rest/api/3/issue',
        }),
      );
      expect(result.jiraKey).toBe('TEST-1');
      expect(result.url).toBe('https://jira.example.com/browse/TEST-1');
    });

    it('should convert markdown description to ADF', async () => {
      await service.createIssue({
        summary: 'ADF test',
        descriptionMd: '- item one\n- item two',
      });

      const callArgs = (mockClient.request as jest.Mock).mock.calls[0][0];
      const description = callArgs.body.fields.description;

      expect(description.type).toBe('doc');
      expect(description.content[0].type).toBe('bulletList');
    });

    it('should verify ADF converter is called for description', async () => {
      const md = 'Simple paragraph\n- list item';
      const expectedAdf = markdownToAdf(md);

      await service.createIssue({
        summary: 'ADF verify',
        descriptionMd: md,
      });

      const callArgs = (mockClient.request as jest.Mock).mock.calls[0][0];
      expect(callArgs.body.fields.description).toEqual(expectedAdf);
    });

    it('should include optional fields (priority, labels) when provided', async () => {
      await service.createIssue({
        summary: 'Full ticket',
        descriptionMd: 'desc',
        priority: 'High',
        labels: ['backend', 'urgent'],
      });

      const callArgs = (mockClient.request as jest.Mock).mock.calls[0][0];
      expect(callArgs.body.fields.priority).toEqual({ name: 'High' });
      expect(callArgs.body.fields.labels).toEqual(['backend', 'urgent']);
    });
  });

  describe('createIssue deduplication', () => {
    it('should return existing key when content_hash matches', async () => {
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ jiraKey: 'TEST-EXISTING' }]),
          })),
        })),
      }));

      const result = await service.createIssue({
        summary: 'Duplicate ticket',
        descriptionMd: 'Same content',
      });

      expect(mockClient.request).not.toHaveBeenCalled();
      expect(result.jiraKey).toBe('TEST-EXISTING');
    });

    it('should create new issue when content_hash has no match', async () => {
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([]),
          })),
        })),
      }));

      const result = await service.createIssue({
        summary: 'New unique ticket',
        descriptionMd: 'Unique content',
      });

      expect(mockClient.request).toHaveBeenCalled();
      expect(result.jiraKey).toBe('TEST-1');
    });
  });

  describe('updateIssue', () => {
    it('should send only changed fields when updating', async () => {
      (mockClient.request as jest.Mock)
        .mockResolvedValueOnce({
          fields: {
            summary: 'Old summary',
            priority: { name: 'Low' },
            labels: ['old-label'],
            duedate: null,
          },
        })
        .mockResolvedValueOnce(undefined);

      const result = await service.updateIssue('TEST-1', {
        summary: 'New summary',
        priority: 'High',
      });

      expect(result.changed).toBe(true);

      const updateCall = (mockClient.request as jest.Mock).mock.calls[1][0];
      expect(updateCall.method).toBe('PUT');
      expect(updateCall.body.fields.summary).toBe('New summary');
      expect(updateCall.body.fields.priority).toEqual({ name: 'High' });
      expect(updateCall.body.fields.labels).toBeUndefined();
    });

    it('should skip update when no fields changed', async () => {
      (mockClient.request as jest.Mock).mockResolvedValueOnce({
        fields: {
          summary: 'Same summary',
          priority: { name: 'High' },
          labels: [],
          duedate: null,
        },
      });

      const result = await service.updateIssue('TEST-1', {
        summary: 'Same summary',
        priority: 'High',
      });

      expect(result.changed).toBe(false);
      expect((mockClient.request as jest.Mock).mock.calls).toHaveLength(1);
    });
  });
});
