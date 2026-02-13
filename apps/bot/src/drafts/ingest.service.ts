import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { slackEvents } from '../shared/database/schema.js';
import { PiiMaskingService } from '../shared/pii-masking.service.js';
import { ChannelPolicyService } from '../shared/channel-policy.service.js';
import { RetrieverService } from './retriever.service.js';
import { SLACK_QUEUE } from '../shared/queue/queue.module.js';
import type { SlackJobData } from '../shared/queue/slack.processor.js';

interface SlackMessagePayload {
  channel: string;
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  subtype?: string;
  permalink?: string;
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue(SLACK_QUEUE) private readonly slackQueue: Queue<SlackJobData>,
    private readonly piiMasking: PiiMaskingService,
    private readonly channelPolicy: ChannelPolicyService,
    private readonly retriever: RetrieverService,
  ) {}

  async processMessage(message: SlackMessagePayload): Promise<void> {
    const summaryEnabled = await this.channelPolicy.isEnabled(message.channel, 'enableSummary');
    if (!summaryEnabled) {
      this.logger.debug(`Channel ${message.channel} ingest disabled by policy`);
      return;
    }

    let maskedText = message.text ?? null;

    if (maskedText) {
      const result = this.piiMasking.mask(maskedText);
      maskedText = result.masked;
      if (result.redactedCount > 0) {
        this.logger.warn(
          `PII detected in message ${message.ts}: ${result.redactedCount} item(s) redacted [${result.redactedTypes.join(', ')}]`,
        );
      }
    }

    try {
      await this.db
        .insert(slackEvents)
        .values({
          channelId: message.channel,
          messageTs: message.ts,
          threadTs: message.thread_ts ?? null,
          userId: message.user ?? null,
          eventType: 'message',
          text: maskedText,
          permalink: message.permalink ?? null,
          rawPayload: message,
        })
        .onDuplicateKeyUpdate({
          set: { eventType: 'message' },
        });

      this.logger.debug(
        `Stored message ${message.ts} from channel ${message.channel}`,
      );
    } catch (dbError) {
      this.logger.error(
        `DB failure for message ${message.ts} — enqueueing for retry: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      );

      await this.slackQueue.add(
        'db-fallback-retry',
        {
          channel: message.channel,
          ts: message.ts,
          text: maskedText ?? '',
          userId: message.user,
          threadTs: message.thread_ts,
          permalink: message.permalink,
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 200,
        },
      );
      return;
    }

    if (maskedText) {
      try {
        await this.retriever.ingestAndEmbed(
          maskedText,
          'SLACK_MESSAGE',
          message.ts,
        );
      } catch (embedError) {
        this.logger.warn(
          `Failed to embed context chunk for ${message.ts}: ${embedError instanceof Error ? embedError.message : String(embedError)}`,
        );
      }
    }
  }
}
