import { z } from "zod";
import { SourceCitationSchema } from "./source-citation.js";

export const PriorityEnum = z.enum(["P0", "P1", "P2", "P3"]);

export const CanonicalDraftSchema = z.object({
  projectKey: z.string().optional(),
  issueType: z.string().optional(),
  summary: z.string(),
  descriptionMd: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: PriorityEnum.optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  links: z.array(z.string()).optional(),
  sourceCitations: z.array(SourceCitationSchema).optional(),
});

export type Priority = z.infer<typeof PriorityEnum>;
export type CanonicalDraft = z.infer<typeof CanonicalDraftSchema>;
