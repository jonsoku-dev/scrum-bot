import { Injectable, Logger } from '@nestjs/common';
import { SlackService } from 'nestjs-slack-bolt';
import { types } from '@slack/bolt';

@Injectable()
export class SlackNotificationService {
  private readonly logger = new Logger(SlackNotificationService.name);

  constructor(private readonly slackService: SlackService) {}

  async fetchMessageText(channel: string, ts: string): Promise<string | null> {
    try {
      const result = await this.slackService.client.conversations.history({
        channel,
        latest: ts,
        inclusive: true,
        limit: 1,
      });
      return result.messages?.[0]?.text ?? null;
    } catch (err) {
      this.logger.error(
        `Failed to fetch message ${channel}/${ts}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async postMessage(channel: string, text: string): Promise<void> {
    try {
      await this.slackService.client.chat.postMessage({ channel, text });
    } catch (err) {
      this.logger.error(
        `Failed to post message: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async postDecisionCard(
    channel: string,
    title: string,
    confidence: number,
    decisionId: string,
    options?: {
      impactAreas?: string[];
      summary?: string;
      relatedTickets?: string[];
    },
  ): Promise<void> {
    const impactTags = (options?.impactAreas ?? [])
      .map((area) => `\`${area}\``)
      .join(' ');

    const relatedText = (options?.relatedTickets ?? [])
      .map((t) => `<${t}|${t.split('/').pop()}>`)
      .join(', ');

    const blocks: types.KnownBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Decision Detected', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Decision:*\n${title}` },
          { type: 'mrkdwn', text: `*Confidence:*\n${(confidence * 100).toFixed(0)}%` },
        ],
      },
    ];

    if (options?.summary) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Summary:*\n${options.summary.slice(0, 500)}` },
      });
    }

    if (impactTags) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `*Impact:* ${impactTags}` },
        ],
      });
    }

    if (relatedText) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `*Related Tickets:* ${relatedText}` },
        ],
      });
    }

    blocks.push(
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Jira Draft', emoji: true },
            style: 'primary',
            action_id: 'decision_create_jira_draft',
            value: decisionId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Record Decision', emoji: true },
            action_id: 'accept_decision',
            value: decisionId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Dismiss', emoji: true },
            action_id: 'dismiss_decision',
            value: decisionId,
          },
        ],
      },
    );

    try {
      await this.slackService.client.chat.postMessage({
        channel,
        text: `Decision Detected: ${title}`,
        blocks,
      });
    } catch (err) {
      this.logger.error(
        `Failed to post decision card: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async postDraftCard(
    channel: string,
    draftId: string,
    summaryText: string,
  ): Promise<void> {
    const blocks: types.KnownBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'New Draft Created' },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Summary*: ${summaryText.slice(0, 2000)}` },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: 'approve_draft',
            value: draftId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Edit & Approve' },
            action_id: 'edit_then_approve_draft',
            value: draftId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            action_id: 'reject_draft',
            value: draftId,
          },
        ],
      },
    ];

    try {
      await this.slackService.client.chat.postMessage({
        channel,
        text: `New Draft Created: ${summaryText.slice(0, 100)}`,
        blocks,
      });
    } catch (err) {
      this.logger.error(
        `Failed to post draft card: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async postJiraNotification(
    channelId: string,
    data: {
      issueKey: string;
      summary: string;
      status: string;
      priority: string;
      assignee: string | null;
      changedFields: Array<{ field: string; fromString: string | null; toString: string | null }>;
      eventType: string;
    },
    issueUrl?: string,
  ): Promise<void> {
    const changesText = data.changedFields.length > 0
      ? data.changedFields
          .map((c) => `\u2022 *${c.field}*: ${c.fromString ?? '_empty_'} \u2192 ${c.toString ?? '_empty_'}`)
          .join('\n')
      : '_No field changes_';

    const eventLabel = data.eventType.replace('jira:', '').replace(/_/g, ' ');

    const blocks: types.KnownBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${data.issueKey}: ${data.summary}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Event:*\n${eventLabel}` },
          { type: 'mrkdwn', text: `*Status:*\n${data.status || '_unknown_'}` },
          { type: 'mrkdwn', text: `*Priority:*\n${data.priority || '_unknown_'}` },
          { type: 'mrkdwn', text: `*Assignee:*\n${data.assignee ?? '_unassigned_'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Changes:*\n${changesText}` },
      },
    ];

    if (issueUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in Jira', emoji: true },
            url: issueUrl,
            action_id: 'jira_webhook_view_issue',
          },
        ],
      });
    }

    try {
      await this.slackService.client.chat.postMessage({
        channel: channelId,
        text: `[${data.eventType}] ${data.issueKey}: ${data.summary}`,
        blocks,
      });
    } catch (err) {
      this.logger.error(
        `Failed to post Jira notification to Slack: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
