import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyScrumService } from '../../drafts/daily-scrum.service.js';
import { RetentionService } from '../retention.service.js';
import { JiraSnapshotSyncService } from './jira-snapshot-sync.service.js';

@Injectable()
export class ScheduleTasksService {
  private readonly logger = new Logger(ScheduleTasksService.name);

  constructor(
    private readonly dailyScrumService: DailyScrumService,
    private readonly retentionService: RetentionService,
    private readonly jiraSnapshotSync: JiraSnapshotSyncService,
  ) {}

  @Cron('0 0 9 * * 1-5', { timeZone: 'Asia/Seoul' })
  async triggerDailyScrum(): Promise<void> {
    this.logger.log('Scheduled: triggering daily scrum summaries (9AM KST Mon-Fri)');
    try {
      await this.dailyScrumService.generateDailySummaries();
      this.logger.log('Scheduled: daily scrum summaries completed');
    } catch (error) {
      this.logger.error(
        `Scheduled: daily scrum failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Cron('0 0 3 * * *', { timeZone: 'Asia/Seoul' })
  async triggerDataRetention(): Promise<void> {
    this.logger.log('Scheduled: triggering data retention cleanup (3AM KST daily)');
    try {
      const result = await this.retentionService.runRetentionPolicy();
      this.logger.log(
        `Scheduled: retention cleanup completed — ${result.deletedSlackEvents} events, ${result.deletedTokenLogs} token logs deleted`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled: retention cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Cron('0 0 */6 * * *')
  async triggerJiraSnapshotSync(): Promise<void> {
    this.logger.log('Scheduled: triggering Jira snapshot sync (every 6 hours)');
    try {
      const result = await this.jiraSnapshotSync.syncOpenIssues();
      this.logger.log(
        `Scheduled: Jira snapshot sync completed — ${result.upserted}/${result.total} issues synced`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled: Jira snapshot sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
