import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { jiraSyncLog } from '../shared/database/schema.js';
import { JiraClientService } from './jira-client.service.js';
import { JiraTransitionPolicyService } from './jira-transition-policy.service.js';
import { markdownToAdf } from './adf-converter.js';
import { createSpan, endSpan } from '../shared/tracing.js';
import { JiraApiException } from '../shared/exceptions/jira-api.exception.js';

export interface CanonicalDraft {
  projectKey?: string;
  issueType?: string;
  summary: string;
  descriptionMd?: string;
  acceptanceCriteria?: string[];
  priority?: string;
  labels?: string[];
  components?: string[];
  dueDate?: string;
  links?: string[];
  sourceCitations?: string[];
}

@Injectable()
export class JiraIssueService {
  private readonly logger = new Logger(JiraIssueService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly client: JiraClientService,
    private readonly configService: ConfigService,
    private readonly transitionPolicy: JiraTransitionPolicyService,
  ) {}

  async createIssue(draft: CanonicalDraft): Promise<{ jiraKey: string; url: string }> {
    const span = createSpan('jira.createIssue', { action: 'create' });
    try {
      const defaultProjectKey = this.configService.get<string>('JIRA_PROJECT_KEY') ?? 'PROJ';
      const projectKey = draft.projectKey ?? defaultProjectKey;
      const issueType = draft.issueType ?? 'Task';

      const hashInput = `${projectKey}:${issueType}:${draft.summary}:${draft.descriptionMd ?? ''}`;
      const contentHash = createHash('sha256').update(hashInput).digest('hex');

      const existing = await this.db
        .select({ jiraKey: jiraSyncLog.jiraKey })
        .from(jiraSyncLog)
        .where(
          and(
            eq(jiraSyncLog.contentHash, contentHash),
            eq(jiraSyncLog.action, 'create'),
          ),
        )
        .limit(1);

      if (existing.length > 0 && existing[0].jiraKey) {
        const existingKey = existing[0].jiraKey;
        const url = `${this.client.baseUrl}/browse/${existingKey}`;
        this.logger.warn(`Duplicate issue detected (hash=${contentHash.slice(0, 8)}), returning existing ${existingKey}`);
        endSpan(span);
        return { jiraKey: existingKey, url };
      }

      const description = markdownToAdf(draft.descriptionMd ?? '');

      const payload = {
        fields: {
          project: { key: projectKey },
          issuetype: { name: issueType },
          summary: draft.summary,
          description,
          ...(draft.priority ? { priority: { name: draft.priority } } : {}),
          ...(draft.labels && draft.labels.length > 0 ? { labels: draft.labels } : {}),
          ...(draft.dueDate ? { duedate: draft.dueDate } : {}),
        },
      };

      const result = await this.client.request<{ key: string }>({
        method: 'POST',
        path: '/rest/api/3/issue',
        body: payload,
      });

      const jiraKey = result.key;
      const url = `${this.client.baseUrl}/browse/${jiraKey}`;

      await this.db.insert(jiraSyncLog).values({
        jiraKey,
        action: 'create',
        contentHash,
        requestPayload: payload,
        responsePayload: result,
      });

      span.attributes.issueKey = jiraKey;
      endSpan(span);
      this.logger.log(JSON.stringify(span));
      return { jiraKey, url };
    } catch (error) {
      endSpan(span, error as Error);
      this.logger.error(JSON.stringify(span));
      throw error;
    }
  }

  async updateIssue(issueKey: string, draft: Partial<CanonicalDraft>): Promise<{ changed: boolean }> {
    const span = createSpan('jira.updateIssue', { action: 'update', issueKey });
    try {
      const current = await this.fetchCurrentFields(issueKey);
      const diff = this.computeDiff(current, draft);

      if (Object.keys(diff).length === 0) {
        this.logger.log(`No changes detected for ${issueKey}, skipping update`);
        endSpan(span);
        this.logger.log(JSON.stringify(span));
        return { changed: false };
      }

      await this.client.request<void>({
        method: 'PUT',
        path: `/rest/api/3/issue/${issueKey}`,
        body: { fields: diff },
      });

      endSpan(span);
      this.logger.log(JSON.stringify(span));
      return { changed: true };
    } catch (error) {
      endSpan(span, error as Error);
      this.logger.error(JSON.stringify(span));
      throw error;
    }
  }

  private async fetchCurrentFields(
    issueKey: string,
  ): Promise<Record<string, unknown>> {
    try {
      const issue = await this.client.request<{
        fields: Record<string, unknown>;
      }>({
        method: 'GET',
        path: `/rest/api/3/issue/${issueKey}?fields=summary,priority,labels,duedate`,
      });
      return issue.fields;
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to fetch current fields for ${issueKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private computeDiff(
    current: Record<string, unknown>,
    draft: Partial<CanonicalDraft>,
  ): Record<string, unknown> {
    const diff: Record<string, unknown> = {};

    if (draft.summary && draft.summary !== current.summary) {
      diff.summary = draft.summary;
    }
    if (draft.descriptionMd) {
      diff.description = markdownToAdf(draft.descriptionMd);
    }
    if (
      draft.priority &&
      draft.priority !== (current.priority as { name?: string } | null)?.name
    ) {
      diff.priority = { name: draft.priority };
    }
    if (draft.labels) {
      const currentLabels = (current.labels as string[] | null) ?? [];
      if (JSON.stringify(draft.labels.sort()) !== JSON.stringify(currentLabels.sort())) {
        diff.labels = draft.labels;
      }
    }
    if (draft.dueDate && draft.dueDate !== current.duedate) {
      diff.duedate = draft.dueDate;
    }

    return diff;
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    const span = createSpan('jira.transitionIssue', { action: 'transition', issueKey, transitionId });
    try {
      await this.client.request<void>({
        method: 'POST',
        path: `/rest/api/3/issue/${issueKey}/transitions`,
        body: { transition: { id: transitionId } },
      });

      endSpan(span);
      this.logger.log(JSON.stringify(span));
    } catch (error) {
      endSpan(span, error as Error);
      this.logger.error(JSON.stringify(span));
      throw error;
    }
  }

  async getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this.client.request<{ transitions: Array<{ id: string; name: string }> }>({
      method: 'GET',
      path: `/rest/api/3/issue/${issueKey}/transitions`,
    });
    return data.transitions;
  }

  async transitionByStatus(
    issueKey: string,
    targetStatus: string,
  ): Promise<void> {
    const mapping = this.transitionPolicy.findByTargetStatus(targetStatus);
    if (mapping) {
      await this.transitionIssue(issueKey, mapping.transitionId);
      return;
    }

    const available = await this.getTransitions(issueKey);
    const match = available.find(
      (t) => t.name.toLowerCase() === targetStatus.toLowerCase(),
    );
    if (match) {
      await this.transitionIssue(issueKey, match.id);
      return;
    }

    throw new JiraApiException(
      `No transition mapping found for target status "${targetStatus}" on ${issueKey}`,
    );
  }
}
