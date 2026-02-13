import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { Action } from 'nestjs-slack-bolt';
import { DraftService } from '../drafts/draft.service.js';
import { DecisionService } from '../drafts/decision.service.js';
import { JiraIssueService, type CanonicalDraft } from '../jira/jira-issue.service.js';

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

interface SlackActionPayload {
  action: { value: string };
  ack: () => Promise<void>;
  body: { user: { id: string }; channel: { id: string } };
  client: {
    chat: {
      postMessage: (msg: { channel: string; text: string }) => Promise<void>;
    };
  };
}

@Controller()
export class SlackActionsController {
  private readonly logger = new Logger(SlackActionsController.name);

  constructor(
    private readonly draftService: DraftService,
    private readonly decisionService: DecisionService,
    private readonly jiraIssueService: JiraIssueService,
    private readonly configService: ConfigService,
  ) {}

  @Action('approve_draft')
  async onApprove({ action, ack, body, client }: SlackActionPayload) {
    await ack();
    const draftId = action.value;
    const userId = body.user.id;
    const draft = await this.draftService.approve(draftId, userId);

    const parsed = canonicalDraftValidator.safeParse(draft.content);
    if (!parsed.success) {
      const errorDetail = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      this.logger.error(`DRAFT_INVALID for ${draftId}: ${errorDetail}`);
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Draft approved but content is invalid: ${errorDetail}`,
      });
      return;
    }

    try {
      const canonicalDraft: CanonicalDraft = parsed.data;
      const result = await this.jiraIssueService.createIssue(canonicalDraft);
      await this.draftService.update(draftId, {
        status: 'executed',
        metadata: { jiraKey: result.jiraKey, jiraUrl: result.url },
      });
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Draft approved and Jira ticket created: ${result.jiraKey}`,
      });
    } catch (err) {
      this.logger.error(
        `Jira creation failed for draft ${draftId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Draft approved but Jira creation failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  @Action('reject_draft')
  async onReject({ action, ack, body, client }: SlackActionPayload) {
    await ack();
    const draftId = action.value;
    await this.draftService.reject(draftId);
    await client.chat.postMessage({
      channel: body.channel.id,
      text: 'Draft has been rejected.',
    });
  }

  @Action('edit_then_approve_draft')
  async onEditThenApprove({ action, ack, body, client }: SlackActionPayload) {
    await ack();
    const draftId = action.value;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    await client.chat.postMessage({
      channel: body.channel.id,
      text: `Please edit the draft and approve: ${frontendUrl}/drafts/${draftId}`,
    });
  }

  @Action('decision_create_jira_draft')
  async onDecisionCreateJiraDraft({
    action,
    ack,
    body,
    client,
  }: SlackActionPayload) {
    await ack();
    const decisionId = action.value;

    try {
      const decision = await this.decisionService.findById(decisionId);
      if (!decision) {
        await client.chat.postMessage({
          channel: body.channel.id,
          text: `Decision not found: ${decisionId}`,
        });
        return;
      }

      const draft = await this.draftService.create({
        type: 'jira_ticket',
        content: decision.content as Record<string, unknown>,
        sourceEventIds: [decisionId],
        metadata: {
          decisionId: decision.id,
          createdBy: body.user.id,
        },
      });

      this.logger.log(
        `Jira draft ${draft.id} created from decision ${decisionId}`,
      );

      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Jira draft created from decision. Review it here: ${frontendUrl}/drafts/${draft.id}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to create draft from decision ${decisionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Failed to create Jira draft: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  @Action('accept_decision')
  async onAcceptDecision({ action, ack, body, client }: SlackActionPayload) {
    await ack();
    const decisionId = action.value;

    try {
      const decision = await this.decisionService.findById(decisionId);
      if (!decision) {
        await client.chat.postMessage({
          channel: body.channel.id,
          text: `Decision not found: ${decisionId}`,
        });
        return;
      }

      await this.decisionService.updateStatus(decisionId, 'accepted');
      this.logger.log(
        `Decision ${decisionId} accepted by ${body.user.id}`,
      );

      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Decision recorded and accepted by <@${body.user.id}>.`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to accept decision ${decisionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Failed to accept decision: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  @Action('dismiss_decision')
  async onDismissDecision({ action, ack, body, client }: SlackActionPayload) {
    await ack();
    const decisionId = action.value;

    try {
      await this.decisionService.updateStatus(decisionId, 'dismissed');
      this.logger.log(
        `Decision ${decisionId} dismissed by ${body.user.id}`,
      );

      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Decision dismissed by <@${body.user.id}>.`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to dismiss decision ${decisionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `Failed to dismiss decision: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
