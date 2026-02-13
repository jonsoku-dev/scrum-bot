import { TemporalDecayService } from './temporal-decay.service';

describe('TemporalDecayService', () => {
  let service: TemporalDecayService;

  beforeEach(() => {
    service = new TemporalDecayService(14);
  });

  describe('calculateWeight', () => {
    it('should return 1.0 for events happening now', () => {
      const now = new Date();
      expect(service.calculateWeight(now, now)).toBe(1.0);
    });

    it('should return 1.0 for future events', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      expect(service.calculateWeight(future, now)).toBe(1.0);
    });

    it('should return ~0.5 for events at half-life (14 days)', () => {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
      const weight = service.calculateWeight(fourteenDaysAgo, now);
      expect(weight).toBeCloseTo(0.5, 2);
    });

    it('should return ~0.25 for events at 2x half-life (28 days)', () => {
      const now = new Date();
      const twentyEightDaysAgo = new Date(now.getTime() - 28 * 86400000);
      const weight = service.calculateWeight(twentyEightDaysAgo, now);
      expect(weight).toBeCloseTo(0.25, 2);
    });

    it('should return near 0 for very old events (90 days)', () => {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
      const weight = service.calculateWeight(ninetyDaysAgo, now);
      expect(weight).toBeLessThan(0.02);
    });
  });

  describe('applyDecay', () => {
    it('should sort items by recency weight descending', () => {
      const now = new Date();
      const old = { eventTime: new Date(now.getTime() - 30 * 86400000) };
      const recent = { eventTime: new Date(now.getTime() - 1 * 86400000) };
      const mid = { eventTime: new Date(now.getTime() - 14 * 86400000) };
      const items = [old, recent, mid];

      const sorted = service.applyDecay(items, now);

      expect(sorted[0]).toBe(recent);
      expect(sorted[1]).toBe(mid);
      expect(sorted[2]).toBe(old);
      expect(sorted[0].weightRecency).toBeGreaterThan(sorted[1].weightRecency!);
      expect(sorted[1].weightRecency).toBeGreaterThan(sorted[2].weightRecency!);
    });

    it('should assign 0.5 weight to items with null eventTime', () => {
      const now = new Date();
      const items = [{ eventTime: null as Date | null }];
      service.applyDecay(items, now);
      expect(items[0].weightRecency).toBe(0.5);
    });
  });

  describe('combinedScore', () => {
    it('should multiply all three factors', () => {
      expect(service.combinedScore(0.5, 0.9, 0.8)).toBeCloseTo(0.36, 5);
    });

    it('should return 0 when any factor is 0', () => {
      expect(service.combinedScore(0, 0.9, 0.8)).toBe(0);
      expect(service.combinedScore(0.5, 0, 0.8)).toBe(0);
      expect(service.combinedScore(0.5, 0.9, 0)).toBe(0);
    });
  });

  describe('custom half-life', () => {
    it('should support custom half-life of 7 days', () => {
      const shortDecay = new TemporalDecayService(7);
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      expect(shortDecay.calculateWeight(sevenDaysAgo, now)).toBeCloseTo(0.5, 2);
    });
  });
});
