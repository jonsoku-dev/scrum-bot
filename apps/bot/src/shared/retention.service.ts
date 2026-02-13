import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, lt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from './database/drizzle.provider.js';
import { slackEvents, tokenUsageLog, approvals } from './database/schema.js';

/** Extract affectedRows from Drizzle mysql2 mutation result (ResultSetHeader or tuple). */
function extractAffectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (header != null && typeof header === 'object' && 'affectedRows' in header) {
    const rows = header.affectedRows;
    return typeof rows === 'number' ? rows : 0;
  }
  return 0;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly RAW_RETENTION_DAYS = 90;
  private readonly TOKEN_LOG_RETENTION_DAYS = 180;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runRetentionPolicy(): Promise<{
    deletedSlackEvents: number;
    deletedTokenLogs: number;
  }> {
    this.logger.log('Starting data retention policy execution');

    const rawCutoff = new Date();
    rawCutoff.setDate(rawCutoff.getDate() - this.RAW_RETENTION_DAYS);

    const slackResult = await this.db
      .delete(slackEvents)
      .where(lt(slackEvents.createdAt, rawCutoff));
    const deletedSlackEvents = extractAffectedRows(slackResult);

    const tokenCutoff = new Date();
    tokenCutoff.setDate(
      tokenCutoff.getDate() - this.TOKEN_LOG_RETENTION_DAYS,
    );

    const tokenResult = await this.db
      .delete(tokenUsageLog)
      .where(lt(tokenUsageLog.createdAt, tokenCutoff));
    const deletedTokenLogs = extractAffectedRows(tokenResult);

    this.logger.log(
      `Retention complete: ${deletedSlackEvents} slack events, ${deletedTokenLogs} token logs deleted`,
    );

    return { deletedSlackEvents, deletedTokenLogs };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingApprovals(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .update(approvals)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(approvals.status, 'PENDING'),
          lt(approvals.expiresAt, now),
        ),
      );
    const expired = extractAffectedRows(result);
    if (expired > 0) {
      this.logger.log(`Expired ${expired} pending approval(s)`);
    }
    return expired;
  }
}
