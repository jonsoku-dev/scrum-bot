import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { z } from 'zod';
import { JIRA_QUEUE, DLQ_QUEUE } from './queue.module.js';
import { JiraIssueService } from '../../jira/jira-issue.service.js';
import { ValidationException } from '../exceptions/validation.exception.js';

const canonicalDraftSchema = z.object({
  summary: z.string(),
  projectKey: z.string().optional(),
  issueType: z.string().optional(),
  descriptionMd: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  links: z.array(z.string()).optional(),
  sourceCitations: z.array(z.string()).optional(),
});

const partialCanonicalDraftSchema = canonicalDraftSchema.partial();

export interface JiraJobData {
  action: 'create' | 'update' | 'transition';
  issueKey?: string;
  payload: Record<string, unknown>;
}

@Processor(JIRA_QUEUE)
export class JiraProcessor extends WorkerHost {
  private readonly logger = new Logger(JiraProcessor.name);

  constructor(
    private readonly jiraIssueService: JiraIssueService,
    @InjectQueue(DLQ_QUEUE) private readonly dlqQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<JiraJobData>): Promise<void> {
    const { action, issueKey, payload } = job.data;
    this.logger.log(
      `Processing Jira job ${job.id}: ${action} ${issueKey ?? 'new'}`,
    );

    switch (action) {
      case 'create': {
        const parsed = canonicalDraftSchema.safeParse(payload);
        if (!parsed.success) {
          throw new ValidationException(`Invalid CanonicalDraft payload: ${parsed.error.message}`);
        }
        const result = await this.jiraIssueService.createIssue(parsed.data);
        this.logger.log(`Jira issue created: ${result.jiraKey}`);
        break;
      }
      case 'update': {
        if (!issueKey) throw new ValidationException('issueKey required for update');
        const updateParsed = partialCanonicalDraftSchema.safeParse(payload);
        if (!updateParsed.success) {
          throw new ValidationException(`Invalid update payload: ${updateParsed.error.message}`);
        }
        const updateResult = await this.jiraIssueService.updateIssue(
          issueKey,
          updateParsed.data,
        );
        this.logger.log(`Jira issue ${issueKey} updated: changed=${updateResult.changed}`);
        break;
      }
      case 'transition': {
        if (!issueKey) throw new ValidationException('issueKey required for transition');
        const transitionId = payload.transitionId;
        if (typeof transitionId !== 'string') throw new ValidationException('transitionId (string) required for transition');
        await this.jiraIssueService.transitionIssue(issueKey, transitionId);
        this.logger.log(`Jira issue ${issueKey} transitioned: ${transitionId}`);
        break;
      }
      default:
        throw new ValidationException(`Unknown Jira job action: ${action}`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<JiraJobData>, error: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      this.logger.error(
        `Jira job ${job.id} exhausted all retries. Moving to DLQ. Error: ${error.message}`,
      );

      try {
        await this.dlqQueue.add('jira-failed', {
          originalQueue: JIRA_QUEUE,
          originalJobId: job.id,
          data: job.data,
          error: error.message,
          failedAt: new Date().toISOString(),
          attemptsMade: job.attemptsMade,
        });
      } catch (dlqError) {
        this.logger.error(
          `Failed to enqueue Jira job ${job.id} to DLQ: ${dlqError instanceof Error ? dlqError.message : String(dlqError)}`,
        );
      }
    } else {
      this.logger.warn(
        `Jira job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? 3}): ${error.message}`,
      );
    }
  }
}
