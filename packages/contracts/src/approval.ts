import { z } from "zod";

export const ApprovalTypeEnum = z.enum([
  "JIRA_CREATE",
  "JIRA_UPDATE",
  "JIRA_TRANSITION",
]);

export const ApprovalStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
]);

export const ApprovalRequestedViaEnum = z.enum(["SLACK", "DASHBOARD"]);

export const ApprovalSchema = z.object({
  approvalType: ApprovalTypeEnum,
  status: ApprovalStatusEnum,
  requestedBy: z.string(),
  requestedVia: ApprovalRequestedViaEnum,
  expiresAt: z.string().datetime().optional(),
});

export type ApprovalType = z.infer<typeof ApprovalTypeEnum>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;
export type ApprovalRequestedVia = z.infer<typeof ApprovalRequestedViaEnum>;
export type Approval = z.infer<typeof ApprovalSchema>;
