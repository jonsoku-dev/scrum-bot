CREATE TABLE `agent_messages` (
	`id` varchar(36) NOT NULL,
	`run_id` varchar(36) NOT NULL,
	`agent_name` varchar(50) NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` text NOT NULL,
	`structured_output` json,
	`citations` json,
	`created_at` timestamp,
	CONSTRAINT `agent_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` varchar(36) NOT NULL,
	`draft_id` varchar(36),
	`agent_name` varchar(100) NOT NULL,
	`input` json,
	`output` json,
	`token_usage` json,
	`duration_ms` int,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`error` text,
	`created_at` timestamp,
	`run_key` varchar(100),
	`graph_version` varchar(50),
	`trigger_type` varchar(50),
	`input_refs` json,
	`state_start` json,
	`state_end` json,
	`cost` json,
	`started_at` timestamp,
	`ended_at` timestamp,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`key_hash` varchar(255) NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'VIEWER',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_used_at` timestamp,
	`created_by` text,
	`created_at` timestamp,
	`updated_at` timestamp,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_key_hash_unique` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` varchar(36) NOT NULL,
	`approval_type` varchar(50) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'PENDING',
	`requested_by` varchar(255) NOT NULL,
	`requested_via` varchar(20) NOT NULL,
	`slack_action_payload` json,
	`draft_id` varchar(36) NOT NULL,
	`expires_at` timestamp,
	`decided_by` varchar(255),
	`decided_at` timestamp,
	`created_at` timestamp,
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` varchar(36) NOT NULL,
	`actor_type` varchar(20) NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`payload` json,
	`created_at` timestamp,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `context_chunks` (
	`id` varchar(36) NOT NULL,
	`source_type` varchar(50) NOT NULL,
	`source_id` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`content_hash` varchar(64),
	`embedding` json,
	`event_time` timestamp,
	`weight_recency` double DEFAULT 1,
	`weight_confidence` double DEFAULT 0.6,
	`tags` json,
	`pii_redacted` boolean DEFAULT false,
	`citations` json,
	`metadata` json,
	`created_at` timestamp,
	CONSTRAINT `context_chunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `context_chunks_content_hash_idx` UNIQUE(`content_hash`)
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` varchar(36) NOT NULL,
	`draft_id` varchar(36),
	`content` json NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`superseded_by` varchar(36),
	`decided_by` varchar(255),
	`source_refs` json,
	`metadata` json,
	`created_at` timestamp,
	`title` text,
	`summary` text,
	`effective_from` timestamp,
	`effective_to` timestamp,
	`impact_area` json,
	`created_by` varchar(10),
	`last_confirmed_at` timestamp,
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` varchar(36) NOT NULL,
	`type` varchar(255) NOT NULL,
	`source_event_ids` json,
	`content` json NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`approved_by` varchar(255),
	`executed_at` timestamp,
	`metadata` json,
	`created_at` timestamp,
	`updated_at` timestamp,
	`created_from` varchar(50),
	`human_editable_payload` json,
	`committed_issue_key` varchar(50),
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` varchar(36) NOT NULL,
	`target_type` varchar(50) NOT NULL,
	`target_id` varchar(255) NOT NULL,
	`evaluator_type` varchar(50) NOT NULL,
	`dimensions` json NOT NULL,
	`overall_score` int NOT NULL,
	`metadata` json,
	`created_at` timestamp,
	CONSTRAINT `evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jira_issue_snapshots` (
	`id` varchar(36) NOT NULL,
	`jira_cloud_id` varchar(255) NOT NULL,
	`issue_key` varchar(50) NOT NULL,
	`issue_id` varchar(50) NOT NULL,
	`project_key` varchar(50) NOT NULL,
	`summary` text NOT NULL,
	`status` varchar(100) NOT NULL,
	`priority` varchar(50),
	`raw_json` json NOT NULL,
	`fetched_at` timestamp,
	CONSTRAINT `jira_issue_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `jira_issue_snapshots_cloud_key_idx` UNIQUE(`jira_cloud_id`,`issue_key`)
);
--> statement-breakpoint
CREATE TABLE `jira_sync_log` (
	`id` varchar(36) NOT NULL,
	`draft_id` varchar(36),
	`jira_key` varchar(255),
	`action` varchar(255) NOT NULL,
	`content_hash` varchar(64),
	`request_payload` json,
	`response_payload` json,
	`created_at` timestamp,
	CONSTRAINT `jira_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jira_webhook_events` (
	`id` varchar(36) NOT NULL,
	`webhook_id` varchar(255) NOT NULL,
	`issue_key` text NOT NULL,
	`issue_id` text NOT NULL,
	`event_type` text NOT NULL,
	`changed_fields` json,
	`summary` text,
	`status` text,
	`priority` text,
	`assignee` text,
	`raw_payload` json NOT NULL,
	`processed_at` timestamp,
	`created_at` timestamp,
	CONSTRAINT `jira_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `jira_webhook_events_webhook_id_unique` UNIQUE(`webhook_id`)
);
--> statement-breakpoint
CREATE TABLE `meeting_minutes` (
	`id` varchar(36) NOT NULL,
	`title` text NOT NULL,
	`raw_text` text NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'UPLOAD',
	`status` varchar(50) NOT NULL DEFAULT 'PROCESSING',
	`summary_id` varchar(36),
	`draft_ids` json DEFAULT ('[]'),
	`uploaded_by` varchar(255),
	`metadata` json,
	`created_at` timestamp,
	`updated_at` timestamp,
	CONSTRAINT `meeting_minutes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slack_events` (
	`id` varchar(36) NOT NULL,
	`channel_id` varchar(255) NOT NULL,
	`message_ts` varchar(255) NOT NULL,
	`thread_ts` varchar(255),
	`user_id` varchar(255),
	`bot_id` varchar(255),
	`event_type` varchar(100) NOT NULL DEFAULT 'message',
	`text` text,
	`permalink` text,
	`raw_payload` json NOT NULL,
	`processed_at` timestamp,
	`created_at` timestamp,
	CONSTRAINT `slack_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `slack_events_channel_ts_idx` UNIQUE(`channel_id`,`message_ts`)
);
--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` varchar(36) NOT NULL,
	`channel_id` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`decisions` json,
	`action_items` json,
	`open_questions` json,
	`message_count` int NOT NULL DEFAULT 0,
	`source_refs` json,
	`status` varchar(50) NOT NULL DEFAULT 'completed',
	`created_at` timestamp,
	CONSTRAINT `summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` varchar(36) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` json NOT NULL,
	`updated_by` varchar(255),
	`created_at` timestamp,
	`updated_at` timestamp,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `token_usage_log` (
	`id` varchar(36) NOT NULL,
	`agent_run_id` varchar(36),
	`model` varchar(100) NOT NULL,
	`prompt_tokens` int NOT NULL DEFAULT 0,
	`completion_tokens` int NOT NULL DEFAULT 0,
	`total_tokens` int NOT NULL DEFAULT 0,
	`estimated_cost_usd` varchar(20),
	`created_at` timestamp,
	CONSTRAINT `token_usage_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `agent_messages_run_id_idx` ON `agent_messages` (`run_id`);--> statement-breakpoint
CREATE INDEX `agent_runs_run_key_idx` ON `agent_runs` (`run_key`);--> statement-breakpoint
CREATE INDEX `agent_runs_draft_id_idx` ON `agent_runs` (`draft_id`);--> statement-breakpoint
CREATE INDEX `approvals_draft_id_idx` ON `approvals` (`draft_id`);--> statement-breakpoint
CREATE INDEX `approvals_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_type`);--> statement-breakpoint
CREATE INDEX `context_chunks_event_time_idx` ON `context_chunks` (`event_time`);--> statement-breakpoint
CREATE INDEX `decisions_status_idx` ON `decisions` (`status`);--> statement-breakpoint
CREATE INDEX `drafts_status_idx` ON `drafts` (`status`);--> statement-breakpoint
CREATE INDEX `drafts_created_from_idx` ON `drafts` (`created_from`);--> statement-breakpoint
CREATE INDEX `slack_events_thread_ts_idx` ON `slack_events` (`thread_ts`);