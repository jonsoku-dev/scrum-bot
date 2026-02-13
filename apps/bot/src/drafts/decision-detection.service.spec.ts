import { DecisionDetectionService } from './decision-detection.service.js';

describe('DecisionDetectionService', () => {
  let service: DecisionDetectionService;

  beforeEach(() => {
    service = new DecisionDetectionService();
  });

  describe('detectDecision()', () => {
    it('should detect Korean decision keyword 확정', () => {
      const result = service.detectDecision('이 방안으로 확정합니다');
      expect(result.confidence).toBeCloseTo(0.4);
      expect(result.signals).toContain('decision_keyword:확정');
    });

    it('should detect English decision keyword "decided"', () => {
      const result = service.detectDecision('We decided to go with option A');
      expect(result.confidence).toBeCloseTo(0.4);
      expect(result.signals).toContain('decision_keyword:decided');
    });

    it('should detect multiple keywords and sum confidence', () => {
      const result = service.detectDecision('We decided and agreed on this');
      expect(result.confidence).toBeCloseTo(0.8);
      expect(result.signals).toEqual(
        expect.arrayContaining([
          'decision_keyword:decided',
          'decision_keyword:agreed',
        ]),
      );
    });

    it('should detect decision from reaction', () => {
      const result = service.detectDecision('Some message', ['white_check_mark']);
      expect(result.confidence).toBeCloseTo(0.5);
      expect(result.signals).toContain('reaction:white_check_mark');
    });

    it('should add thread agreement score when 2+ users', () => {
      const result = service.detectDecision('Some message', [], 3);
      expect(result.confidence).toBeCloseTo(0.3);
      expect(result.signals).toContain('thread_agreement:3_users');
    });

    it('should not add thread agreement for 1 user', () => {
      const result = service.detectDecision('Some message', [], 1);
      expect(result.confidence).toBe(0);
      expect(result.signals).toHaveLength(0);
    });

    it('should cap confidence at 1.0', () => {
      // keyword (0.4) + keyword (0.4) + reaction (0.5) + thread (0.3) = 1.6 → capped to 1.0
      const result = service.detectDecision(
        'We decided and agreed',
        ['white_check_mark'],
        5,
      );
      expect(result.confidence).toBe(1.0);
    });

    it('should return isDecision=true when confidence >= 0.85', () => {
      // keyword (0.4) + reaction (0.5) = 0.9 >= 0.85
      const result = service.detectDecision('확정', ['white_check_mark']);
      expect(result.isDecision).toBe(true);
    });

    it('should return isDecision=false when confidence < 0.85', () => {
      // single keyword = 0.4 < 0.85
      const result = service.detectDecision('확정');
      expect(result.isDecision).toBe(false);
    });

    it('should return zero confidence for text without signals', () => {
      const result = service.detectDecision('Just a normal chat message');
      expect(result.confidence).toBe(0);
      expect(result.signals).toHaveLength(0);
      expect(result.isDecision).toBe(false);
    });

    it('should ignore non-decision reactions', () => {
      const result = service.detectDecision('Hello', ['thumbsup', 'heart']);
      expect(result.confidence).toBe(0);
      expect(result.signals).toHaveLength(0);
    });
  });

  describe('extractedTitle', () => {
    it('should extract short text as-is', () => {
      const result = service.detectDecision('Short title');
      expect(result.extractedTitle).toBe('Short title');
    });

    it('should extract up to first sentence boundary', () => {
      const result = service.detectDecision(
        'First sentence. Second sentence follows here.',
      );
      expect(result.extractedTitle).toBe('First sentence.');
    });

    it('should truncate text longer than 100 chars without sentence boundary', () => {
      const longText = 'A'.repeat(150);
      const result = service.detectDecision(longText);
      expect(result.extractedTitle).toBe('A'.repeat(100) + '…');
    });

    it('should return empty string for empty text', () => {
      const result = service.detectDecision('');
      expect(result.extractedTitle).toBe('');
    });

    it('should not truncate at sentence boundary beyond 100 chars', () => {
      const longFirst = 'A'.repeat(105) + '. rest';
      const result = service.detectDecision(longFirst);
      // No sentence boundary before 100 chars, so truncate at 100
      expect(result.extractedTitle).toBe('A'.repeat(100) + '…');
    });
  });

  describe('confidenceThreshold', () => {
    it('should expose the threshold value', () => {
      expect(service.confidenceThreshold).toBe(0.85);
    });
  });
});
