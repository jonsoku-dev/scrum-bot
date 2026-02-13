import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { drafts, type Draft } from '../shared/database/schema.js';
import { AuditLogService } from '../shared/audit-log.service.js';
import { DraftNotFoundException } from '../shared/exceptions/draft-not-found.exception.js';

@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(data: {
    type: string;
    sourceEventIds: string[];
    content: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<Draft> {
    const id = randomUUID();
    await this.db
      .insert(drafts)
      .values({
        id,
        type: data.type,
        sourceEventIds: data.sourceEventIds,
        content: data.content,
        metadata: data.metadata ?? null,
      });
    const [result] = await this.db.select().from(drafts).where(eq(drafts.id, id));

    this.logger.log(`Created draft ${result.id} of type ${data.type}`);

    await this.auditLogService.log({
      actorType: 'AI',
      actorId: 'system',
      action: 'DRAFT_CREATE',
      targetType: 'draft',
      targetId: result.id,
      payload: { type: data.type },
    });

    return result;
  }

  async findAll(filters?: {
    status?: string;
    type?: string;
  }): Promise<Draft[]> {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(drafts.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(drafts.type, filters.type));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(drafts)
      .where(whereClause)
      .orderBy(desc(drafts.createdAt));
  }

  async findById(id: string): Promise<Draft | null> {
    const results = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, id))
      .limit(1);

    return results[0] ?? null;
  }

  async update(
    id: string,
    data: Partial<{
      content: Record<string, unknown>;
      status: string;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Draft> {
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.content !== undefined) {
      updatePayload.content = data.content;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }
    if (data.metadata !== undefined) {
      updatePayload.metadata = data.metadata;
    }

    await this.db
      .update(drafts)
      .set(updatePayload)
      .where(eq(drafts.id, id));

    const result = await this.findById(id);
    if (!result) {
      throw new DraftNotFoundException(id);
    }

    await this.auditLogService.log({
      actorType: 'HUMAN',
      actorId: 'system',
      action: 'DRAFT_UPDATE',
      targetType: 'draft',
      targetId: id,
      payload: { updatedFields: Object.keys(data) },
    });

    return result;
  }

  async approve(id: string, approvedBy: string): Promise<Draft> {
    await this.db
      .update(drafts)
      .set({
        status: 'approved',
        approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(drafts.id, id));

    const result = await this.findById(id);
    if (!result) {
      throw new DraftNotFoundException(id);
    }

    await this.auditLogService.log({
      actorType: 'HUMAN',
      actorId: approvedBy,
      action: 'DRAFT_APPROVE',
      targetType: 'draft',
      targetId: id,
    });

    return result;
  }

  async reject(id: string): Promise<Draft> {
    await this.db
      .update(drafts)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(drafts.id, id));

    const result = await this.findById(id);
    if (!result) {
      throw new DraftNotFoundException(id);
    }

    await this.auditLogService.log({
      actorType: 'HUMAN',
      actorId: 'system',
      action: 'DRAFT_REJECT',
      targetType: 'draft',
      targetId: id,
    });

    return result;
  }
}
