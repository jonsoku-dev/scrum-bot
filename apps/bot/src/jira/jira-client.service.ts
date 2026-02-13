import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JiraApiException } from '../shared/exceptions/jira-api.exception.js';
import { JIRA_AUTH_STRATEGY, type JiraAuthStrategy } from './auth/index.js';

interface JiraRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

@Injectable()
export class JiraClientService {
  private readonly logger = new Logger(JiraClientService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(JIRA_AUTH_STRATEGY) private readonly authStrategy: JiraAuthStrategy,
  ) {}

  get baseUrl(): string {
    const url = this.configService.get<string>('JIRA_BASE_URL');
    if (!url) throw new JiraApiException('JIRA_BASE_URL is not configured');
    return url;
  }

  async request<T>(options: JiraRequestOptions): Promise<T> {
    const authHeaders = await this.authStrategy.getAuthHeaders();
    const url = `${this.baseUrl}${options.path}`;

    const response = await axios({
      url,
      method: options.method,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: options.body,
      timeout: 30_000,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      const errorBody =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
      this.logger.error(`Jira API error: ${response.status} ${errorBody}`);
      throw new JiraApiException(`Jira API returned ${response.status}: ${errorBody}`, response.status);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.data as T;
  }
}
