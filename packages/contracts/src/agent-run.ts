import { z } from "zod";

export const TriggerTypeEnum = z.enum([
  "SLACK_EVENT",
  "MEETING_UPLOAD",
  "MANUAL_REVIEW",
  "SCHEDULED",
]);

export const AgentRunStatusEnum = z.enum([
  "SUCCESS",
  "FAILED",
  "ABORTED",
  "TIMEOUT",
]);

export const TokenUsageSchema = z.object({
  prompt: z.number(),
  completion: z.number(),
  total: z.number(),
});

export const AgentRunSchema = z.object({
  graphVersion: z.string(),
  triggerType: TriggerTypeEnum,
  status: AgentRunStatusEnum,
  tokenUsage: TokenUsageSchema.optional(),
  error: z.string().optional(),
});

export type TriggerType = z.infer<typeof TriggerTypeEnum>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusEnum>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
