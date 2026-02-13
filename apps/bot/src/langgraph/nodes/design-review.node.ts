import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { DESIGN_REVIEW_SYSTEM_PROMPT } from '../../prompts/v1/design-review.js';

const sourceRefSchema = z.object({
  type: z.string(),
  url: z.string(),
  id: z.string(),
});

const designReviewSchema = z.object({
  decision: z.object({
    recommendation: z.enum(['APPROVE', 'REVISE']),
    confidence: z.number().min(0).max(1),
  }),
  uiConstraints: z.array(z.string()),
  a11y: z.array(
    z.object({
      issue: z.string(),
      severity: z.enum(['critical', 'serious', 'moderate', 'minor']),
      fix: z.string(),
    }),
  ),
  componentsMapping: z.array(
    z.object({
      suggestedComponent: z.string(),
      reason: z.string(),
    }),
  ),
  missingInfo: z.array(z.string()),
  citations: z.array(sourceRefSchema),
});

@Injectable()
export class DesignReviewNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const context = this.buildReviewContext(state);
    const result = await this.llm.structuredInvoke(
      designReviewSchema,
      DESIGN_REVIEW_SYSTEM_PROMPT,
      context,
    );
    return { reviews: { ...state.reviews, design: result } };
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
