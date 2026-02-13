import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from './database/drizzle.provider.js';
import {
  evaluations,
  type EvalDimension,
  type EvalResult,
} from './database/schema.js';

interface DraftContent {
  summary?: string;
  descriptionMd?: string;
  acceptanceCriteria?: string[];
  priority?: string;
  sourceCitations?: unknown[];
}

function extractDraftContent(draft: Record<string, unknown>): DraftContent {
  const inner = draft['content'];
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as DraftContent;
  }
  return {
    summary: typeof draft.summary === 'string' ? draft.summary : undefined,
    descriptionMd: typeof draft.descriptionMd === 'string' ? draft.descriptionMd : undefined,
    acceptanceCriteria: Array.isArray(draft.acceptanceCriteria) ? (draft.acceptanceCriteria as string[]) : undefined,
    priority: typeof draft.priority === 'string' ? draft.priority : undefined,
    sourceCitations: Array.isArray(draft.sourceCitations) ? draft.sourceCitations : undefined,
  };
}

@Injectable()
export class EvalService {
  private readonly logger = new Logger(EvalService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async evaluateSummary(
    summaryId: string,
    summary: string,
    originalText: string,
  ): Promise<EvalResult> {
    const dimensions: EvalDimension[] = [
      this.scoreCoverage(summary, originalText),
      this.scoreConciseness(summary, originalText),
      this.scoreStructure(summary),
      this.scoreSourceAttribution(summary),
      this.scoreActionability(summary),
    ];

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
    );

    await this.db.insert(evaluations).values({
      targetType: 'SUMMARY',
      targetId: summaryId,
      evaluatorType: 'AUTO',
      dimensions,
      overallScore,
    });

    this.logger.log(
      `Evaluated summary ${summaryId}: score=${overallScore}/100`,
    );

    return { dimensions, overallScore };
  }

  async evaluateDraft(
    draftId: string,
    draft: Record<string, unknown>,
  ): Promise<EvalResult> {
    const dimensions: EvalDimension[] = [
      this.scoreCompleteness(draft),
      this.scoreClarityOfAC(draft),
      this.scorePriorityJustification(draft),
      this.scoreSourceCitations(draft),
    ];

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
    );

    await this.db.insert(evaluations).values({
      targetType: 'DRAFT',
      targetId: draftId,
      evaluatorType: 'AUTO',
      dimensions,
      overallScore,
    });

    this.logger.log(`Evaluated draft ${draftId}: score=${overallScore}/100`);

    return { dimensions, overallScore };
  }

  async getEvaluations(targetType?: string, limit = 50) {
    const query = this.db
      .select()
      .from(evaluations)
      .orderBy(desc(evaluations.createdAt))
      .limit(limit);

    if (targetType) {
      return query.where(eq(evaluations.targetType, targetType));
    }

    return query;
  }

  private scoreCoverage(
    summary: string,
    original: string,
  ): EvalDimension {
    const words = original
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?;:'"()[\]{}]+$/g, ''))
      .filter((w) => w.length > 4);
    const uniqueWords = [...new Set(words)];
    const covered = uniqueWords.filter((w) =>
      summary.toLowerCase().includes(w),
    );
    const score = Math.round(
      (covered.length / Math.max(uniqueWords.length, 1)) * 100,
    );
    return { name: 'coverage', score: Math.min(score, 100), maxScore: 100 };
  }

  private scoreConciseness(
    summary: string,
    original: string,
  ): EvalDimension {
    const ratio = summary.length / Math.max(original.length, 1);
    let score: number;
    if (ratio < 0.1) {
      score = 60;
    } else if (ratio <= 0.3) {
      score = 100;
    } else if (ratio <= 0.5) {
      score = 70;
    } else {
      score = 40;
    }
    return { name: 'conciseness', score, maxScore: 100 };
  }

  private scoreStructure(summary: string): EvalDimension {
    let score = 0;
    const lower = summary.toLowerCase();
    if (lower.includes('decision') || lower.includes('결정')) score += 25;
    if (
      lower.includes('action') ||
      lower.includes('액션') ||
      lower.includes('할 일')
    )
      score += 25;
    if (
      lower.includes('question') ||
      lower.includes('질문') ||
      lower.includes('미해결')
    )
      score += 25;
    if (summary.split('\n').length > 3) score += 25;
    return { name: 'structure', score, maxScore: 100 };
  }

  private scoreSourceAttribution(summary: string): EvalDimension {
    const lower = summary.toLowerCase();
    const hasRefs =
      lower.includes('source') ||
      lower.includes('출처') ||
      summary.includes('[') ||
      lower.includes('ref');
    return {
      name: 'source_attribution',
      score: hasRefs ? 100 : 30,
      maxScore: 100,
    };
  }

  private scoreActionability(summary: string): EvalDimension {
    const actionPatterns = [
      /\bwill\b/i,
      /\bshould\b/i,
      /\bneed\b/i,
      /\bmust\b/i,
      /해야/,
      /필요/,
      /진행/,
    ];
    const found = actionPatterns.filter((p) => p.test(summary)).length;
    return {
      name: 'actionability',
      score: Math.min(found * 20, 100),
      maxScore: 100,
    };
  }

  private scoreCompleteness(draft: Record<string, unknown>): EvalDimension {
    const content = extractDraftContent(draft);
    let score = 0;
    if (content.summary) score += 25;
    if (content.descriptionMd) score += 25;
    if (content.acceptanceCriteria && content.acceptanceCriteria.length > 0)
      score += 25;
    if (content.priority) score += 25;
    return { name: 'completeness', score, maxScore: 100 };
  }

  private scoreClarityOfAC(draft: Record<string, unknown>): EvalDimension {
    const content = extractDraftContent(draft);
    const ac = content.acceptanceCriteria ?? [];
    if (ac.length === 0)
      return { name: 'ac_clarity', score: 0, maxScore: 100 };
    const specificAc = ac.filter((c) => c.length > 20);
    return {
      name: 'ac_clarity',
      score: Math.round((specificAc.length / ac.length) * 100),
      maxScore: 100,
    };
  }

  private scorePriorityJustification(
    draft: Record<string, unknown>,
  ): EvalDimension {
    const content = extractDraftContent(draft);
    return {
      name: 'priority_justified',
      score: content.priority ? 80 : 20,
      maxScore: 100,
    };
  }

  private scoreSourceCitations(
    draft: Record<string, unknown>,
  ): EvalDimension {
    const content = extractDraftContent(draft);
    const citations = content.sourceCitations ?? [];
    return {
      name: 'source_citations',
      score: citations.length > 0 ? 100 : 20,
      maxScore: 100,
    };
  }
}
