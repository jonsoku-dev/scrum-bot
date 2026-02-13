import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { QA_REVIEW_SYSTEM_PROMPT } from '../../prompts/v1/qa-review.js';

const sourceRefSchema = z.object({
  type: z.string(),
  url: z.string(),
  id: z.string(),
});

const qaReviewSchema = z.object({
  decision: z.object({
    recommendation: z.enum(['APPROVE', 'REVISE', 'BLOCK']),
    confidence: z.number().min(0).max(1),
  }),
  p0TestCases: z.array(
    z.object({
      title: z.string(),
      steps: z.array(z.string()),
      expected: z.array(z.string()),
      notes: z.string(),
    }),
  ),
  stateModelRisks: z.array(
    z.object({
      scenario: z.string(),
      failureMode: z.string(),
      detection: z.string(),
      mitigation: z.string(),
    }),
  ),
  regressionSurface: z.array(z.string()),
  nonFunctional: z.object({
    timeouts: z.string(),
    retries: z.string(),
    idempotency: z.string(),
    observability: z.string(),
  }),
  missingInfo: z.array(z.string()),
  citations: z.array(sourceRefSchema),
});

@Injectable()
export class QaReviewNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const context = this.buildReviewContext(state);
    const result = await this.llm.structuredInvoke(
      qaReviewSchema,
      QA_REVIEW_SYSTEM_PROMPT,
      context,
    );
    return { reviews: { ...state.reviews, qa: result } };
  }

  private buildReviewContext(state: ScrumStateType): string {
    const parts = [
      `Actions: ${JSON.stringify(state.actions)}`,
      `Classification: ${JSON.stringify(state.classification)}`,
      `Original: ${state.input.text}`,
    ];
    if (state.retrievedContext.length > 0) {
      parts.push(
        `Retrieved Context:\n${state.retrievedContext.map((c) => `[source:${c.sourceId}] ${c.content}`).join('\n')}`,
      );
    }
    return parts.join('\n');
  }
}
