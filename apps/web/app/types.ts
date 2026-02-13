export interface Summary {
  id: string;
  channelId: string;
  summary: string;
  decisions: Array<{ content: string; confidence: number; citations: string[] }>;
  actionItems: Array<{ description: string; assignee?: string; citations: string[] }>;
  openQuestions: string[];
  messageCount: number;
  sourceRefs: string[];
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface Draft {
  id: string;
  type: 'jira_ticket' | 'decision' | 'action_item';
  sourceEventIds: string[];
  content: {
    projectKey?: string;
    issueType?: string;
    summary: string;
    descriptionMd?: string;
    acceptanceCriteria?: string[];
    priority?: string;
    labels?: string[];
    components?: string[];
    sourceCitations?: Array<{ type: string; url: string; id: string }>;
  };
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  approvedBy: string | null;
  executedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  draftId: string | null;
  content: {
    title: string;
    description: string;
    rationale?: string;
    impact?: string;
  };
  status: 'active' | 'superseded';
  supersededBy: string | null;
  decidedBy: string | null;
  sourceRefs: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  draftId: string | null;
  agentName: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  tokenUsage: { prompt: number; completion: number; total: number } | null;
  durationMs: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error: string | null;
  createdAt: string;
}
