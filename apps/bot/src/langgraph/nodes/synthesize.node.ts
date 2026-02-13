import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { SCRUM_MASTER_SYSTEM_PROMPT } from '../../prompts/v1/scrum-master.js';

const sourceRefSchema = z.object({
  type: z.string(),
  url: z.string(),
  id: z.string(),
});

const scrumMasterSchema = z.object({
  summaryOneLine: z.string().max(255),
  conflicts: z.array(
    z.object({
      between: z.string(),
      topic: z.string(),
      resolutionProposal: z.string(),
    }),
  ),
  canonicalDraft: z.object({
    projectKey: z.string(),
    issueType: z.string(),
    summary: z.string(),
    descriptionMd: z.string(),
    priority: z.string(),
    labels: z.array(z.string()),
    components: z.array(z.string()),
  }),
  rolloutPlan: z.object({
    phases: z.array(z.string()),
    flags: z.array(z.string()).optional(),
    monitoring: z.string(),
  }),
  acceptanceCriteria: z.array(z.string()),
  traceability: z.object({
    sourceRefs: z.array(z.string()),
    assumptions: z.array(z.string()),
  }),
  citations: z.array(sourceRefSchema),
});

@Injectable()
export class SynthesizeNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const context = [
      `Original: ${state.input.text}`,
      `Classification: ${JSON.stringify(state.classification)}`,
      `Actions: ${JSON.stringify(state.actions)}`,
      `Biz Review: ${JSON.stringify(state.reviews.biz)}`,
      `QA Review: ${JSON.stringify(state.reviews.qa)}`,
      `Design Review: ${JSON.stringify(state.reviews.design)}`,
      `Detected Conflicts: ${JSON.stringify(state.conflicts)}`,
    ].join('\n');

    const result = await this.llm.structuredInvoke(
      scrumMasterSchema,
      SCRUM_MASTER_SYSTEM_PROMPT,
      context,
    );

    return {
      draft: result.canonicalDraft,
      conflicts: result.conflicts,
      citations: result.citations,
    };
  }
}
