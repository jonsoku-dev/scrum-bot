import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private slackIngestSuccess = 0;
  private slackIngestFailure = 0;
  private summarizeDurationsMs: number[] = [];

  recordSlackIngestSuccess(): void {
    this.slackIngestSuccess += 1;
  }

  recordSlackIngestFailure(): void {
    this.slackIngestFailure += 1;
  }

  recordSummarizeDuration(durationMs: number): void {
    this.summarizeDurationsMs.push(durationMs);
    if (this.summarizeDurationsMs.length > 1000) {
      this.summarizeDurationsMs = this.summarizeDurationsMs.slice(-1000);
    }
  }

  getSnapshot() {
    const totalIngest = this.slackIngestSuccess + this.slackIngestFailure;
    const ingestSuccessRate =
      totalIngest === 0 ? 0 : this.slackIngestSuccess / totalIngest;

    const sortedDurations = [...this.summarizeDurationsMs].sort((a, b) => a - b);
    const p95Ms = this.percentile(sortedDurations, 95);

    return {
      ingest: {
        success: this.slackIngestSuccess,
        failure: this.slackIngestFailure,
        total: totalIngest,
        successRate: Number(ingestSuccessRate.toFixed(4)),
      },
      summarize: {
        samples: sortedDurations.length,
        p95Ms,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    return values[clamped];
  }
}
