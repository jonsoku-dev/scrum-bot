import { Module, forwardRef } from '@nestjs/common';
import { SlackEventsController } from './slack-events.controller.js';
import { SlackCommandsController } from './slack-commands.controller.js';
import { SlackActionsController } from './slack-actions.controller.js';
import { SlackNotificationService } from './slack-notification.service.js';
import { SlackProcessor } from '../shared/queue/slack.processor.js';
import { DraftsModule } from '../drafts/drafts.module.js';
import { JiraModule } from '../jira/jira.module.js';

@Module({
  imports: [forwardRef(() => DraftsModule), JiraModule],
  controllers: [
    SlackEventsController,
    SlackCommandsController,
    SlackActionsController,
  ],
  providers: [SlackNotificationService, SlackProcessor],
  exports: [SlackNotificationService],
})
export class SlackFeatureModule {}
