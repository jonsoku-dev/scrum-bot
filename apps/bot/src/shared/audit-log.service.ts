import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from './database/drizzle.provider.js';
import { auditLogs, type NewAuditLog } from './database/schema.js';

export type ActorType = 'HUMAN' | 'AI' | 'SYSTEM';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async log(entry: {
    actorType: ActorType;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const values: NewAuditLog = {
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      payload: entry.payload ?? null,
    };

    await this.db.insert(auditLogs).values(values);

    this.logger.debug(
      `[${entry.actorType}:${entry.actorId}] ${entry.action} → ${entry.targetType}:${entry.targetId}`,
    );
  }
}
