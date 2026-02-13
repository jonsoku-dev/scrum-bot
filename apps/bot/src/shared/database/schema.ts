import { randomUUID } from 'crypto';
import {
  mysqlTable,
  varchar,
  text,
  json,
  timestamp,
  int,
  uniqueIndex,
  boolean,
  double,
  index,
} from 'drizzle-orm/mysql-core';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
export interface SourceRef {
  type: string;
  url?: string;
  id: string;
}

// ---------------------------------------------------------------------------
// spec 2.1 — slack_message_raw (mapped to slackEvents)
// ---------------------------------------------------------------------------
export const slackEvents = mysqlTable(
  'slack_events',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    messageTs: varchar('message_ts', { length: 255 }).notNull(),
    threadTs: varchar('thread_ts', { length: 255 }),
    userId: varchar('user_id', { length: 255 }),
    botId: varchar('bot_id', { length: 255 }),                // spec 2.1
    eventType: varchar('event_type', { length: 100 })
      .notNull()
      .default('message'),
    text: text('text'),
    permalink: text('permalink'),
    rawPayload: json('raw_payload').notNull(),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('slack_events_channel_ts_idx').on(
      table.channelId,
      table.messageTs,
    ),
    index('slack_events_thread_ts_idx').on(table.threadTs),
  ],
);

// ---------------------------------------------------------------------------
// summaries (internal — channel/meeting summaries)
// ---------------------------------------------------------------------------
export const summaries = mysqlTable('summaries', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  summary: text('summary').notNull(),
  decisions: json('decisions').$type<
    Array<{ description: string; madeBy?: string }>
  >(),
  actionItems: json('action_items').$type<
    Array<{ type: string; description: string; assignee?: string }>
  >(),
  openQuestions: json('open_questions').$type<
    Array<{ question: string; raisedBy?: string }>
  >(),
  messageCount: int('message_count').notNull().default(0),
  sourceRefs: json('source_refs').$type<string[]>(),
  status: varchar('status', { length: 50 }).notNull().default('completed'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// spec 2.2 — context_chunk
// ---------------------------------------------------------------------------
export const contextChunks = mysqlTable(
  'context_chunks',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    sourceType: varchar('source_type', { length: 50 }).notNull(),    // SLACK_MESSAGE | MEETING_MINUTES | JIRA_ISSUE | MANUAL_DOC
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    content: text('content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }),            // spec 2.2 — SHA-256 for dedup
    embedding: json('embedding').$type<number[] | null>(),
    eventTime: timestamp('event_time'),                               // spec 2.2 — actual occurrence time
    weightRecency: double('weight_recency').default(1.0),             // spec 2.2 — temporal decay factor
    weightConfidence: double('weight_confidence').default(0.6),       // spec 2.2 — source confidence
    tags: json('tags').$type<string[]>(),                             // spec 2.2
    piiRedacted: boolean('pii_redacted').default(false),              // spec 2.2
    citations: json('citations').$type<SourceRef[]>(),                // spec 2.2
    metadata: json('metadata'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('context_chunks_content_hash_idx').on(table.contentHash),
    index('context_chunks_event_time_idx').on(table.eventTime),
  ],
);

// ---------------------------------------------------------------------------
// spec 2.3 — decision
// ---------------------------------------------------------------------------
export const decisions = mysqlTable(
  'decisions',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    draftId: varchar('draft_id', { length: 36 }),
    content: json('content').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('active'),   // PROPOSED | FINAL | REVOKED | SUPERSEDED
    supersededBy: varchar('superseded_by', { length: 36 }),
    decidedBy: varchar('decided_by', { length: 255 }),
    sourceRefs: json('source_refs').$type<string[]>(),
    metadata: json('metadata'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    // spec 2.3 additions
    title: text('title'),
    summary: text('summary'),
    effectiveFrom: timestamp('effective_from'),
    effectiveTo: timestamp('effective_to'),
    impactArea: json('impact_area').$type<string[]>(),              // e.g. ["billing", "auth", "ui"]
    createdBy: varchar('created_by', { length: 10 }),                // HUMAN | AI
    lastConfirmedAt: timestamp('last_confirmed_at'),
  },
  (table) => [
    index('decisions_status_idx').on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// spec 2.5 — draft_jira_issue (mapped to drafts)
// ---------------------------------------------------------------------------
export const drafts = mysqlTable(
  'drafts',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    type: varchar('type', { length: 255 }).notNull(),
    sourceEventIds: json('source_event_ids').$type<string[]>(),
    content: json('content').notNull().$type<Record<string, unknown>>(),
    status: varchar('status', { length: 255 }).notNull().default('pending'),  // DRAFT | NEEDS_REVIEW | APPROVED | COMMITTED | REJECTED
    approvedBy: varchar('approved_by', { length: 255 }),
    executedAt: timestamp('executed_at'),
    metadata: json('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
    // spec 2.5 additions
    createdFrom: varchar('created_from', { length: 50 }),            // SLACK | MEETING | MANUAL | JIRA_DIFF
    humanEditablePayload: json('human_editable_payload').$type<Record<string, unknown>>(),
    committedIssueKey: varchar('committed_issue_key', { length: 50 }),
  },
  (table) => [
    index('drafts_status_idx').on(table.status),
    index('drafts_created_from_idx').on(table.createdFrom),
  ],
);

// ---------------------------------------------------------------------------
// jira_sync_log (existing — operational log)
// ---------------------------------------------------------------------------
export const jiraSyncLog = mysqlTable('jira_sync_log', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  draftId: varchar('draft_id', { length: 36 }),
  jiraKey: varchar('jira_key', { length: 255 }),
  action: varchar('action', { length: 255 }).notNull(),
  contentHash: varchar('content_hash', { length: 64 }),
  requestPayload: json('request_payload'),
  responsePayload: json('response_payload'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// spec 2.6 — agent_run
// ---------------------------------------------------------------------------
export const agentRuns = mysqlTable(
  'agent_runs',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    draftId: varchar('draft_id', { length: 36 }),
    agentName: varchar('agent_name', { length: 100 }).notNull(),
    input: json('input'),
    output: json('output'),
    tokenUsage: json('token_usage').$type<{
      prompt: number;
      completion: number;
      total: number;
    }>(),
    durationMs: int('duration_ms'),
    status: varchar('status', { length: 50 }).notNull().default('pending'),  // SUCCESS | FAILED | ABORTED | TIMEOUT
    error: text('error'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    // spec 2.6 additions
    runKey: varchar('run_key', { length: 100 }),                     // external-facing key
    graphVersion: varchar('graph_version', { length: 50 }),
    triggerType: varchar('trigger_type', { length: 50 }),             // SLACK_EVENT | MEETING_UPLOAD | MANUAL_REVIEW | SCHEDULED
    inputRefs: json('input_refs').$type<SourceRef[]>(),
    stateStart: json('state_start').$type<Record<string, unknown>>(),
    stateEnd: json('state_end').$type<Record<string, unknown>>(),
    cost: json('cost').$type<Record<string, unknown>>(),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
  },
  (table) => [
    index('agent_runs_run_key_idx').on(table.runKey),
    index('agent_runs_draft_id_idx').on(table.draftId),
  ],
);

// ---------------------------------------------------------------------------
// spec 2.4 — jira_issue_snapshot (NEW)
// ---------------------------------------------------------------------------
export const jiraIssueSnapshots = mysqlTable(
  'jira_issue_snapshots',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    jiraCloudId: varchar('jira_cloud_id', { length: 255 }).notNull(),
    issueKey: varchar('issue_key', { length: 50 }).notNull(),
    issueId: varchar('issue_id', { length: 50 }).notNull(),
    projectKey: varchar('project_key', { length: 50 }).notNull(),
    summary: text('summary').notNull(),
    status: varchar('status', { length: 100 }).notNull(),
    priority: varchar('priority', { length: 50 }),
    rawJson: json('raw_json').notNull(),
    fetchedAt: timestamp('fetched_at').$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('jira_issue_snapshots_cloud_key_idx').on(
      table.jiraCloudId,
      table.issueKey,
    ),
  ],
);

// ---------------------------------------------------------------------------
// spec 2.7 — agent_message (NEW)
// ---------------------------------------------------------------------------
export const agentMessages = mysqlTable(
  'agent_messages',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    runId: varchar('run_id', { length: 36 }).notNull(),              // FK → agentRuns
    agentName: varchar('agent_name', { length: 50 }).notNull(),      // CONTEXT | BIZ | QA | DESIGN | SCRUM_MASTER
    role: varchar('role', { length: 20 }).notNull(),                  // SYSTEM | USER | ASSISTANT | TOOL
    content: text('content').notNull(),
    structuredOutput: json('structured_output').$type<Record<string, unknown>>(),
    citations: json('citations').$type<SourceRef[]>(),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  (table) => [
    index('agent_messages_run_id_idx').on(table.runId),
  ],
);

// ---------------------------------------------------------------------------
// spec 2.8 — approval (NEW)
// ---------------------------------------------------------------------------
export const approvals = mysqlTable(
  'approvals',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    approvalType: varchar('approval_type', { length: 50 }).notNull(), // JIRA_CREATE | JIRA_UPDATE | JIRA_TRANSITION
    status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | EXPIRED
    requestedBy: varchar('requested_by', { length: 255 }).notNull(),
    requestedVia: varchar('requested_via', { length: 20 }).notNull(),  // SLACK | DASHBOARD
    slackActionPayload: json('slack_action_payload').$type<Record<string, unknown>>(),
    draftId: varchar('draft_id', { length: 36 }).notNull(),           // FK → drafts
    expiresAt: timestamp('expires_at'),
    decidedBy: varchar('decided_by', { length: 255 }),
    decidedAt: timestamp('decided_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  (table) => [
    index('approvals_draft_id_idx').on(table.draftId),
    index('approvals_status_idx').on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// token_usage_log (existing — cost tracking)
// ---------------------------------------------------------------------------
export const tokenUsageLog = mysqlTable('token_usage_log', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  agentRunId: varchar('agent_run_id', { length: 36 }),
  model: varchar('model', { length: 100 }).notNull(),
  promptTokens: int('prompt_tokens').notNull().default(0),
  completionTokens: int('completion_tokens').notNull().default(0),
  totalTokens: int('total_tokens').notNull().default(0),
  estimatedCostUsd: varchar('estimated_cost_usd', { length: 20 }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// spec 2.9 — audit_log
// ---------------------------------------------------------------------------
export const auditLogs = mysqlTable(
  'audit_log',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    actorType: varchar('actor_type', { length: 20 }).notNull(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    payload: json('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  (table) => [
    index('audit_log_created_at_idx').on(table.createdAt),
    index('audit_log_actor_idx').on(table.actorType),
  ],
);

// ---------------------------------------------------------------------------
// jira_webhook_events (existing — Jira incoming events)
// ---------------------------------------------------------------------------
export const jiraWebhookEvents = mysqlTable('jira_webhook_events', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  webhookId: varchar('webhook_id', { length: 255 }).notNull().unique(),
  issueKey: text('issue_key').notNull(),
  issueId: text('issue_id').notNull(),
  eventType: text('event_type').notNull(),
  changedFields: json('changed_fields').$type<
    Array<{ field: string; fromString: string | null; toString: string | null }>
  >(),
  summary: text('summary'),
  status: text('status'),
  priority: text('priority'),
  assignee: text('assignee'),
  rawPayload: json('raw_payload').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// meeting_minutes (existing — uploaded meeting transcripts)
// ---------------------------------------------------------------------------
export const meetingMinutes = mysqlTable('meeting_minutes', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  title: text('title').notNull(),
  rawText: text('raw_text').notNull(),
  source: varchar('source', { length: 50 }).notNull().default('UPLOAD'),
  status: varchar('status', { length: 50 }).notNull().default('PROCESSING'),
  summaryId: varchar('summary_id', { length: 36 }),
  draftIds: json('draft_ids').$type<string[]>().default([]),
  uploadedBy: varchar('uploaded_by', { length: 255 }),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// system_settings (existing — key-value settings)
// ---------------------------------------------------------------------------
export const systemSettings = mysqlTable('system_settings', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: json('value').notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// api_keys (existing — auth)
// ---------------------------------------------------------------------------
export const apiKeys = mysqlTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 20 }).notNull().default('VIEWER'),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// evaluations (existing — LLM output quality tracking)
// ---------------------------------------------------------------------------
export interface EvalDimension {
  name: string;
  score: number;
  maxScore: number;
  reason?: string;
}

export interface EvalResult {
  dimensions: EvalDimension[];
  overallScore: number;
}

export const evaluations = mysqlTable('evaluations', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: varchar('target_id', { length: 255 }).notNull(),
  evaluatorType: varchar('evaluator_type', { length: 50 }).notNull(),
  dimensions: json('dimensions').notNull().$type<EvalDimension[]>(),
  overallScore: int('overall_score').notNull(),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type SlackEvent = typeof slackEvents.$inferSelect;
export type NewSlackEvent = typeof slackEvents.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type NewSummary = typeof summaries.$inferInsert;
export type ContextChunk = typeof contextChunks.$inferSelect;
export type NewContextChunk = typeof contextChunks.$inferInsert;
export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type JiraSyncLogEntry = typeof jiraSyncLog.$inferSelect;
export type NewJiraSyncLogEntry = typeof jiraSyncLog.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type JiraIssueSnapshot = typeof jiraIssueSnapshots.$inferSelect;
export type NewJiraIssueSnapshot = typeof jiraIssueSnapshots.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type TokenUsageLogEntry = typeof tokenUsageLog.$inferSelect;
export type NewTokenUsageLogEntry = typeof tokenUsageLog.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type JiraWebhookEvent = typeof jiraWebhookEvents.$inferSelect;
export type NewJiraWebhookEvent = typeof jiraWebhookEvents.$inferInsert;
export type MeetingMinutes = typeof meetingMinutes.$inferSelect;
export type NewMeetingMinutes = typeof meetingMinutes.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;
