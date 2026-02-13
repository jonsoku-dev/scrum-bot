import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gte } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from './database/drizzle.provider.js';
import { tokenUsageLog } from './database/schema.js';
import { createSpan, endSpan } from './tracing.js';

@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);

  private readonly pricing: Record<
    string,
    { prompt: number; completion: number }
  > = {
    'gpt-4o': { prompt: 2.5, completion: 10.0 },
    'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  };

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async logUsage(data: {
    agentRunId?: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    const span = createSpan('cost.logUsage', {
      model: data.model,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
    });

    try {
      const totalTokens = data.promptTokens + data.completionTokens;
      const price = this.pricing[data.model] ?? {
        prompt: 0.15,
        completion: 0.6,
      };
      const cost =
        (data.promptTokens / 1_000_000) * price.prompt +
        (data.completionTokens / 1_000_000) * price.completion;

      await this.db.insert(tokenUsageLog).values({
        agentRunId: data.agentRunId ?? null,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens,
        estimatedCostUsd: cost.toFixed(6),
      });

      span.attributes.totalTokens = totalTokens;
      span.attributes.estimatedCostUsd = cost;
      endSpan(span);
      this.logger.log(JSON.stringify(span));
    } catch (error) {
      endSpan(span, error as Error);
      this.logger.error(JSON.stringify(span));
      throw error;
    }
  }

  async getTotalCost(
    since?: Date,
  ): Promise<{
    totalTokens: number;
    estimatedCostUsd: number;
    byModel: Record<string, { tokens: number; cost: number }>;
  }> {
    const whereClause = since
      ? gte(tokenUsageLog.createdAt, since)
      : undefined;

    const rows = await this.db
      .select()
      .from(tokenUsageLog)
      .where(whereClause);

    let totalTokens = 0;
    let estimatedCostUsd = 0;
    const byModel: Record<string, { tokens: number; cost: number }> = {};

    for (const row of rows) {
      totalTokens += row.totalTokens;
      const cost = parseFloat(row.estimatedCostUsd ?? '0');
      estimatedCostUsd += Number.isNaN(cost) ? 0 : cost;

      if (!byModel[row.model]) {
        byModel[row.model] = { tokens: 0, cost: 0 };
      }
      byModel[row.model].tokens += row.totalTokens;
      byModel[row.model].cost += cost;
    }

    return { totalTokens, estimatedCostUsd, byModel };
  }

  shouldDegrade(totalCostUsd: number): {
    degrade: boolean;
    reason?: string;
  } {
    const budgetLimit = this.configService.get<number>(
      'DAILY_BUDGET_USD',
      10,
    );
    if (totalCostUsd >= budgetLimit) {
      return {
        degrade: true,
        reason: `Daily budget limit $${budgetLimit} exceeded`,
      };
    }
    return { degrade: false };
  }
}
