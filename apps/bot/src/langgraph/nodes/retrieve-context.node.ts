import { Injectable, Optional } from '@nestjs/common';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { RetrieverService } from '../../drafts/retriever.service.js';

@Injectable()
export class RetrieveContextNode {
  constructor(
    @Optional() private readonly retriever?: RetrieverService,
  ) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    if (!this.retriever) {
      return { retrievedContext: [] };
    }

    const results = await this.retriever.search(state.input.text, {
      limit: 5,
      minSimilarity: 0.7,
    });

    return {
      retrievedContext: results.map((r) => ({
        content: r.content,
        similarity: r.similarity,
        sourceId: r.sourceId,
      })),
    };
  }
}
