import { Annotation } from '@langchain/langgraph';

export interface SourceRef {
  type: string;
  url: string;
  id: string;
}

export const ScrumState = Annotation.Root({
  input: Annotation<{
    type: 'slack_message' | 'manual' | 'meeting';
    text: string;
    channelId: string;
    sourceRefs: SourceRef[];
  }>(),
  classification: Annotation<{
    intent: 'decision' | 'action_item' | 'discussion' | 'question';
    confidence: number;
    sourceEvidence: string[];
  } | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  actions: Annotation<
    Array<{
      type: string;
      description: string;
      assignee?: string;
    }>
  >({
    reducer: (_, b) => b,
    default: () => [],
  }),
  summary: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  draft: Annotation<Record<string, unknown> | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  reviews: Annotation<{
    biz: Record<string, unknown> | null;
    qa: Record<string, unknown> | null;
    design: Record<string, unknown> | null;
  }>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ biz: null, qa: null, design: null }),
  }),
  conflicts: Annotation<
    Array<{ between: string; topic: string; resolutionProposal: string }>
  >({
    reducer: (_, b) => b,
    default: () => [],
  }),
  citations: Annotation<SourceRef[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  control: Annotation<{
    iteration: number;
    maxIteration: number;
    abortReason?: string;
  }>({
    reducer: (_, b) => b,
    default: () => ({ iteration: 0, maxIteration: 5 }),
  }),
  approved: Annotation<boolean | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  approval: Annotation<{ status: string; id?: string } | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  jiraResult: Annotation<
    { issueKey?: string; url?: string; error?: string } | null
  >({
    reducer: (_, b) => b,
    default: () => null,
  }),
  retrievedContext: Annotation<
    Array<{ content: string; similarity: number; sourceId: string }>
  >({
    reducer: (_, b) => b,
    default: () => [],
  }),
});

export type ScrumStateType = typeof ScrumState.State;
export type ScrumStateUpdate = typeof ScrumState.Update;
