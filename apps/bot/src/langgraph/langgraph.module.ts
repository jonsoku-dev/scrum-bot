import { Module, forwardRef } from '@nestjs/common';
import { LlmService } from './llm.service.js';
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
import { GraphBuilderService } from './graph-builder.service.js';
import { JiraModule } from '../jira/jira.module.js';
import { DraftsModule } from '../drafts/drafts.module.js';

const nodes = [
  ClassifyNode,
  ExtractNode,
  RetrieveContextNode,
  GenerateDraftNode,
  ApprovalNode,
  BizReviewNode,
  QaReviewNode,
  DesignReviewNode,
  ConflictDetectNode,
  SynthesizeNode,
  CommitToJiraNode,
  ContextGateNode,
];

@Module({
  imports: [JiraModule, forwardRef(() => DraftsModule)],
  providers: [LlmService, ...nodes, GraphBuilderService],
  exports: [GraphBuilderService],
})
export class LangGraphModule {}
