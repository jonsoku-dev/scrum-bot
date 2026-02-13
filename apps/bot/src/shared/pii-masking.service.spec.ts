import { PiiMaskingService } from './pii-masking.service';

describe('PiiMaskingService', () => {
  let service: PiiMaskingService;

  beforeEach(() => {
    service = new PiiMaskingService();
  });

  describe('mask()', () => {
    it('should redact email addresses', () => {
      const result = service.mask('Contact john@example.com for details');
      expect(result.masked).toBe('Contact [EMAIL_REDACTED] for details');
      expect(result.redactedCount).toBe(1);
      expect(result.redactedTypes).toContain('email');
    });

    it('should redact Korean RRN', () => {
      const result = service.mask('RRN is 900101-1234567');
      expect(result.masked).toBe('RRN is [RRN_REDACTED]');
      expect(result.redactedTypes).toContain('rrn_kr');
    });

    it('should redact US SSN', () => {
      const result = service.mask('SSN: 123-45-6789');
      expect(result.masked).toBe('SSN: [SSN_REDACTED]');
      expect(result.redactedTypes).toContain('ssn');
    });

    it('should redact credit card numbers', () => {
      const result = service.mask('Card: 4111-1111-1111-1111');
      expect(result.masked).toBe('Card: [CC_REDACTED]');
      expect(result.redactedTypes).toContain('credit_card');
    });

    it('should redact Korean phone numbers', () => {
      const result = service.mask('Call 010-1234-5678');
      expect(result.masked).toBe('Call [PHONE_REDACTED]');
      expect(result.redactedTypes).toContain('phone_kr');
    });

    it('should redact IP addresses', () => {
      const result = service.mask('Server at 192.168.1.100');
      expect(result.masked).toBe('Server at [IP_REDACTED]');
      expect(result.redactedTypes).toContain('ip_address');
    });

    it('should redact multiple PII types in one string', () => {
      const result = service.mask('Email john@test.com IP 10.0.0.1');
      expect(result.masked).toBe('Email [EMAIL_REDACTED] IP [IP_REDACTED]');
      expect(result.redactedCount).toBe(2);
      expect(result.redactedTypes).toEqual(expect.arrayContaining(['email', 'ip_address']));
    });

    it('should return unchanged text when no PII present', () => {
      const text = 'This is a normal message about sprint planning';
      const result = service.mask(text);
      expect(result.masked).toBe(text);
      expect(result.redactedCount).toBe(0);
      expect(result.redactedTypes).toHaveLength(0);
    });
  });

  describe('hasPii()', () => {
    it('should return true when PII is present', () => {
      expect(service.hasPii('Contact admin@test.com')).toBe(true);
    });

    it('should return false when no PII is present', () => {
      expect(service.hasPii('Normal text here')).toBe(false);
    });
  });
});
