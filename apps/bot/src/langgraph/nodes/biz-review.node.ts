import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { BIZ_REVIEW_SYSTEM_PROMPT } from '../../prompts/v1/biz-review.js';

const sourceRefSchema = z.object({
  type: z.string(),
  url: z.string(),
  id: z.string(),
});

const bizReviewSchema = z.object({
  decision: z.object({
    recommendation: z.enum(['APPROVE', 'REVISE', 'REJECT']),
    confidence: z.number().min(0).max(1),
  }),
  valueHypothesis: z.string(),
  risks: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      severity: z.enum(['P0', 'P1', 'P2']),
      mitigation: z.string(),
    }),
  ),
  opportunityCost: z.string(),
  missingInfo: z.array(z.string()),
  citations: z.array(sourceRefSchema),
});

@Injectable()
export class BizReviewNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const context = this.buildReviewContext(state);
    const result = await this.llm.structuredInvoke(
      bizReviewSchema,
      BIZ_REVIEW_SYSTEM_PROMPT,
      context,
    );
    return { reviews: { ...state.reviews, biz: result } };
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
