import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { contextChunks, type ContextChunk } from '../shared/database/schema.js';
import { OpenAiHttpService } from '../shared/openai-http.service.js';

interface SearchResult extends ContextChunk {
  similarity: number;
}

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
export class RetrieverService {
  private readonly logger = new Logger(RetrieverService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly openAiHttp: OpenAiHttpService,
  ) {}

  async search(
    query: string,
    options?: { limit?: number; minSimilarity?: number },
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.7;

    const queryEmbedding = await this.openAiHttp.embedText(query);

    const rows = await this.db
      .select()
      .from(contextChunks)
      .where(isNotNull(contextChunks.embedding));

    const scored = rows
      .filter((row) => row.embedding != null)
      .map((row) => {
        const rawSimilarity = cosineSimilarity(
          queryEmbedding,
          row.embedding as number[],
        );
        let decayFactor = 1.0;
        if (row.eventTime) {
          const daysSinceEvent =
            (Date.now() - new Date(row.eventTime).getTime()) /
            (1000 * 60 * 60 * 24);
          decayFactor = Math.exp(-0.1 * daysSinceEvent);
        }
        const similarity =
          rawSimilarity * decayFactor * (row.weightConfidence ?? 0.6);
        return { ...row, similarity };
      })
      .filter((row) => row.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }

  async ingestAndEmbed(
    content: string,
    sourceType: string,
    sourceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!content || content.trim().length === 0) {
      return;
    }

    const contentHash = createHash('sha256').update(content).digest('hex');

    const existing = await this.db
      .select({ id: contextChunks.id })
      .from(contextChunks)
      .where(eq(contextChunks.contentHash, contentHash))
      .limit(1);

    if (existing.length > 0) {
      this.logger.debug(
        `Duplicate content hash ${contentHash}, skipping insert`,
      );
      return;
    }

    const embedding = await this.openAiHttp.embedText(content);

    await this.db.insert(contextChunks).values({
      sourceType,
      sourceId,
      content,
      contentHash,
      embedding,
      piiRedacted: false,
      eventTime: new Date(),
      metadata: metadata ?? null,
    });

    this.logger.log(
      `Ingested and embedded context chunk for ${sourceType}:${sourceId}`,
    );
  }
}
