import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SummarizeService } from './summarize.service.js';
import { SlackNotificationService } from '../slack/slack-notification.service.js';

@Injectable()
export class DailyScrumService {
  private readonly logger = new Logger(DailyScrumService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly summarizeService: SummarizeService,
    private readonly slackNotificationService: SlackNotificationService,
  ) {}

  @Cron('0 9 * * 1-5')
  async generateDailySummaries(): Promise<void> {
    this.logger.log('Starting daily scrum summary generation');
    await this.generateSummaries('daily');
  }

  @Cron('0 9 * * 1')
  async generateWeeklySummaries(): Promise<void> {
    this.logger.log('Starting weekly scrum summary generation');
    await this.generateSummaries('weekly');
  }

  private async generateSummaries(type: 'daily' | 'weekly'): Promise<void> {
    const channelsConfig = this.configService.get<string>('DAILY_SCRUM_CHANNELS');
    if (!channelsConfig) {
      this.logger.warn('DAILY_SCRUM_CHANNELS not configured, skipping scrum');
      return;
    }

    const channelIds = channelsConfig
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (channelIds.length === 0) {
      this.logger.warn('No channel IDs found in DAILY_SCRUM_CHANNELS');
      return;
    }

    const messageCount = type === 'weekly' ? 200 : 50;
    this.logger.log(`Processing ${channelIds.length} channel(s) for ${type} summary`);

    for (const channelId of channelIds) {
      try {
        this.logger.log(`Generating ${type} summary for channel: ${channelId}`);

        const result = await this.summarizeService.summarizeChannel(channelId, messageCount);

        const summaryMessage = this.formatSummaryMessage(type, result);

        await this.slackNotificationService.postMessage(channelId, summaryMessage);

        this.logger.log(
          `Successfully posted ${type} summary to channel ${channelId} (${result.messageCount} messages, ${result.actions.length} actions)`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate/post ${type} summary for channel ${channelId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(`${type} scrum summary generation completed`);
  }

  private formatSummaryMessage(
    type: 'daily' | 'weekly',
    result: {
      summary: string;
      messageCount: number;
      actions: Array<{ type: string; description: string; assignee?: string }>;
    },
  ): string {
    const emoji = type === 'weekly' ? ':bar_chart:' : ':clipboard:';
    const title = type === 'weekly' ? 'Weekly Scrum Summary' : 'Daily Scrum Summary';

    const lines: string[] = [
      `${emoji} *${title}*`,
      '',
      result.summary,
      '',
      `_Analyzed ${result.messageCount} message(s)_`,
    ];

    if (result.actions.length > 0) {
      lines.push('', '*Action Items:*');
      result.actions.forEach((action, idx) => {
        const assigneeText = action.assignee ? ` (@${action.assignee})` : '';
        lines.push(`${idx + 1}. ${action.description}${assigneeText}`);
      });
    }

    return lines.join('\n');
  }
}
