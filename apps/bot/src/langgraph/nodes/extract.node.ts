import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { EXTRACT_ACTIONS_PROMPT } from '../../prompts/v1/summarizer.js';

const actionsSchema = z.object({
  actions: z.array(
    z.object({
      type: z.enum(['task', 'bug', 'followup']),
      description: z.string(),
      assignee: z.string().optional(),
      citation: z.string(),
    }),
  ),
  decisions: z.array(
    z.object({
      description: z.string(),
      madeBy: z.string().optional(),
      citation: z.string(),
    }),
  ),
});

@Injectable()
export class ExtractNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const result = await this.llm.structuredInvoke(
      actionsSchema,
      EXTRACT_ACTIONS_PROMPT,
      state.input.text,
    );
    return {
      actions: result.actions.map((a) => ({
        type: a.type,
        description: a.description,
        assignee: a.assignee,
      })),
    };
  }
}
