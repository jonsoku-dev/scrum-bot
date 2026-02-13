import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { SLACK_QUEUE, DLQ_QUEUE } from './queue.module.js';
import { IngestService } from '../../drafts/ingest.service.js';

export interface SlackJobData {
  channel: string;
  ts: string;
  text: string;
  userId?: string;
  threadTs?: string;
  permalink?: string;
}

@Processor(SLACK_QUEUE)
export class SlackProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackProcessor.name);

  constructor(
    private readonly ingestService: IngestService,
    @InjectQueue(DLQ_QUEUE) private readonly dlqQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<SlackJobData>): Promise<void> {
    this.logger.log(
      `Processing Slack ingest job ${job.id}: ${job.data.channel}/${job.data.ts}`,
    );

    await this.ingestService.processMessage({
      channel: job.data.channel,
      ts: job.data.ts,
      text: job.data.text,
      user: job.data.userId,
      thread_ts: job.data.threadTs,
      permalink: job.data.permalink,
    });

    this.logger.debug(
      `Slack ingest job ${job.id} completed for ${job.data.channel}/${job.data.ts}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SlackJobData>, error: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      this.logger.error(
        `Slack job ${job.id} exhausted all retries. Moving to DLQ. Error: ${error.message}`,
      );

      try {
        await this.dlqQueue.add('slack-failed', {
          originalQueue: SLACK_QUEUE,
          originalJobId: job.id,
          data: job.data,
          error: error.message,
          failedAt: new Date().toISOString(),
          attemptsMade: job.attemptsMade,
        });
      } catch (dlqError) {
        this.logger.error(
          `Failed to enqueue Slack job ${job.id} to DLQ: ${dlqError instanceof Error ? dlqError.message : String(dlqError)}`,
        );
      }
    } else {
      this.logger.warn(
        `Slack job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? 3}): ${error.message}`,
      );
    }
  }
}
