import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { approvals, type Approval } from '../shared/database/schema.js';
import { AuditLogService } from '../shared/audit-log.service.js';
import { AppException } from '../shared/exceptions/app.exception.js';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(data: {
    approvalType: string;
    requestedBy: string;
    requestedVia: string;
    draftId: string;
    expiresAt?: Date;
  }): Promise<Approval> {
    const id = randomUUID();
    await this.db.insert(approvals).values({
      id,
      approvalType: data.approvalType,
      status: 'PENDING',
      requestedBy: data.requestedBy,
      requestedVia: data.requestedVia,
      draftId: data.draftId,
      expiresAt: data.expiresAt ?? null,
    });
    const [result] = await this.db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id));

    this.logger.log(`Created approval ${result.id} for draft ${data.draftId}`);
    return result;
  }

  async findAll(filters?: {
    status?: string;
    draftId?: string;
  }): Promise<Approval[]> {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(approvals.status, filters.status));
    }
    if (filters?.draftId) {
      conditions.push(eq(approvals.draftId, filters.draftId));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(approvals)
      .where(whereClause)
      .orderBy(desc(approvals.createdAt));
  }

  async findById(id: string): Promise<Approval | null> {
    const results = await this.db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .limit(1);

    return results[0] ?? null;
  }

  async approve(id: string, decidedBy: string): Promise<Approval> {
    await this.db
      .update(approvals)
      .set({
        status: 'APPROVED',
        decidedBy,
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, id));

    this.logger.log(`Approved approval ${id} by ${decidedBy}`);
    const result = await this.findById(id);
    if (!result) {
      throw new AppException(`Approval ${id} not found after approve`);
    }

    await this.auditLogService.log({
      actorType: 'HUMAN',
      actorId: decidedBy,
      action: 'APPROVAL_APPROVE',
      targetType: 'approval',
      targetId: id,
      payload: { draftId: result.draftId },
    });

    return result;
  }

  async reject(id: string, decidedBy: string): Promise<Approval> {
    await this.db
      .update(approvals)
      .set({
        status: 'REJECTED',
        decidedBy,
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, id));

    this.logger.log(`Rejected approval ${id} by ${decidedBy}`);
    const result = await this.findById(id);
    if (!result) {
      throw new AppException(`Approval ${id} not found after reject`);
    }

    await this.auditLogService.log({
      actorType: 'HUMAN',
      actorId: decidedBy,
      action: 'APPROVAL_REJECT',
      targetType: 'approval',
      targetId: id,
      payload: { draftId: result.draftId },
    });

    return result;
  }

  async expire(id: string): Promise<Approval> {
    await this.db
      .update(approvals)
      .set({ status: 'EXPIRED' })
      .where(eq(approvals.id, id));

    this.logger.log(`Expired approval ${id}`);
    const result = await this.findById(id);
    if (!result) {
      throw new AppException(`Approval ${id} not found after expire`);
    }
    return result;
  }
}
