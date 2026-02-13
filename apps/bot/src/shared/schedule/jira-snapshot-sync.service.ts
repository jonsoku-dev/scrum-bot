import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.provider.js';
import { jiraIssueSnapshots } from '../database/schema.js';
import { JiraClientService } from '../../jira/jira-client.service.js';

interface JiraSearchResponse {
  issues: Array<{
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      priority?: { name: string };
      [key: string]: unknown;
    };
  }>;
  total: number;
  startAt: number;
  maxResults: number;
}

@Injectable()
export class JiraSnapshotSyncService {
  private readonly logger = new Logger(JiraSnapshotSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jiraClient: JiraClientService,
    private readonly configService: ConfigService,
  ) {}

  async syncOpenIssues(): Promise<{ upserted: number; total: number }> {
    const projectKey = this.configService.get<string>('JIRA_PROJECT_KEY');
    if (!projectKey) {
      this.logger.warn('JIRA_PROJECT_KEY not configured, skipping snapshot sync');
      return { upserted: 0, total: 0 };
    }

    const jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL');
    if (!jiraBaseUrl) {
      this.logger.warn('JIRA_BASE_URL not configured, skipping snapshot sync');
      return { upserted: 0, total: 0 };
    }

    const jiraCloudId = new URL(jiraBaseUrl).hostname;
    let startAt = 0;
    const maxResults = 50;
    let upserted = 0;
    let total = 0;

    do {
      const jql = `project = ${projectKey} AND resolution = Unresolved ORDER BY updated DESC`;
      const response = await this.jiraClient.request<JiraSearchResponse>({
        method: 'GET',
        path: `/rest/api/3/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,status,priority`,
      });

      total = response.total;

      for (const issue of response.issues) {
        await this.upsertSnapshot(jiraCloudId, issue);
        upserted++;
      }

      startAt += response.issues.length;
    } while (startAt < total);

    this.logger.log(`Snapshot sync completed: ${upserted} issues upserted out of ${total}`);
    return { upserted, total };
  }

  private async upsertSnapshot(
    jiraCloudId: string,
    issue: JiraSearchResponse['issues'][number],
  ): Promise<void> {
    const existing = await this.db
      .select({ id: jiraIssueSnapshots.id })
      .from(jiraIssueSnapshots)
      .where(
        and(
          eq(jiraIssueSnapshots.jiraCloudId, jiraCloudId),
          eq(jiraIssueSnapshots.issueKey, issue.key),
        ),
      )
      .limit(1);

    const snapshotData = {
      jiraCloudId,
      issueKey: issue.key,
      issueId: issue.id,
      projectKey: issue.key.split('-')[0],
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name ?? null,
      rawJson: issue,
      fetchedAt: new Date(),
    };

    if (existing.length > 0) {
      await this.db
        .update(jiraIssueSnapshots)
        .set(snapshotData)
        .where(eq(jiraIssueSnapshots.id, existing[0].id));
    } else {
      await this.db.insert(jiraIssueSnapshots).values(snapshotData);
    }
  }
}
