export interface GoldenSetCase {
  id: string;
  name: string;
  inputType: 'meeting_minutes' | 'slack_thread' | 'proposal';
  inputText: string;
  expectedSummary: {
    mustContainKeywords: string[];
    minLength: number;
  };
  expectedDraft: {
    summary: string;
    descriptionMd: string;
    acceptanceCriteria: string[];
    priority: string;
    sourceCitations: string[];
  };
  expectedDecisionSignals?: string[];
}

export const GOLDEN_SET: GoldenSetCase[] = [
  {
    id: 'golden-001',
    name: 'Meeting minutes with clear actions and decisions',
    inputType: 'meeting_minutes',
    inputText: [
      'Sprint Planning Meeting — 2025-02-10',
      '',
      'Attendees: Alice, Bob, Charlie',
      '',
      'Discussion:',
      '1. Alice: We need to migrate the auth service from JWT to OAuth2.',
      '   Decision: Team agreed to proceed with OAuth2 migration. Bob will lead.',
      '   Action: Bob should create a tech-spec document by Feb 14.',
      '',
      '2. Charlie raised concerns about the current caching strategy.',
      '   The Redis cluster is hitting memory limits during peak hours.',
      '   Action: Charlie will investigate Redis Cluster sharding options.',
      '   Action: Alice will benchmark Memcached as alternative.',
      '',
      '3. Bug report: Users in EU timezone see incorrect timestamps.',
      '   Decision: This is a P0 bug. Must fix before next release.',
      '   Action: Bob to investigate timezone handling in the formatter service.',
      '',
      'Open questions:',
      '- Should we support both OAuth2 and JWT during the migration period?',
      '- What is the budget for additional Redis nodes?',
    ].join('\n'),
    expectedSummary: {
      mustContainKeywords: ['OAuth2', 'Redis', 'timezone', 'decision', 'action'],
      minLength: 100,
    },
    expectedDraft: {
      summary: 'OAuth2 Migration & Redis Scaling Sprint Tasks',
      descriptionMd: [
        'Based on sprint planning meeting (2025-02-10):',
        '- Migrate auth from JWT to OAuth2 (led by Bob)',
        '- Investigate Redis Cluster sharding (Charlie)',
        '- Fix EU timezone bug in formatter (P0)',
      ].join('\n'),
      acceptanceCriteria: [
        'OAuth2 tech-spec document created and reviewed by team',
        'Redis sharding evaluation completed with recommendation',
        'Timezone bug fixed and verified for EU users',
      ],
      priority: 'P0',
      sourceCitations: ['sprint-planning-2025-02-10'],
    },
    expectedDecisionSignals: ['decision_keyword:decided'],
  },
  {
    id: 'golden-002',
    name: 'Slack thread with decision detection',
    inputType: 'slack_thread',
    inputText: [
      'Alice: Hey team, we need to decide on the database for the new analytics service.',
      'Bob: I think PostgreSQL would work well for our needs. It handles JSON queries nicely.',
      'Charlie: Agreed. PostgreSQL also has great partitioning for time-series data.',
      'Alice: OK so we have consensus — PostgreSQL it is. I will create the Jira ticket.',
      'Bob: 👍 Sounds good. Make sure to include the connection pooling requirements.',
      'Alice: 확정. I will also add pgBouncer setup to the acceptance criteria.',
    ].join('\n'),
    expectedSummary: {
      mustContainKeywords: ['PostgreSQL', 'analytics', 'consensus', 'decided'],
      minLength: 50,
    },
    expectedDraft: {
      summary: 'Set up PostgreSQL for analytics service',
      descriptionMd: [
        'Team decided to use PostgreSQL for the new analytics service.',
        'Key requirements:',
        '- JSON query support',
        '- Time-series data partitioning',
        '- Connection pooling via pgBouncer',
      ].join('\n'),
      acceptanceCriteria: [
        'PostgreSQL instance provisioned with partitioning configured',
        'pgBouncer connection pooling operational',
        'JSON query performance benchmarked',
      ],
      priority: 'P1',
      sourceCitations: ['slack-thread-analytics-db'],
    },
    expectedDecisionSignals: ['decision_keyword:consensus', 'decision_keyword:확정'],
  },
  {
    id: 'golden-003',
    name: 'Proposal text with review outputs',
    inputType: 'proposal',
    inputText: [
      'Proposal: Implement Feature Flags System',
      '',
      'Background:',
      'Our current deployment process requires full rollbacks when issues are found.',
      'A feature flag system would allow us to toggle features without redeployment.',
      '',
      'Technical approach:',
      '- Use LaunchDarkly SDK for server-side flags',
      '- Client-side flags via React context provider',
      '- Redis-backed local cache for flag evaluation (sub-ms latency)',
      '',
      'Risks:',
      '- Flag debt accumulation if unused flags are not cleaned up',
      '- Increased testing complexity with flag combinations',
      '',
      'Timeline: 3 sprints (6 weeks)',
      'Cost: LaunchDarkly Pro plan ~$500/month',
      '',
      'Recommendation: Proceed with implementation. The risk reduction from',
      'controlled rollouts outweighs the operational complexity.',
    ].join('\n'),
    expectedSummary: {
      mustContainKeywords: ['feature', 'flags', 'LaunchDarkly', 'rollout'],
      minLength: 80,
    },
    expectedDraft: {
      summary: 'Implement Feature Flags with LaunchDarkly',
      descriptionMd: [
        'Implement feature flag system using LaunchDarkly.',
        'Server-side: LaunchDarkly SDK',
        'Client-side: React context provider',
        'Caching: Redis-backed for sub-ms evaluation',
      ].join('\n'),
      acceptanceCriteria: [
        'LaunchDarkly SDK integrated on server and client',
        'Feature flag cleanup process documented and scheduled',
        'Flag evaluation latency under 1ms confirmed via Redis cache',
        'Testing strategy for flag combinations documented',
      ],
      priority: 'P2',
      sourceCitations: ['proposal-feature-flags'],
    },
  },
];
