import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { decisions, type Decision } from '../shared/database/schema.js';
import { AppException } from '../shared/exceptions/app.exception.js';

@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(data: {
    draftId?: string;
    content: Record<string, unknown>;
    decidedBy: string;
    sourceRefs?: string[];
  }): Promise<Decision> {
    const id = randomUUID();
    await this.db
      .insert(decisions)
      .values({
        id,
        draftId: data.draftId ?? null,
        content: data.content,
        decidedBy: data.decidedBy,
        sourceRefs: data.sourceRefs ?? null,
      });
    const [result] = await this.db.select().from(decisions).where(eq(decisions.id, id));

    this.logger.log(`Created decision ${result.id}`);
    return result;
  }

  async findAll(filters?: { status?: string }): Promise<Decision[]> {
    const whereClause = filters?.status
      ? eq(decisions.status, filters.status)
      : undefined;

    return this.db
      .select()
      .from(decisions)
      .where(whereClause)
      .orderBy(desc(decisions.createdAt));
  }

  async findById(id: string): Promise<Decision | null> {
    const results = await this.db
      .select()
      .from(decisions)
      .where(eq(decisions.id, id))
      .limit(1);

    return results[0] ?? null;
  }

  async updateStatus(id: string, status: string): Promise<Decision> {
    await this.db
      .update(decisions)
      .set({ status })
      .where(eq(decisions.id, id));

    const result = await this.findById(id);
    if (!result) {
      throw new AppException(`Decision ${id} not found after status update`);
    }

    this.logger.log(`Decision ${id} status updated to '${status}'`);
    return result;
  }

  async supersede(id: string, newDecisionId: string): Promise<Decision> {
    await this.db
      .update(decisions)
      .set({
        status: 'superseded',
        supersededBy: newDecisionId,
      })
      .where(eq(decisions.id, id));

    this.logger.log(`Superseded decision ${id} with ${newDecisionId}`);

    const result = await this.findById(id);
    if (!result) {
      throw new AppException(`Decision ${id} not found after supersede`);
    }
    return result;
  }
}
