import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { LlmService } from '../llm.service.js';
import { SUMMARIZER_SYSTEM_PROMPT } from '../../prompts/v1/summarizer.js';

const canonicalDraftSchema = z.object({
  projectKey: z.string(),
  issueType: z.string(),
  summary: z.string(),
  descriptionMd: z.string(),
  acceptanceCriteria: z.array(z.string()),
  priority: z.string(),
  labels: z.array(z.string()),
  components: z.array(z.string()),
  sourceCitations: z.array(z.string()),
});

const enrichedDraftSchema = z.object({
  overviewSummary: z.string(),
  openQuestions: z.array(
    z.object({
      question: z.string(),
      raisedBy: z.string().optional(),
    }),
  ),
});

@Injectable()
export class GenerateDraftNode {
  constructor(private readonly llm: LlmService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const contextParts = [
      `Classification: ${JSON.stringify(state.classification)}`,
      `Actions: ${JSON.stringify(state.actions)}`,
      `Original text:\n${state.input.text}`,
    ];

    if (state.retrievedContext.length > 0) {
      const kbContext = state.retrievedContext
        .map(
          (c) =>
            `[source:${c.sourceId}, similarity:${c.similarity.toFixed(2)}] ${c.content}`,
        )
        .join('\n---\n');
      contextParts.push(`Relevant knowledge base context:\n${kbContext}`);
    }

    const context = contextParts.join('\n\n');

    if (state.draft && typeof state.draft === 'object' && 'projectKey' in state.draft) {
      const enriched = await this.llm.structuredInvoke(
        enrichedDraftSchema,
        SUMMARIZER_SYSTEM_PROMPT,
        context,
      );

      return {
        summary: enriched.overviewSummary,
        draft: state.draft,
      };
    }

    const result = await this.llm.structuredInvoke(
      canonicalDraftSchema,
      `${SUMMARIZER_SYSTEM_PROMPT}\n\nGenerate a structured Jira ticket draft in CanonicalDraft format. Use projectKey "PROJ" if unknown. Set priority as P0-P3 based on urgency.`,
      context,
    );

    return {
      summary: result.summary,
      draft: result,
    };
  }
}
