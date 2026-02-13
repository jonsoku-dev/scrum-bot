export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const QUERY_KEYS = {
  DRAFTS: 'drafts',
  DECISIONS: 'decisions',
  SUMMARIES: 'summaries',
  RUNS: 'runs',
  MEETINGS: 'meetings',
  SETTINGS: 'settings',
} as const;

export const ROUTES = {
  DASHBOARD: '/dashboard',
  MEETINGS: '/meetings',
  DRAFTS: '/drafts',
  APPROVALS: '/approvals',
  DECISIONS: '/decisions',
  SETTINGS: '/settings',
} as const;
