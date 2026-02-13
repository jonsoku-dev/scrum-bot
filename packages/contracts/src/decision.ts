import { z } from "zod";
import { SourceCitationSchema } from "./source-citation.js";

export const DecisionStatusEnum = z.enum([
  "PROPOSED",
  "FINAL",
  "REVOKED",
  "SUPERSEDED",
]);

export const DecisionCreatedByEnum = z.enum(["HUMAN", "AI"]);

export const DecisionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  status: DecisionStatusEnum,
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  sourceRefs: z.array(SourceCitationSchema).optional(),
  impactArea: z.array(z.string()).optional(),
  createdBy: DecisionCreatedByEnum,
});

export type DecisionStatus = z.infer<typeof DecisionStatusEnum>;
export type DecisionCreatedBy = z.infer<typeof DecisionCreatedByEnum>;
export type Decision = z.infer<typeof DecisionSchema>;
