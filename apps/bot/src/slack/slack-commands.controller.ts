import { Controller, Logger } from '@nestjs/common';
import { Command } from 'nestjs-slack-bolt';
import { SummarizeService } from '../drafts/summarize.service.js';
import { DraftService } from '../drafts/draft.service.js';
import { SlackNotificationService } from './slack-notification.service.js';

@Controller()
export class SlackCommandsController {
  private readonly logger = new Logger(SlackCommandsController.name);

  constructor(
    private readonly summarizeService: SummarizeService,
    private readonly draftService: DraftService,
    private readonly slackNotification: SlackNotificationService,
  ) {}

  @Command('/scrum')
  async summarize({
    command,
    ack,
    say,
  }: {
    command: { channel_id: string };
    ack: () => Promise<void>;
    say: (msg: { text: string }) => Promise<void>;
  }) {
    await ack();
    try {
      const result = await this.summarizeService.summarizeChannel(
        command.channel_id,
      );
      await say({ text: result.summary });
    } catch (err) {
      this.logger.error(
        `Failed to generate summary: ${err instanceof Error ? err.message : String(err)}`,
      );
      await say({ text: 'Failed to generate summary. Please try again.' });
    }
  }

  @Command('/scrum-draft')
  async createDraft({
    command,
    ack,
    say,
  }: {
    command: { channel_id: string; text?: string };
    ack: () => Promise<void>;
    say: (msg: { text: string }) => Promise<void>;
  }) {
    await ack();
    try {
      const result = await this.summarizeService.summarizeChannel(
        command.channel_id,
      );

      const draft = await this.draftService.create({
        type: 'jira_ticket',
        sourceEventIds: [],
        content: {
          summary: result.summary,
          descriptionMd: result.summary,
          actions: result.actions,
        },
      });

      await this.slackNotification.postDraftCard(command.channel_id, draft.id, result.summary);
    } catch (err) {
      this.logger.error(
        `Failed to create draft: ${err instanceof Error ? err.message : String(err)}`,
      );
      await say({ text: 'Failed to create draft. Please try again.' });
    }
  }

  @Command('/scrum-review')
  async review({
    command,
    ack,
    say,
  }: {
    command: { channel_id: string; text?: string };
    ack: () => Promise<void>;
    say: (msg: { text: string }) => Promise<void>;
  }) {
    await ack();

    const proposalText = command.text?.trim();
    if (!proposalText) {
      await say({
        text: 'Usage: `/scrum-review [proposal text]` — Provide the text you want reviewed by Biz/QA/Design agents.',
      });
      return;
    }

    try {
      await say({
        text: 'Starting multi-agent review... This may take a moment.',
      });

      const result =
        await this.summarizeService.processMeetingMinutes(
          'Scrum Review Request',
          proposalText,
        );

      const reviewLines: string[] = [
        '*Multi-Agent Review Complete*',
        '',
        `*Summary:* ${result.summary}`,
      ];

      if (result.actions.length > 0) {
        reviewLines.push('', '*Action Items:*');
        result.actions.forEach((action, idx) => {
          const assignee = action.assignee ? ` (@${action.assignee})` : '';
          reviewLines.push(`${idx + 1}. [${action.type}] ${action.description}${assignee}`);
        });
      }

      reviewLines.push('', `_Summary ID: ${result.summaryId}_`);

      await say({ text: reviewLines.join('\n') });
    } catch (err) {
      this.logger.error(
        `Failed to run review: ${err instanceof Error ? err.message : String(err)}`,
      );
      await say({
        text: 'Failed to run review. Please try again.',
      });
    }
  }
}
