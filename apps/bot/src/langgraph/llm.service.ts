import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import type { z } from 'zod';
import { CostTrackingService } from '../shared/cost-tracking.service.js';

interface ExtendedMessage extends BaseMessage {
  usage_metadata?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class LlmBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmBudgetExceededError';
  }
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly model: ChatOpenAI;
  private readonly modelName: string;
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_MS = 1000;

  constructor(
    private readonly costTracker: CostTrackingService,
    private readonly configService: ConfigService,
  ) {
    this.modelName = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    this.model = new ChatOpenAI({
      model: this.modelName,
      temperature: 0,
      ...(baseURL ? { configuration: { baseURL } } : {}),
    });
  }

  async structuredInvoke<T extends z.ZodType>(
    schema: T,
    systemPrompt: string,
    userInput: string,
  ): Promise<z.infer<T>> {
    await this.checkBudget();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= LlmService.MAX_RETRIES; attempt++) {
      try {
        const structuredModel = this.model.withStructuredOutput(schema, {
          includeRaw: true,
        });
        const result = await structuredModel.invoke([
          ['system', systemPrompt],
          ['human', userInput],
        ]);

        const rawMessage = result.raw as ExtendedMessage;
        await this.logCost(rawMessage.usage_metadata);

        return result.parsed;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `LLM call failed (attempt ${attempt + 1}/${LlmService.MAX_RETRIES + 1}): ${lastError.message}`,
        );

        if (attempt < LlmService.MAX_RETRIES) {
          await this.sleep(
            LlmService.RETRY_DELAY_MS * Math.pow(2, attempt),
          );
        }
      }
    }

    this.logger.error(
      `LLM call failed after ${LlmService.MAX_RETRIES + 1} attempts`,
    );
    this.logger.warn('Entering degrade mode — returning minimal fallback');
    throw lastError ?? new Error('LLM call failed unexpectedly');
  }

  private async checkBudget(): Promise<void> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { estimatedCostUsd } =
      await this.costTracker.getTotalCost(todayStart);
    const { degrade, reason } =
      this.costTracker.shouldDegrade(estimatedCostUsd);

    if (degrade) {
      throw new LlmBudgetExceededError(
        reason ?? `Daily budget exceeded: $${estimatedCostUsd.toFixed(4)}`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async logCost(
    usage: ExtendedMessage['usage_metadata'],
  ): Promise<void> {
    if (usage) {
      await this.costTracker.logUsage({
        model: this.modelName,
        promptTokens: usage.input_tokens || 0,
        completionTokens: usage.output_tokens || 0,
      });
    }
  }
}
