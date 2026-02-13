import { z } from 'zod';

export const SourceCitationSchema = z.object({
  type: z.string(),
  url: z.string(),
  id: z.string(),
});

export const DraftContentSchema = z.object({
  summary: z.string(),
  descriptionMd: z.string().optional(),
  priority: z.string().optional(),
  issueType: z.string().optional(),
  projectKey: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  sourceCitations: z.array(SourceCitationSchema).optional(),
  confidence: z.number().optional(),
});

export const DraftSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  content: DraftContentSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.object({
    confidence: z.number().optional(),
    previousContent: z.unknown().optional(),
  }).optional(),
});

export const DecisionSchema = z.object({
  id: z.string(),
  status: z.string(),
  content: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  decidedBy: z.string().optional(),
  supersededBy: z.string().optional().nullable(),
  sourceRefs: z.array(z.string()).optional(),
  impactArea: z.array(z.string()).optional().nullable(),
  createdBy: z.string().optional().nullable(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  createdAt: z.string(),
});

export const SummarySchema = z.object({
  id: z.string(),
  channelId: z.string(),
  status: z.string(),
  summary: z.string(),
  messageCount: z.number(),
  createdAt: z.string(),
  decisions: z.array(z.unknown()).optional(),
  actionItems: z.array(z.unknown()).optional(),
});

export const AgentRunSchema = z.object({
  id: z.string(),
  agentName: z.string(),
  status: z.string(),
  createdAt: z.string(),
  durationMs: z.number().optional().nullable(),
  error: z.string().optional().nullable(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  tokenUsage: z.object({
    total: z.number(),
    prompt: z.number(),
    completion: z.number(),
  }).optional().nullable(),
});

export const RunTimelineSchema = z.object({
  run: AgentRunSchema,
  relatedRuns: z.array(AgentRunSchema).optional(),
});
