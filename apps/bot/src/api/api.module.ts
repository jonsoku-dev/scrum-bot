import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { SummariesController } from './summaries.controller.js';
import { HealthController } from './health.controller.js';
import { DraftsController } from './drafts.controller.js';
import { DecisionsController } from './decisions.controller.js';
import { RunsController } from './runs.controller.js';
import { CostController } from './cost.controller.js';
import { JiraWebhookController } from './jira-webhook.controller.js';
import { MeetingsController } from './meetings.controller.js';
import { SettingsController } from './settings.controller.js';
import { EvaluationsController } from './evaluations.controller.js';
import { MetricsController } from './metrics.controller.js';
import { DraftsModule } from '../drafts/drafts.module.js';
import { JiraModule } from '../jira/jira.module.js';
import { SlackFeatureModule } from '../slack/slack-feature.module.js';

@Module({
  imports: [DraftsModule, JiraModule, SlackFeatureModule],
  controllers: [
    EventsController,
    SummariesController,
    HealthController,
    DraftsController,
    DecisionsController,
    RunsController,
    CostController,
    JiraWebhookController,
    MeetingsController,
    SettingsController,
    EvaluationsController,
    MetricsController,
  ],
})
export class ApiModule {}
