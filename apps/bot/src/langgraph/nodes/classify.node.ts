import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { CLASSIFY_INTENT_PROMPT } from '../../prompts/v1/summarizer.js';

const classificationSchema = z.object({
  intent: z.enum(['decision', 'action_item', 'discussion', 'question']),
  confidence: z.number().min(0).max(1),
  sourceEvidence: z.array(z.string()),
});

@Injectable()
export class ClassifyNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const result = await this.llm.structuredInvoke(
      classificationSchema,
      CLASSIFY_INTENT_PROMPT,
      state.input.text,
    );
    return { classification: result };
  }
}
