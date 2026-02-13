import { z } from "zod";

export const SourceCitationTypeEnum = z.enum([
  "SLACK_MESSAGE",
  "MEETING_MINUTES",
  "JIRA_ISSUE",
  "MANUAL_DOC",
]);

export const SourceCitationSchema = z.object({
  type: SourceCitationTypeEnum,
  url: z.string(),
  id: z.string(),
});

export type SourceCitationType = z.infer<typeof SourceCitationTypeEnum>;
export type SourceCitation = z.infer<typeof SourceCitationSchema>;
