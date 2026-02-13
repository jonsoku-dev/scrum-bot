import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, START, END } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { CHECKPOINTER } from '../shared/database/checkpointer.provider.js';
import { ScrumState } from './state.js';
import { ClassifyNode } from './nodes/classify.node.js';
import { ExtractNode } from './nodes/extract.node.js';
import { RetrieveContextNode } from './nodes/retrieve-context.node.js';
import { GenerateDraftNode } from './nodes/generate-draft.node.js';
import { ApprovalNode } from './nodes/approval.node.js';
import { BizReviewNode } from './nodes/biz-review.node.js';
import { QaReviewNode } from './nodes/qa-review.node.js';
import { DesignReviewNode } from './nodes/design-review.node.js';
import { ConflictDetectNode } from './nodes/conflict-detect.node.js';
import { SynthesizeNode } from './nodes/synthesize.node.js';
import { CommitToJiraNode } from './nodes/commit-to-jira.node.js';
import { ContextGateNode } from './nodes/context-gate.node.js';

const DEFAULT_MAX_ITERATIONS = 25;

@Injectable()
export class GraphBuilderService {
  private readonly logger = new Logger(GraphBuilderService.name);
  private readonly maxIterations: number;

  constructor(
    @Inject(CHECKPOINTER) private readonly checkpointer: BaseCheckpointSaver,
    private readonly configService: ConfigService,
    private readonly classifyNode: ClassifyNode,
    private readonly extractNode: ExtractNode,
    private readonly retrieveContextNode: RetrieveContextNode,
    private readonly generateDraftNode: GenerateDraftNode,
    private readonly approvalNode: ApprovalNode,
    private readonly bizReviewNode: BizReviewNode,
    private readonly qaReviewNode: QaReviewNode,
    private readonly designReviewNode: DesignReviewNode,
    private readonly conflictDetectNode: ConflictDetectNode,
    private readonly synthesizeNode: SynthesizeNode,
    private readonly commitToJiraNode: CommitToJiraNode,
    private readonly contextGateNode: ContextGateNode,
  ) {
    this.maxIterations =
      this.configService.get<number>('MAX_GRAPH_ITERATIONS') ??
      DEFAULT_MAX_ITERATIONS;
    this.logger.log(`Graph recursion limit: ${this.maxIterations}`);
  }

  build() {
    const workflow = new StateGraph(ScrumState)
      .addNode(
        'classify',
        this.classifyNode.execute.bind(this.classifyNode),
      )
      .addNode(
        'retrieve_context',
        this.retrieveContextNode.execute.bind(this.retrieveContextNode),
      )
      .addNode(
        'extract',
        this.extractNode.execute.bind(this.extractNode),
      )
      .addNode(
        'context_gate',
        this.contextGateNode.execute.bind(this.contextGateNode),
      )
      .addNode(
        'biz_review',
        this.bizReviewNode.execute.bind(this.bizReviewNode),
      )
      .addNode(
        'qa_review',
        this.qaReviewNode.execute.bind(this.qaReviewNode),
      )
      .addNode(
        'design_review',
        this.designReviewNode.execute.bind(this.designReviewNode),
      )
      .addNode(
        'conflict_detect',
        this.conflictDetectNode.execute.bind(this.conflictDetectNode),
      )
      .addNode(
        'synthesize',
        this.synthesizeNode.execute.bind(this.synthesizeNode),
      )
      .addNode(
        'draft',
        this.generateDraftNode.execute.bind(this.generateDraftNode),
      )
      .addNode(
        'approval',
        this.approvalNode.execute.bind(this.approvalNode),
      )
      .addNode(
        'commit_to_jira',
        this.commitToJiraNode.invoke.bind(this.commitToJiraNode),
      )
      .addEdge(START, 'classify')
      .addEdge(START, 'retrieve_context')
      .addEdge('classify', 'extract')
      .addEdge('retrieve_context', 'extract')
      .addEdge('extract', 'context_gate')
      .addConditionalEdges(
        'context_gate',
        (state) => {
          if (state.control.abortReason) return 'draft';
          return ['biz_review', 'qa_review', 'design_review'];
        },
      )
      .addEdge('biz_review', 'conflict_detect')
      .addEdge('qa_review', 'conflict_detect')
      .addEdge('design_review', 'conflict_detect')
      .addEdge('conflict_detect', 'synthesize')
      .addEdge('synthesize', 'draft')
      .addEdge('draft', 'approval')
      .addConditionalEdges(
        'approval',
        (state) => (state.approved === true ? 'approved' : 'rejected'),
        { approved: 'commit_to_jira', rejected: END },
      )
      .addEdge('commit_to_jira', END);

    const compiled = workflow.compile({
      checkpointer: this.checkpointer,
    });

    return {
      graph: compiled,
      recursionLimit: this.maxIterations,
    };
  }
}
