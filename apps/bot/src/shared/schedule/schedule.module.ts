import { Module } from '@nestjs/common';
import { DraftsModule } from '../../drafts/drafts.module.js';
import { JiraModule } from '../../jira/jira.module.js';
import { ScheduleTasksService } from './schedule-tasks.service.js';
import { JiraSnapshotSyncService } from './jira-snapshot-sync.service.js';

@Module({
  imports: [DraftsModule, JiraModule],
  providers: [ScheduleTasksService, JiraSnapshotSyncService],
})
export class AppScheduleModule {}
