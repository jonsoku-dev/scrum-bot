import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { agentRuns, type AgentRun } from '../shared/database/schema.js';
import { AppException } from '../shared/exceptions/app.exception.js';

@Injectable()
export class AgentRunService {
  private readonly logger = new Logger(AgentRunService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async startRun(
    draftId: string,
    agentName: string,
    input: Record<string, unknown>,
  ): Promise<AgentRun> {
    const id = randomUUID();
    await this.db
      .insert(agentRuns)
      .values({
        id,
        draftId,
        agentName,
        input,
        status: 'running',
      });
    const [result] = await this.db.select().from(agentRuns).where(eq(agentRuns.id, id));

    this.logger.log(`Started agent run ${result.id} for ${agentName}`);
    return result;
  }

  async completeRun(
    runId: string,
    output: Record<string, unknown>,
    tokenUsage: { prompt: number; completion: number; total: number },
    durationMs: number,
  ): Promise<AgentRun> {
    await this.db
      .update(agentRuns)
      .set({
        output,
        tokenUsage,
        durationMs,
        status: 'completed',
      })
      .where(eq(agentRuns.id, runId));

    this.logger.log(`Completed agent run ${runId}`);

    const result = await this.getRunById(runId);
    if (!result) {
      throw new AppException(`AgentRun ${runId} not found after complete`);
    }
    return result;
  }

  async failRun(runId: string, error: string): Promise<AgentRun> {
    await this.db
      .update(agentRuns)
      .set({
        status: 'failed',
        error,
      })
      .where(eq(agentRuns.id, runId));

    this.logger.warn(`Failed agent run ${runId}: ${error}`);

    const result = await this.getRunById(runId);
    if (!result) {
      throw new AppException(`AgentRun ${runId} not found after fail`);
    }
    return result;
  }

  async getAllRuns(): Promise<AgentRun[]> {
    return this.db
      .select()
      .from(agentRuns)
      .orderBy(desc(agentRuns.createdAt))
      .limit(100);
  }

  async getRunsByDraft(draftId: string): Promise<AgentRun[]> {
    return this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.draftId, draftId))
      .orderBy(desc(agentRuns.createdAt));
  }

  async getRunById(id: string): Promise<AgentRun | null> {
    const results = await this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .limit(1);

    return results[0] ?? null;
  }
}
