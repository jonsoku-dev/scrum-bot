import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JiraAuthStrategy } from './jira-auth-strategy.interface.js';

@Injectable()
export class JiraOAuth2Strategy implements JiraAuthStrategy {
  private readonly logger = new Logger(JiraOAuth2Strategy.name);

  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('JIRA_OAUTH2_ACCESS_TOKEN') ?? '';
    this.refreshToken = this.configService.get<string>('JIRA_OAUTH2_REFRESH_TOKEN') ?? '';

    const ttl = this.configService.get<number>('JIRA_OAUTH2_TOKEN_TTL_SECONDS') ?? 3600;
    this.expiresAt = Date.now() + ttl * 1000;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    if (!this.accessToken) {
      throw new Error(
        'No OAuth 2.0 access token available. Set JIRA_OAUTH2_ACCESS_TOKEN or implement the authorization code flow.',
      );
    }
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  private isTokenExpired(): boolean {
    const bufferMs = 60_000;
    return Date.now() >= this.expiresAt - bufferMs;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      this.logger.warn('No refresh token available — cannot refresh OAuth 2.0 access token');
      return;
    }

    const clientId = this.configService.get<string>('JIRA_OAUTH2_CLIENT_ID');
    const clientSecret = this.configService.get<string>('JIRA_OAUTH2_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('JIRA_OAUTH2_CLIENT_ID and JIRA_OAUTH2_CLIENT_SECRET must be configured for token refresh');
    }

    const { default: axios } = await import('axios');

    const response = await axios.post<{ access_token: string; expires_in: number; refresh_token?: string }>(
      'https://auth.atlassian.com/oauth/token',
      {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.refreshToken,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 },
    );

    this.accessToken = response.data.access_token;
    this.expiresAt = Date.now() + response.data.expires_in * 1000;
    if (response.data.refresh_token) {
      this.refreshToken = response.data.refresh_token;
    }

    this.logger.log('OAuth 2.0 access token refreshed successfully');
  }
}
