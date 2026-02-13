// Per DOC-05 section 2: CanonicalDraft → Jira API field mapping
export const jiraFieldMapping = {
  projectKey: "fields.project.key",
  issueType: "fields.issuetype.name",
  summary: "fields.summary",
  descriptionMd: "fields.description", // requires ADF conversion
  priority: "fields.priority.name",
  labels: "fields.labels",
  components: "fields.components[].name",
  dueDate: "fields.duedate",
} as const;

export type JiraFieldMapping = typeof jiraFieldMapping;
