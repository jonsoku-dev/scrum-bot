import { z } from "zod";

// Slack trigger policies per DOC-04 section 3.1
export const slackTriggerPolicy = {
  decisionSignals: {
    keywords: [
      "확정",
      "결정",
      "진행",
      "이대로",
      "배포",
      "decided",
      "agreed",
      "consensus",
      "approved",
      "chosen",
    ],
    reactions: ["white_check_mark", "heavy_check_mark"],
    requiredConfidence: 0.85,
    rule: "keyword AND reaction, OR decision_card_click",
  },
  changeSignals: {
    keywords: [
      "변경",
      "수정",
      "롤백",
      "우선순위",
      "change",
      "modify",
      "rollback",
    ],
    minAgreement: 2,
    rule: "keyword AND thread_agreement >= minAgreement",
  },
  ticketSignals: {
    keywords: ["티켓", "Jira", "등록", "ticket", "create"],
    commands: ["/scrum-draft"],
    rule: "keyword OR command",
  },
  channelPolicies: {
    "pjt-scrum": {
      allowedActions: ["daily_summary", "weekly_summary"],
      rateLimit: "1/day",
    },
    "pjt-discuss": {
      allowedActions: ["review_request", "risk_analysis"],
      rateLimit: "5/hour",
    },
    "pjt-decisions": {
      allowedActions: ["decision_card"],
      rateLimit: "10/day",
    },
    "pjt-dev-alert": {
      allowedActions: ["jira_status_change", "deploy_alert"],
      rateLimit: "50/day",
    },
  },
} as const;

const SignalKeywordsSchema = z.object({
  keywords: z.array(z.string()),
  reactions: z.array(z.string()),
  requiredConfidence: z.number().min(0).max(1),
  rule: z.string(),
});

const ChangeSignalSchema = z.object({
  keywords: z.array(z.string()),
  minAgreement: z.number().min(1),
  rule: z.string(),
});

const TicketSignalSchema = z.object({
  keywords: z.array(z.string()),
  commands: z.array(z.string()),
  rule: z.string(),
});

const ChannelPolicySchema = z.object({
  allowedActions: z.array(z.string()),
  rateLimit: z.string(),
});

export const SlackTriggerPolicySchema = z.object({
  decisionSignals: SignalKeywordsSchema,
  changeSignals: ChangeSignalSchema,
  ticketSignals: TicketSignalSchema,
  channelPolicies: z.record(z.string(), ChannelPolicySchema),
});

export type SlackTriggerPolicy = z.infer<typeof SlackTriggerPolicySchema>;
