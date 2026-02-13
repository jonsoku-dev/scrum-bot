import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JiraAuthStrategy } from './jira-auth-strategy.interface.js';

@Injectable()
export class JiraBasicAuthStrategy implements JiraAuthStrategy {
  constructor(private readonly configService: ConfigService) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    const email = this.configService.get<string>('JIRA_EMAIL');
    const apiToken = this.configService.get<string>('JIRA_API_TOKEN');
    if (!email || !apiToken) {
      throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be configured');
    }
    const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
}
