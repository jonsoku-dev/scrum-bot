import { Test, TestingModule } from '@nestjs/testing';
import { IngestService } from '../src/drafts/ingest.service';
import { DraftService } from '../src/drafts/draft.service';
import { ApprovalService } from '../src/drafts/approval.service';
import { PiiMaskingService } from '../src/shared/pii-masking.service';
import { RetrieverService } from '../src/drafts/retriever.service';
import { DRIZZLE } from '../src/shared/database/drizzle.provider';

describe('Full Flow: Slack → Draft → Approve (e2e)', () => {
  let module: TestingModule;
  let ingestService: IngestService;
  let draftService: DraftService;
  let approvalService: ApprovalService;

  const mockOnDuplicateKeyUpdate = jest.fn().mockResolvedValue(undefined);
  const mockValues = jest.fn().mockImplementation(() => {
    return { onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate };
  });

  const mockInsert = jest.fn().mockImplementation(() => {
    return { values: mockValues };
  });

  const mockSelectFrom = jest.fn();
  const mockSelect = jest.fn().mockReturnValue({ from: mockSelectFrom });

  const mockSetWhere = jest.fn().mockResolvedValue(undefined);
  const mockSet = jest.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet });

  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  };

  const mockPiiMasking: Partial<PiiMaskingService> = {
    mask: jest.fn().mockReturnValue({
      masked: 'safe meeting text',
      redactedCount: 0,
      redactedTypes: [],
    }),
    hasPii: jest.fn().mockReturnValue(false),
  };

  const mockRetriever: Partial<RetrieverService> = {
    ingestAndEmbed: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([]),
    embedText: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  };

  const mockSlackQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  function setupSelectReturn(data: unknown[]) {
    mockSelectFrom.mockImplementation(() => ({
      where: jest.fn().mockImplementation(() => {
        const p = Promise.resolve(data) as Promise<unknown[]> & { limit: jest.Mock };
        (p as unknown as Record<string, jest.Mock>).limit = jest.fn().mockResolvedValue(data);
        return p;
      }),
      orderBy: jest.fn().mockResolvedValue(data),
    }));
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        { provide: DRIZZLE, useValue: mockDb },
        { provide: PiiMaskingService, useValue: mockPiiMasking },
        { provide: RetrieverService, useValue: mockRetriever },
        { provide: 'BullQueue_slack', useValue: mockSlackQueue },
        IngestService,
        DraftService,
        ApprovalService,
      ],
    }).compile();

    ingestService = module.get(IngestService);
    draftService = module.get(DraftService);
    approvalService = module.get(ApprovalService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockImplementation(() => ({ values: mockValues }));
    mockValues.mockImplementation(() => ({ onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate }));
    mockOnDuplicateKeyUpdate.mockResolvedValue(undefined);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockSetWhere });
    mockSetWhere.mockResolvedValue(undefined);
    mockSelect.mockReturnValue({ from: mockSelectFrom });
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  const makeDraftFixture = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'draft-e2e-001',
    type: 'story',
    sourceEventIds: ['1700000000.000100'],
    content: { summary: 'Migrate to PostgreSQL', descriptionMd: 'Based on team decision' },
    status: 'pending',
    approvedBy: null,
    executedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdFrom: null,
    humanEditablePayload: null,
    committedIssueKey: null,
    ...overrides,
  });

  const makeApprovalFixture = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'appr-e2e-001',
    approvalType: 'JIRA_CREATE',
    status: 'PENDING',
    requestedBy: 'U-alice',
    requestedVia: 'SLACK',
    draftId: 'draft-e2e-001',
    expiresAt: null,
    decidedBy: null,
    decidedAt: null,
    slackActionPayload: null,
    createdAt: new Date(),
    ...overrides,
  });

  describe('Step 1: Ingest Slack message', () => {
    it('should process a Slack message and store a slack event', async () => {
      await ingestService.processMessage({
        channel: 'C-general',
        ts: '1700000000.000100',
        user: 'U-alice',
        text: 'We decided to migrate to PostgreSQL',
      });

      expect(mockPiiMasking.mask).toHaveBeenCalledWith(
        'We decided to migrate to PostgreSQL',
      );
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'C-general',
          messageTs: '1700000000.000100',
          userId: 'U-alice',
          text: 'safe meeting text',
        }),
      );
    });

    it('should call retriever.ingestAndEmbed for non-empty text', async () => {
      await ingestService.processMessage({
        channel: 'C-general',
        ts: '1700000000.000200',
        user: 'U-bob',
        text: 'Some important discussion',
      });

      expect(mockRetriever.ingestAndEmbed).toHaveBeenCalledWith(
        'safe meeting text',
        'SLACK_MESSAGE',
        '1700000000.000200',
      );
    });
  });

  describe('Step 2: Create a draft', () => {
    it('should create a draft with status=pending from ingested data', async () => {
      const fakeDraft = makeDraftFixture();
      setupSelectReturn([fakeDraft]);

      const result = await draftService.create({
        type: 'story',
        sourceEventIds: ['1700000000.000100'],
        content: { summary: 'Migrate to PostgreSQL', descriptionMd: 'Based on team decision' },
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.type).toBe('story');
      expect(result.content).toEqual(
        expect.objectContaining({ summary: 'Migrate to PostgreSQL' }),
      );
    });
  });

  describe('Step 3: Approve a draft', () => {
    it('should approve a pending draft and set status=approved', async () => {
      const approvedDraft = makeDraftFixture({ status: 'approved', approvedBy: 'U-manager' });
      setupSelectReturn([approvedDraft]);

      const result = await draftService.approve('draft-e2e-001', 'U-manager');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          approvedBy: 'U-manager',
        }),
      );
      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('U-manager');
    });
  });

  describe('Step 4: Create and approve an approval record', () => {
    it('should create an approval linked to a draft', async () => {
      const fakeApproval = makeApprovalFixture();
      setupSelectReturn([fakeApproval]);

      const approval = await approvalService.create({
        approvalType: 'JIRA_CREATE',
        requestedBy: 'U-alice',
        requestedVia: 'SLACK',
        draftId: 'draft-e2e-001',
      });

      expect(approval.status).toBe('PENDING');
      expect(approval.draftId).toBe('draft-e2e-001');
    });

    it('should approve the approval record', async () => {
      const approvedRecord = makeApprovalFixture({
        status: 'APPROVED',
        decidedBy: 'U-manager',
        decidedAt: new Date(),
      });
      setupSelectReturn([approvedRecord]);

      const result = await approvalService.approve('appr-e2e-001', 'U-manager');

      expect(result.status).toBe('APPROVED');
      expect(result.decidedBy).toBe('U-manager');
    });
  });

  describe('Full pipeline integration', () => {
    it('should flow from Slack message to Draft to Approval end to end', async () => {
      // given: a Slack message is ingested
      await ingestService.processMessage({
        channel: 'C-sprint',
        ts: '1700000001.000300',
        user: 'U-dev',
        text: 'We agreed to use Redis for caching',
      });
      expect(mockPiiMasking.mask).toHaveBeenCalled();
      expect(mockRetriever.ingestAndEmbed).toHaveBeenCalled();

      // when: a draft is created from the ingested data
      const draftData = makeDraftFixture({
        id: 'draft-flow-001',
        type: 'task',
        sourceEventIds: ['1700000001.000300'],
        content: { summary: 'Implement Redis caching layer' },
      });
      setupSelectReturn([draftData]);

      const draft = await draftService.create({
        type: 'task',
        sourceEventIds: ['1700000001.000300'],
        content: { summary: 'Implement Redis caching layer' },
      });
      expect(draft.status).toBe('pending');

      // then: approving it transitions status to approved
      const approvedDraft = { ...draftData, status: 'approved', approvedBy: 'U-lead' };
      setupSelectReturn([approvedDraft]);

      const approved = await draftService.approve('draft-flow-001', 'U-lead');
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('U-lead');
    });
  });
});
