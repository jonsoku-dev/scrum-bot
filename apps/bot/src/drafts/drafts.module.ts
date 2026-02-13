import { Module, forwardRef } from '@nestjs/common';
import { LangGraphModule } from '../langgraph/langgraph.module.js';
import { IngestService } from './ingest.service.js';
import { SummarizeService } from './summarize.service.js';
import { DraftService } from './draft.service.js';
import { DecisionDetectionService } from './decision-detection.service.js';
import { AgentRunService } from './agent-run.service.js';
import { DecisionService } from './decision.service.js';
import { RetrieverService } from './retriever.service.js';
import { ApprovalService } from './approval.service.js';
import { DailyScrumService } from './daily-scrum.service.js';
import { SlackFeatureModule } from '../slack/slack-feature.module.js';

@Module({
  imports: [forwardRef(() => LangGraphModule), forwardRef(() => SlackFeatureModule)],
  providers: [
    IngestService,
    SummarizeService,
    DraftService,
    DecisionDetectionService,
    AgentRunService,
    DecisionService,
    RetrieverService,
    ApprovalService,
    DailyScrumService,
  ],
  exports: [
    IngestService,
    SummarizeService,
    DraftService,
    DecisionDetectionService,
    AgentRunService,
    DecisionService,
    RetrieverService,
    ApprovalService,
  ],
})
export class DraftsModule {}
