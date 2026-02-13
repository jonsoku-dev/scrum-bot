import { z } from "zod";

// Per DOC-06 section 5: Safety guardrails
export const guardrails = {
  maxGraphIterations: 5,
  llmRetryLimit: 2,
  confidenceThreshold: 0.85,
  costBudgetPerSprintUsd: 10,
  approvalExpiryHours: 48,
  noSourceCitationPolicy: "draft_only", // "draft_only" = can create draft but approval button is disabled
  costExceededPolicy: "degrade_to_summary", // skip reviews, only summarize/extract
} as const;

export const GuardrailsSchema = z.object({
  maxGraphIterations: z.number().min(1).max(20),
  llmRetryLimit: z.number().min(0).max(5),
  confidenceThreshold: z.number().min(0).max(1),
  costBudgetPerSprintUsd: z.number().min(0),
  approvalExpiryHours: z.number().min(1),
  noSourceCitationPolicy: z.enum(["draft_only", "block"]),
  costExceededPolicy: z.enum(["degrade_to_summary", "block"]),
});

export type Guardrails = z.infer<typeof GuardrailsSchema>;
