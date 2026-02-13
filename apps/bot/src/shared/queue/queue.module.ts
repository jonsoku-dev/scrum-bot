import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const SLACK_QUEUE = 'slack-processing';
export const JIRA_QUEUE = 'jira-processing';
export const DLQ_QUEUE = 'dead-letter';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue(
      { name: SLACK_QUEUE },
      { name: JIRA_QUEUE },
      { name: DLQ_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
