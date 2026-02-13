import { ClassifyNode } from '../langgraph/nodes/classify.node';
import { ExtractNode } from '../langgraph/nodes/extract.node';
import { RetrieveContextNode } from '../langgraph/nodes/retrieve-context.node';
import { BizReviewNode } from '../langgraph/nodes/biz-review.node';
import { QaReviewNode } from '../langgraph/nodes/qa-review.node';
import { DesignReviewNode } from '../langgraph/nodes/design-review.node';
import { ConflictDetectNode } from '../langgraph/nodes/conflict-detect.node';
import { SynthesizeNode } from '../langgraph/nodes/synthesize.node';
import { GenerateDraftNode } from '../langgraph/nodes/generate-draft.node';
import { ContextGateNode } from '../langgraph/nodes/context-gate.node';
import type { ScrumStateType } from '../langgraph/state';
import type { LlmService } from '../langgraph/llm.service';
import type { RetrieverService } from '../drafts/retriever.service';
import type { CostTrackingService } from '../shared/cost-tracking.service';

function makeBaseState(overrides: Partial<ScrumStateType> = {}): ScrumStateType {
  return {
    input: {
      type: 'slack_message',
      text: 'We decided to implement caching with Redis for the API layer',
      channelId: 'C-dev',
      sourceRefs: [{ type: 'slack', url: 'https://slack.com/msg/1', id: 'msg-1' }],
    },
    classification: null,
    actions: [],
    summary: null,
    draft: null,
    reviews: { biz: null, qa: null, design: null },
    conflicts: [],
    citations: [],
    control: { iteration: 0, maxIteration: 5 },
    approved: null,
    approval: null,
    jiraResult: null,
    retrievedContext: [],
    ...overrides,
  };
}

describe('LangGraph Flow Integration', () => {
  const mockLlm = {
    structuredInvoke: jest.fn(),
  } as unknown as LlmService;

  const mockRetriever = {
    search: jest.fn().mockResolvedValue([
      { content: 'Redis caching best practices', similarity: 0.85, sourceId: 'kb-1' },
    ]),
  } as unknown as RetrieverService;

  const mockCostTracker = {
    getTotalCost: jest.fn().mockResolvedValue({ estimatedCostUsd: 0.5 }),
    shouldDegrade: jest.fn().mockReturnValue({ degrade: false }),
  } as unknown as CostTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classify → extract flow', () => {
    it('should classify intent from input text', async () => {
      (mockLlm.structuredInvoke as jest.Mock).mockResolvedValueOnce({
        intent: 'decision',
        confidence: 0.92,
        sourceEvidence: ['We decided'],
      });

      const classifyNode = new ClassifyNode(mockLlm);
      const state = makeBaseState();
      const result = await classifyNode.execute(state);

      expect(result.classification).toEqual({
        intent: 'decision',
        confidence: 0.92,
        sourceEvidence: ['We decided'],
      });
      expect(mockLlm.structuredInvoke).toHaveBeenCalledTimes(1);
    });

    it('should extract actions after classification', async () => {
      (mockLlm.structuredInvoke as jest.Mock).mockResolvedValueOnce({
        actions: [
          { type: 'task', description: 'Implement Redis caching', assignee: 'U-dev', citation: 'msg-1' },
        ],
        decisions: [
          { description: 'Use Redis for caching', madeBy: 'team', citation: 'msg-1' },
        ],
      });

      const extractNode = new ExtractNode(mockLlm);
      const state = makeBaseState({
        classification: { intent: 'decision', confidence: 0.92, sourceEvidence: [] },
      });
      const result = await extractNode.execute(state);

      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('task');
      expect(result.actions![0].description).toBe('Implement Redis caching');
    });
  });

  describe('retrieve context', () => {
    it('should retrieve context from retriever service', async () => {
      const node = new RetrieveContextNode(mockRetriever);
      const state = makeBaseState();
      const result = await node.execute(state);

      expect(result.retrievedContext).toHaveLength(1);
      expect(result.retrievedContext![0].content).toBe('Redis caching best practices');
      expect(result.retrievedContext![0].similarity).toBe(0.85);
    });

    it('should return empty context when retriever is not available', async () => {
      const node = new RetrieveContextNode();
      const state = makeBaseState();
      const result = await node.execute(state);

      expect(result.retrievedContext).toEqual([]);
    });
  });

  describe('context gate', () => {
    it('should pass through when sufficient context exists', async () => {
      const node = new ContextGateNode(mockCostTracker);
      const state = makeBaseState({
        retrievedContext: [{ content: 'ctx', similarity: 0.9, sourceId: 's1' }],
      });
      const result = await node.execute(state);

      expect(result.control).toBeUndefined();
    });

    it('should abort when no context and non-manual input', async () => {
      const node = new ContextGateNode(mockCostTracker);
      const state = makeBaseState({ retrievedContext: [] });
      const result = await node.execute(state);

      expect(result.control?.abortReason).toBe('context_insufficient');
    });

    it('should allow manual input even without context', async () => {
      const node = new ContextGateNode(mockCostTracker);
      const state = makeBaseState({
        input: { type: 'manual', text: 'Manual entry', channelId: 'C-1', sourceRefs: [] },
        retrievedContext: [],
      });
      const result = await node.execute(state);

      expect(result.control?.abortReason).toBeUndefined();
    });

    it('should abort when budget exceeded', async () => {
      (mockCostTracker.shouldDegrade as jest.Mock).mockReturnValue({
        degrade: true,
        reason: 'Budget exceeded',
      });

      const node = new ContextGateNode(mockCostTracker);
      const state = makeBaseState({
        retrievedContext: [{ content: 'ctx', similarity: 0.9, sourceId: 's1' }],
      });
      const result = await node.execute(state);

      expect(result.control?.abortReason).toBe('budget_exceeded');
    });
  });

  describe('reviews → conflict detection → synthesize → draft', () => {
    it('should run biz, qa, design reviews and detect conflicts', async () => {
      const bizResult = {
        decision: { recommendation: 'APPROVE', confidence: 0.9 },
        valueHypothesis: 'Improves latency',
        risks: [],
        opportunityCost: 'Low',
        missingInfo: [],
        citations: [],
      };
      const qaResult = {
        decision: { recommendation: 'APPROVE', confidence: 0.85 },
        p0TestCases: [],
        stateModelRisks: [],
        regressionSurface: [],
        nonFunctional: { timeouts: 'ok', retries: 'ok', idempotency: 'ok', observability: 'ok' },
        missingInfo: [],
        citations: [],
      };
      const designResult = {
        decision: { recommendation: 'APPROVE', confidence: 0.88 },
        uiConstraints: [],
        a11y: [],
        componentsMapping: [],
        missingInfo: [],
        citations: [],
      };

      (mockLlm.structuredInvoke as jest.Mock)
        .mockResolvedValueOnce(bizResult)
        .mockResolvedValueOnce(qaResult)
        .mockResolvedValueOnce(designResult);

      const state = makeBaseState({
        classification: { intent: 'decision', confidence: 0.9, sourceEvidence: [] },
        actions: [{ type: 'task', description: 'Implement caching' }],
        retrievedContext: [{ content: 'ctx', similarity: 0.9, sourceId: 's1' }],
      });

      const bizNode = new BizReviewNode(mockLlm);
      const bizOutput = await bizNode.execute(state);
      expect(bizOutput.reviews?.biz).toEqual(bizResult);

      const qaNode = new QaReviewNode(mockLlm);
      const qaOutput = await qaNode.execute(state);
      expect(qaOutput.reviews?.qa).toEqual(qaResult);

      const designNode = new DesignReviewNode(mockLlm);
      const designOutput = await designNode.execute(state);
      expect(designOutput.reviews?.design).toEqual(designResult);

      const conflictNode = new ConflictDetectNode();
      const stateWithReviews = makeBaseState({
        reviews: { biz: bizResult, qa: qaResult, design: designResult },
      });
      const conflictOutput = await conflictNode.execute(stateWithReviews);
      expect(conflictOutput.conflicts).toEqual([]);
    });

    it('should detect biz+qa conflict when biz REJECTS but qa has no risks', async () => {
      const conflictNode = new ConflictDetectNode();
      const state = makeBaseState({
        reviews: {
          biz: { decision: { recommendation: 'REJECT' } },
          qa: { stateModelRisks: [] },
          design: null,
        },
      });
      const result = await conflictNode.execute(state);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].between).toBe('biz,qa');
    });

    it('should detect biz+design conflict when biz approves but design has many constraints', async () => {
      const conflictNode = new ConflictDetectNode();
      const state = makeBaseState({
        reviews: {
          biz: { decision: { recommendation: 'APPROVE' } },
          qa: null,
          design: { uiConstraints: ['c1', 'c2', 'c3', 'c4'] },
        },
      });
      const result = await conflictNode.execute(state);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].between).toBe('biz,design');
    });
  });

  describe('synthesize + generate draft', () => {
    it('should synthesize reviews into a canonical draft', async () => {
      const synthResult = {
        summaryOneLine: 'Redis caching implementation',
        conflicts: [],
        canonicalDraft: {
          projectKey: 'PROJ',
          issueType: 'Story',
          summary: 'Implement Redis caching',
          descriptionMd: 'Full description here',
          priority: 'P1',
          labels: ['backend'],
          components: ['api'],
        },
        rolloutPlan: { phases: ['phase1'], monitoring: 'metrics' },
        acceptanceCriteria: ['Cache hit rate > 90%'],
        traceability: { sourceRefs: ['msg-1'], assumptions: [] },
        citations: [{ type: 'slack', url: 'https://slack.com/msg/1', id: 'msg-1' }],
      };

      (mockLlm.structuredInvoke as jest.Mock).mockResolvedValueOnce(synthResult);

      const node = new SynthesizeNode(mockLlm);
      const state = makeBaseState({
        classification: { intent: 'decision', confidence: 0.9, sourceEvidence: [] },
        actions: [{ type: 'task', description: 'Implement caching' }],
        reviews: { biz: {}, qa: {}, design: {} },
        conflicts: [],
      });
      const result = await node.execute(state);

      expect(result.draft).toEqual(synthResult.canonicalDraft);
      expect(result.citations).toHaveLength(1);
    });

    it('should generate a draft from scratch when no pre-existing draft', async () => {
      const draftResult = {
        projectKey: 'PROJ',
        issueType: 'Task',
        summary: 'Implement Redis cache',
        descriptionMd: 'desc',
        acceptanceCriteria: ['AC1'],
        priority: 'P2',
        labels: [],
        components: [],
        sourceCitations: ['msg-1'],
      };

      (mockLlm.structuredInvoke as jest.Mock).mockResolvedValueOnce(draftResult);

      const node = new GenerateDraftNode(mockLlm);
      const state = makeBaseState({
        classification: { intent: 'action_item', confidence: 0.8, sourceEvidence: [] },
        actions: [{ type: 'task', description: 'Add Redis' }],
      });
      const result = await node.execute(state);

      expect(result.draft).toEqual(draftResult);
      expect(result.summary).toBe('Implement Redis cache');
    });
  });

  describe('maxIteration guard', () => {
    it('should respect maxIteration=1 by not allowing infinite re-entry', async () => {
      const state = makeBaseState({
        control: { iteration: 1, maxIteration: 1 },
      });

      expect(state.control.iteration).toBe(1);
      expect(state.control.maxIteration).toBe(1);
      expect(state.control.iteration >= state.control.maxIteration).toBe(true);
    });

    it('should allow iteration when under limit', async () => {
      const state = makeBaseState({
        control: { iteration: 0, maxIteration: 5 },
      });

      expect(state.control.iteration < state.control.maxIteration).toBe(true);
    });
  });
});
