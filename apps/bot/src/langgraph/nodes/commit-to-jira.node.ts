import { Injectable, Logger, Optional } from '@nestjs/common';
import { z } from 'zod';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { JiraIssueService, type CanonicalDraft } from '../../jira/jira-issue.service.js';

const canonicalDraftValidator = z.object({
  projectKey: z.string().optional(),
  issueType: z.string().optional(),
  summary: z.string(),
  descriptionMd: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  links: z.array(z.string()).optional(),
  sourceCitations: z.array(z.string()).optional(),
});

@Injectable()
export class CommitToJiraNode {
  private readonly logger = new Logger(CommitToJiraNode.name);

  constructor(
    @Optional() private readonly jiraIssueService?: JiraIssueService,
  ) {}

  async invoke(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    if (!this.jiraIssueService) {
      this.logger.warn('Jira not configured, skipping commit');
      return { jiraResult: { error: 'Jira not configured' } };
    }

    if (!state.draft || state.approval?.status !== 'approved') {
      const reason = !state.draft
        ? 'No draft available'
        : 'Draft not approved';
      this.logger.warn(`Skipping Jira commit: ${reason}`);
      return { jiraResult: { error: reason } };
    }

    const parsed = canonicalDraftValidator.safeParse(state.draft);
    if (!parsed.success) {
      const errorDetail = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      this.logger.error(`DRAFT_INVALID: ${errorDetail}`);
      return { jiraResult: { error: `DRAFT_INVALID: ${errorDetail}` } };
    }

    try {
      const draft: CanonicalDraft = parsed.data;
      const result = await this.jiraIssueService.createIssue(draft);
      this.logger.log(`Created Jira issue ${result.jiraKey}`);
      return {
        jiraResult: { issueKey: result.jiraKey, url: result.url },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create Jira issue: ${message}`);
      return { jiraResult: { error: message } };
    }
  }
}
