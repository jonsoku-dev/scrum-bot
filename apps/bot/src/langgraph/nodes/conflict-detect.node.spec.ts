import { ConflictDetectNode } from './conflict-detect.node';
import type { ScrumStateType } from '../state';

function createState(overrides: Partial<ScrumStateType> = {}): ScrumStateType {
  return {
    input: { type: 'manual', text: 'test', channelId: 'C123', sourceRefs: [] },
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

describe('ConflictDetectNode', () => {
  let node: ConflictDetectNode;

  beforeEach(() => {
    node = new ConflictDetectNode();
  });

  it('should detect conflict when biz REJECT but qa has no risks', async () => {
    const state = createState({
      reviews: {
        biz: { decision: { recommendation: 'REJECT' } },
        qa: { stateModelRisks: [] },
        design: null,
      },
    });

    const result = await node.execute(state);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts![0].between).toBe('biz,qa');
  });

  it('should detect conflict when biz APPROVE but design has 4+ constraints', async () => {
    const state = createState({
      reviews: {
        biz: { decision: { recommendation: 'APPROVE' } },
        qa: null,
        design: { uiConstraints: ['a', 'b', 'c', 'd'] },
      },
    });

    const result = await node.execute(state);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts![0].between).toBe('biz,design');
  });

  it('should return no conflicts when all reviews agree', async () => {
    const state = createState({
      reviews: {
        biz: { decision: { recommendation: 'APPROVE' } },
        qa: { stateModelRisks: [{ risk: 'low' }] },
        design: { uiConstraints: ['a'] },
      },
    });

    const result = await node.execute(state);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should return no conflicts when reviews are null', async () => {
    const state = createState();
    const result = await node.execute(state);
    expect(result.conflicts).toHaveLength(0);
  });
});
