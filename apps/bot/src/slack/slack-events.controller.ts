import { Controller, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Message, Event } from 'nestjs-slack-bolt';
import { DecisionDetectionService } from '../drafts/decision-detection.service.js';
import { DecisionService } from '../drafts/decision.service.js';
import { DraftService } from '../drafts/draft.service.js';
import { SlackNotificationService } from './slack-notification.service.js';
import { ChannelPolicyService } from '../shared/channel-policy.service.js';
import { SLACK_QUEUE } from '../shared/queue/queue.module.js';
import type { SlackJobData } from '../shared/queue/slack.processor.js';

interface SlackMessagePayload {
  channel: string;
  ts: string;
  thread_ts?: string;
  user?: string;
  text?: string;
}

@Controller()
export class SlackEventsController {
  private readonly logger = new Logger(SlackEventsController.name);

  constructor(
    @InjectQueue(SLACK_QUEUE) private readonly slackQueue: Queue<SlackJobData>,
    private readonly decisionDetectionService: DecisionDetectionService,
    private readonly decisionService: DecisionService,
    private readonly draftService: DraftService,
    private readonly slackNotification: SlackNotificationService,
    private readonly channelPolicy: ChannelPolicyService,
  ) {}

  @Message(/.*/)
  async onMessage({ message }: { message: Record<string, unknown> }) {
    if ('subtype' in message && message.subtype === 'bot_message') return;

    const channel = message.channel;
    const ts = message.ts;
    if (typeof channel !== 'string' || typeof ts !== 'string') {
      this.logger.warn('Slack message missing required channel/ts fields');
      return;
    }
    const msg: SlackMessagePayload = {
      channel,
      ts,
      thread_ts: typeof message.thread_ts === 'string' ? message.thread_ts : undefined,
      user: typeof message.user === 'string' ? message.user : undefined,
      text: typeof message.text === 'string' ? message.text : undefined,
    };

    try {
      await this.slackQueue.add(
        'ingest',
        {
          channel: msg.channel,
          ts: msg.ts,
          text: msg.text ?? '',
          userId: msg.user,
          threadTs: msg.thread_ts,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    } catch (queueError) {
      this.logger.error(
        `Failed to enqueue Slack ingest for ${msg.channel}/${msg.ts}: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
      );
    }

    const text = msg.text ?? '';
    if (!text) return;

    const decisionEnabled = await this.channelPolicy.isEnabled(
      msg.channel,
      'enableDecisionDetection',
    );
    if (!decisionEnabled) return;

    const result = this.decisionDetectionService.detectDecision(text);

    if (result.isDecision) {
      await this.handleDetectedDecision(
        msg.channel,
        msg.ts,
        msg.user ?? 'unknown',
        result.extractedTitle,
        result.confidence,
        result.signals,
      );
    }
  }

  @Event('reaction_added')
  async onReaction({
    event,
  }: {
    event: {
      reaction: string;
      item: { ts: string; channel: string };
      user: string;
    };
  }) {
    const messageText = await this.slackNotification.fetchMessageText(
      event.item.channel,
      event.item.ts,
    );
    if (!messageText) return;

    const result = this.decisionDetectionService.detectDecision(
      messageText,
      [event.reaction],
    );

    if (result.isDecision) {
      await this.handleDetectedDecision(
        event.item.channel,
        event.item.ts,
        event.user,
        result.extractedTitle,
        result.confidence,
        result.signals,
      );
    } else {
      this.logger.debug(
        `Decision signal in ${event.item.channel}/${event.item.ts}: confidence=${result.confidence}`,
      );
    }
  }

  private async handleDetectedDecision(
    channel: string,
    messageTs: string,
    userId: string,
    title: string,
    confidence: number,
    signals: string[],
  ): Promise<void> {
    const sourceRef = `${channel}:${messageTs}`;

    const draft = await this.draftService.create({
      type: 'decision',
      sourceEventIds: [sourceRef],
      content: { title, confidence, signals },
    });

    const decision = await this.decisionService.create({
      draftId: draft.id,
      content: { title, confidence, signals },
      decidedBy: userId,
      sourceRefs: [sourceRef],
    });

    this.logger.log(
      `Decision detected (id=${decision.id}, confidence=${confidence}): ${title}`,
    );

    await this.slackNotification.postDecisionCard(channel, title, confidence, decision.id);
  }
}
