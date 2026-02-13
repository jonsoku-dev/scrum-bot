import { Inject, Injectable, Logger } from '@nestjs/common';
import { isNotNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from './database/drizzle.provider.js';
import { contextChunks } from './database/schema.js';
import { OpenAiHttpService } from './openai-http.service.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly openAiHttp: OpenAiHttpService,
  ) {}

  async saveContext(
    sourceType: string,
    sourceId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!content || content.trim().length === 0) {
      return;
    }

    try {
      const chunks = content.split('\n\n').filter((c) => c.trim().length > 0);
      const vectors = await this.openAiHttp.embedBatch(chunks);

      for (let i = 0; i < chunks.length; i++) {
        await this.db.insert(contextChunks).values({
          sourceType,
          sourceId,
          content: chunks[i],
          embedding: vectors[i],
          metadata: metadata ?? null,
        });
      }

      this.logger.log(
        `Saved ${chunks.length} context chunks for ${sourceType}:${sourceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save context for ${sourceType}:${sourceId}`,
        error,
      );
      throw error;
    }
  }

  async searchContext(
    query: string,
    limit = 5,
  ): Promise<Array<{ content: string; score: number; sourceId: string }>> {
    try {
      const [queryVector] = await this.openAiHttp.embedBatch([query]);

      const rows = await this.db
        .select()
        .from(contextChunks)
        .where(isNotNull(contextChunks.embedding));

      const scored = rows
        .filter((row) => row.embedding != null)
        .map((row) => ({
          content: row.content,
          sourceId: row.sourceId,
          score: cosineSimilarity(queryVector, row.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    } catch (error) {
      this.logger.error(`Context search failed for query: ${query}`, error);
      return [];
    }
  }
}
