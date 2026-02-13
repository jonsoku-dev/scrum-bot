import { Body, Controller, Get, Headers, Inject, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { eq, gte } from 'drizzle-orm';
import type { Request } from 'express';
import { SlackNotificationService } from '../slack/slack-notification.service.js';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { jiraWebhookEvents } from '../shared/database/schema.js';
import { AuditLogService } from '../shared/audit-log.service.js';
import { Public } from '../shared/guards/public.decorator.js';

interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

interface JiraWebhookPayload {
  webhookEvent: string;
  timestamp: number;
  issue?: {
    id: string;
    key: string;
    self: string;
    fields: {
      summary: string;
      status?: { name: string };
      priority?: { name: string };
      assignee?: { displayName: string };
      [key: string]: unknown;
    };
  };
  changelog?: {
    items: JiraChangelogItem[];
  };
  [key: string]: unknown;
}

@Public()
@ApiTags('Jira Webhook')
@Controller('api/jira/webhook')
export class JiraWebhookController {
  private readonly logger = new Logger(JiraWebhookController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly slackNotification: SlackNotificationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Handle incoming Jira webhook' })
  @ApiResponse({ status: 201, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Body() payload: JiraWebhookPayload,
    @Req() req: Request,
    @Headers('x-hub-signature') signature?: string,
  ) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(payload);
    this.verifyWebhookSecret(signature, bodyStr);

    const webhookId = this.extractWebhookId(payload);
    const issue = payload.issue;

    if (!issue) {
      this.logger.warn('Received Jira webhook without issue data, skipping');
      return { ok: true, skipped: true, reason: 'no_issue_data' };
    }

    const issueKey = issue.key;
    const issueId = issue.id;
    const eventType = payload.webhookEvent;
    const summary = issue.fields.summary ?? '';
    const status = issue.fields.status?.name ?? '';
    const priority = issue.fields.priority?.name ?? '';
    const assignee = issue.fields.assignee?.displayName ?? null;
    const changedFields = payload.changelog?.items?.map((item) => ({
      field: item.field,
      fromString: item.fromString,
      toString: item.toString,
    })) ?? [];

    const existing = await this.db
      .select({ id: jiraWebhookEvents.id })
      .from(jiraWebhookEvents)
      .where(eq(jiraWebhookEvents.webhookId, webhookId))
      .limit(1);

    if (existing.length > 0) {
      this.logger.debug(`Duplicate webhook ${webhookId}, skipping`);
      return { ok: true, skipped: true, reason: 'duplicate' };
    }

    await this.db.insert(jiraWebhookEvents).values({
      webhookId,
      issueKey,
      issueId,
      eventType,
      rawPayload: payload,
      changedFields,
      summary,
      status,
      priority,
      assignee,
      processedAt: new Date(),
    });

    const channelId = this.configService.get<string>('JIRA_NOTIFY_CHANNEL_ID');
    if (channelId) {
      const jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL') ?? '';
      const issueUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issueKey}` : undefined;
      await this.slackNotification.postJiraNotification(channelId, {
        issueKey, summary, status, priority, assignee, changedFields, eventType,
      }, issueUrl);
    } else {
      this.logger.warn('JIRA_NOTIFY_CHANNEL_ID not configured, skipping Slack notification');
    }

    await this.auditLogService.log({
      actorType: 'SYSTEM',
      actorId: 'jira-webhook',
      action: 'JIRA_WEBHOOK_RECEIVED',
      targetType: 'jira_issue',
      targetId: issueKey,
      payload: { eventType, webhookId },
    });

    this.logger.log(`Processed Jira webhook: ${eventType} for ${issueKey}`);
    return { ok: true };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get 24h Jira activity summary' })
  @ApiResponse({ status: 200, description: 'Activity summary' })
  async getDailySummary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await this.db
      .select({
        issueKey: jiraWebhookEvents.issueKey,
        eventType: jiraWebhookEvents.eventType,
        changedFields: jiraWebhookEvents.changedFields,
        createdAt: jiraWebhookEvents.createdAt,
      })
      .from(jiraWebhookEvents)
      .where(gte(jiraWebhookEvents.createdAt, since))
      .orderBy(jiraWebhookEvents.createdAt);

    const groupedByIssue = new Map<string, typeof events>();
    for (const event of events) {
      const key = event.issueKey;
      const group = groupedByIssue.get(key) ?? [];
      group.push(event);
      groupedByIssue.set(key, group);
    }

    const issueKeys = [...groupedByIssue.keys()];
    const summaryLines = issueKeys.map((key) => {
      const issueEvents = groupedByIssue.get(key) ?? [];
      const eventTypes = [...new Set(issueEvents.map((e) => e.eventType))];
      return `${key}: ${issueEvents.length} event(s) — ${eventTypes.join(', ')}`;
    });

    return {
      summary: summaryLines.length > 0
        ? summaryLines.join('\n')
        : 'No Jira activity in the last 24 hours.',
      events,
      totalEvents: events.length,
    };
  }

  private extractWebhookId(payload: JiraWebhookPayload): string {
    const rawId = (payload as Record<string, unknown>)['id'];
    if (typeof rawId === 'string' || typeof rawId === 'number') {
      return String(rawId);
    }
    const issueKey = payload.issue?.key ?? 'unknown';
    return `${payload.timestamp}-${payload.webhookEvent}-${issueKey}`;
  }

  private verifyWebhookSecret(signature: string | undefined, body: string): void {
    const secret = this.configService.get<string>('JIRA_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('JIRA_WEBHOOK_SECRET not configured — rejecting webhook');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing x-hub-signature header');
    }

    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn('Jira webhook rejected: HMAC mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
