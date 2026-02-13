import { Injectable } from '@nestjs/common';

export interface DetectionResult {
  isDecision: boolean;
  confidence: number;
  signals: string[];
  extractedTitle: string;
}

/** DOC-04 Section 3: Decision trigger keywords */
const DECISION_KEYWORDS = [
  '확정',
  '결정',
  '진행',
  '이대로',
  '배포',
  'decided',
  'agreed',
  'consensus',
  'approved',
  'chosen',
] as const;

/** DOC-04 Section 3: Decision trigger reactions */
const DECISION_REACTIONS = [
  'white_check_mark',
  'heavy_check_mark',
] as const;

/** DOC-04 Section 3: Confidence threshold for automatic decision saving */
const CONFIDENCE_THRESHOLD = 0.85;

/** Scoring weights per DOC-04 */
const SCORE_KEYWORD_MATCH = 0.4;
const SCORE_REACTION_MATCH = 0.5;
const SCORE_THREAD_AGREEMENT = 0.3;

@Injectable()
export class DecisionDetectionService {
  readonly confidenceThreshold = CONFIDENCE_THRESHOLD;

  /**
   * Detect whether a Slack message represents a decision.
   *
   * Scoring (capped at 1.0):
   *   +0.4 per unique keyword found
   *   +0.5 per matching reaction
   *   +0.3 if 2+ distinct users in thread (thread agreement)
   */
  detectDecision(
    text: string,
    reactions?: string[],
    threadUserCount?: number,
  ): DetectionResult {
    const signals: string[] = [];
    let confidence = 0;

    const lowerText = text.toLowerCase();

    for (const keyword of DECISION_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        signals.push(`decision_keyword:${keyword}`);
        confidence += SCORE_KEYWORD_MATCH;
      }
    }

    if (reactions) {
      for (const reaction of reactions) {
        if ((DECISION_REACTIONS as readonly string[]).includes(reaction)) {
          signals.push(`reaction:${reaction}`);
          confidence += SCORE_REACTION_MATCH;
        }
      }
    }

    if (threadUserCount !== undefined && threadUserCount >= 2) {
      signals.push(`thread_agreement:${threadUserCount}_users`);
      confidence += SCORE_THREAD_AGREEMENT;
    }

    confidence = Math.min(confidence, 1.0);

    const extractedTitle = this.extractTitle(text);

    return {
      isDecision: confidence >= CONFIDENCE_THRESHOLD,
      confidence,
      signals,
      extractedTitle,
    };
  }

  private extractTitle(text: string): string {
    if (!text) return '';

    const trimmed = text.trim();

    // Find first sentence boundary
    const sentenceEnd = trimmed.search(/[.!?。]\s/);
    if (sentenceEnd !== -1 && sentenceEnd < 100) {
      return trimmed.slice(0, sentenceEnd + 1);
    }

    if (trimmed.length <= 100) {
      return trimmed;
    }

    return trimmed.slice(0, 100) + '…';
  }
}
