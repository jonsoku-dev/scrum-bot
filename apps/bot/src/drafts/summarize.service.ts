import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { slackEvents, summaries } from '../shared/database/schema.js';
import { GraphBuilderService } from '../langgraph/graph-builder.service.js';
import { createSpan, endSpan } from '../shared/tracing.js';
import { PiiMaskingService } from '../shared/pii-masking.service.js';
import { EvalService } from '../shared/eval.service.js';
import { AppException } from '../shared/exceptions/app.exception.js';
import { MetricsService } from '../shared/metrics.service.js';

export interface SummarizeResult {
  summary: string;
  channelId: string;
  messageCount: number;
  actions: Array<{ type: string; description: string; assignee?: string }>;
}

@Injectable()
export class SummarizeService {
  private readonly logger = new Logger(SummarizeService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly graphBuilder: GraphBuilderService,
    private readonly piiMasking: PiiMaskingService,
    private readonly evalService: EvalService,
    private readonly metricsService: MetricsService,
  ) {}

  async summarizeChannel(
    channelId: string,
    messageCount = 50,
  ): Promise<SummarizeResult> {
    const startedAt = Date.now();
    const messages = await this.db
      .select()
      .from(slackEvents)
      .where(eq(slackEvents.channelId, channelId))
      .orderBy(desc(slackEvents.createdAt))
      .limit(messageCount);

    if (messages.length === 0) {
      const noMessageResult = {
        summary: 'No messages found in this channel to summarize.',
        channelId,
        messageCount: 0,
        actions: [],
      };
      this.metricsService.recordSummarizeDuration(Date.now() - startedAt);
      return noMessageResult;
    }

    const combinedText = messages
      .reverse()
      .map((m) => `[${m.userId ?? 'unknown'}]: ${m.text ?? ''}`)
      .join('\n');

    const { masked: maskedText } = this.piiMasking.mask(combinedText);

    const { graph, recursionLimit } = this.graphBuilder.build();

    const span = createSpan('langgraph.invoke', {
      channelId,
      messageCount: messages.length,
      graphType: 'summarize',
    });

    let result: any;
    try {
      result = await graph.invoke(
        {
          input: {
            type: 'manual' as const,
            text: maskedText,
            channelId,
            sourceRefs: messages.map((m) => ({
              type: 'slack_message',
              url: m.permalink ?? '',
              id: m.messageTs,
            })),
          },
        },
        {
          configurable: { thread_id: `summarize-${channelId}-${Date.now()}` },
          recursionLimit,
        },
      );
      endSpan(span);
      this.logger.log(JSON.stringify(span));
    } catch (error) {
      endSpan(span, error as Error);
      this.logger.error(JSON.stringify(span));
      throw error;
    }

    const summaryText =
      result.summary ?? 'Unable to generate summary.';

    const summaryId = randomUUID();
    await this.db.insert(summaries).values({
      id: summaryId,
      channelId,
      summary: summaryText,
      decisions: [],
      actionItems: result.actions ?? [],
      openQuestions: [],
      messageCount: messages.length,
      sourceRefs: messages.map((m) => m.messageTs),
      status: 'completed',
    });
    const summaryRows = await this.db.select().from(summaries).where(eq(summaries.id, summaryId));
    const summaryRecord = summaryRows[0];
    if (!summaryRecord) {
      throw new AppException(`Summary ${summaryId} not found after insert`);
    }

    const evalResult = await this.evalService.evaluateSummary(
      summaryRecord.id,
      summaryText,
      combinedText,
    );

    this.logger.log(
      `Generated summary for channel ${channelId} from ${messages.length} messages (eval: ${evalResult.overallScore}/100)`,
    );

    const response = {
      summary: summaryText,
      channelId,
      messageCount: messages.length,
      actions: result.actions ?? [],
    };

    this.metricsService.recordSummarizeDuration(Date.now() - startedAt);
    return response;
  }

  async processMeetingMinutes(
    title: string,
    text: string,
  ): Promise<{
    summaryId: string;
    summary: string;
    actions: Array<{ type: string; description: string; assignee?: string }>;
  }> {
    this.logger.log(`Processing meeting minutes: "${title}"`);

    const { masked: maskedText } = this.piiMasking.mask(text);

    const { graph, recursionLimit } = this.graphBuilder.build();

    const span = createSpan('langgraph.invoke', {
      title,
      graphType: 'meeting',
    });

    let result: any;
    try {
      result = await graph.invoke(
        {
          input: {
            type: 'meeting' as const,
            text: maskedText,
            channelId: 'meeting-upload',
            sourceRefs: [{ type: 'meeting_minutes', url: '', id: title }],
          },
        },
        {
          configurable: { thread_id: `meeting-${Date.now()}` },
          recursionLimit,
        },
      );
      endSpan(span);
      this.logger.log(JSON.stringify(span));
    } catch (error) {
      endSpan(span, error as Error);
      this.logger.error(JSON.stringify(span));
      throw error;
    }

    const summaryText = result.summary ?? 'Unable to generate summary.';

    const meetingSummaryId = randomUUID();
    await this.db.insert(summaries).values({
      id: meetingSummaryId,
      channelId: 'meeting-upload',
      summary: summaryText,
      decisions: [],
      actionItems: result.actions ?? [],
      openQuestions: [],
      messageCount: 1,
      sourceRefs: [title],
      status: 'completed',
    });
    const meetingSummaryRows = await this.db.select().from(summaries).where(eq(summaries.id, meetingSummaryId));
    const summaryRecord = meetingSummaryRows[0];
    if (!summaryRecord) {
      throw new AppException(`Meeting summary ${meetingSummaryId} not found after insert`);
    }

    const evalResult = await this.evalService.evaluateSummary(
      summaryRecord.id,
      summaryText,
      maskedText,
    );

    this.logger.log(
      `Meeting "${title}" processed — summary ${summaryRecord.id}, ${(result.actions ?? []).length} action(s), eval: ${evalResult.overallScore}/100`,
    );

    return {
      summaryId: summaryRecord.id,
      summary: summaryText,
      actions: result.actions ?? [],
    };
  }
}
