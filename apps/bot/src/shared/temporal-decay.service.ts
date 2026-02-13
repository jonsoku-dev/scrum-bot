import { Injectable } from '@nestjs/common';

/**
 * Spec DOC-03 §3: weight_recency = e^(-lambda * daysSinceEvent)
 * Half-life 14d → 14d:0.5, 30d:0.23, 60d:0.05, 90d:0.01
 */
@Injectable()
export class TemporalDecayService {
  private readonly lambda: number;

  constructor(halfLifeDays = 14) {
    // lambda = ln(2) / halfLife
    this.lambda = Math.LN2 / halfLifeDays;
  }

  calculateWeight(eventTime: Date, now: Date = new Date()): number {
    const diffMs = now.getTime() - eventTime.getTime();
    if (diffMs <= 0) return 1.0;

    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.exp(-this.lambda * diffDays);
  }

  applyDecay<T extends { eventTime: Date | null; weightRecency?: number }>(
    items: T[],
    now: Date = new Date(),
  ): T[] {
    for (const item of items) {
      if (item.eventTime) {
        item.weightRecency = this.calculateWeight(item.eventTime, now);
      } else {
        item.weightRecency = 0.5;
      }
    }

    return items.sort(
      (a, b) => (b.weightRecency ?? 0) - (a.weightRecency ?? 0),
    );
  }

  combinedScore(
    recencyWeight: number,
    confidenceWeight: number,
    similarity: number,
  ): number {
    return recencyWeight * confidenceWeight * similarity;
  }
}
