// Per DOC-05 section 4: Jira workflow transition mappings
// These are template defaults — actual transition IDs vary per Jira project
export const jiraTransitions = {
  default: {
    "To Do": "11",
    "In Progress": "21",
    "In Review": "31",
    Done: "41",
  },
} as const;

export type JiraTransitions = typeof jiraTransitions;
