import { Injectable, Logger } from '@nestjs/common';

export interface PiiMaskResult {
  masked: string;
  redactedCount: number;
  redactedTypes: string[];
}

@Injectable()
export class PiiMaskingService {
  private readonly logger = new Logger(PiiMaskingService.name);

  private readonly patterns: Array<{
    name: string;
    regex: RegExp;
    replacement: string;
  }> = [
    {
      name: 'email',
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: '[EMAIL_REDACTED]',
    },
    {
      name: 'rrn_kr',
      regex: /\d{6}-?[1-4]\d{6}/g,
      replacement: '[RRN_REDACTED]',
    },
    {
      name: 'ssn',
      regex: /\d{3}-\d{2}-\d{4}/g,
      replacement: '[SSN_REDACTED]',
    },
    {
      name: 'credit_card',
      regex: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
      replacement: '[CC_REDACTED]',
    },
    {
      name: 'phone_kr',
      regex: /01[0-9]-?\d{3,4}-?\d{4}/g,
      replacement: '[PHONE_REDACTED]',
    },
    {
      name: 'phone_us',
      regex: /(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
      replacement: '[PHONE_REDACTED]',
    },
    {
      name: 'ip_address',
      regex: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
      replacement: '[IP_REDACTED]',
    },
  ];

  mask(text: string): PiiMaskResult {
    let masked = text;
    let redactedCount = 0;
    const redactedTypes: string[] = [];

    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      const matches = masked.match(pattern.regex);
      if (matches && matches.length > 0) {
        redactedCount += matches.length;
        redactedTypes.push(pattern.name);
        pattern.regex.lastIndex = 0;
        masked = masked.replace(pattern.regex, pattern.replacement);
      }
    }

    return { masked, redactedCount, redactedTypes };
  }

  hasPii(text: string): boolean {
    return this.patterns.some((p) => {
      p.regex.lastIndex = 0;
      return p.regex.test(text);
    });
  }
}
