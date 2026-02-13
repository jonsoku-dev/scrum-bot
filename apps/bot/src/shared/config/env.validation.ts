import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-').optional(),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_SOCKET_MODE: z.coerce.boolean().default(true),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_EMAIL: z.string().email().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  JIRA_PROJECT_KEY: z.string().optional().default('PROJ'),
  DAILY_BUDGET_USD: z.coerce.number().default(10),
  JIRA_WEBHOOK_SECRET: z.string().optional(),
  JIRA_NOTIFY_CHANNEL_ID: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATA_RETENTION_DAYS: z.coerce.number().default(90),
  DAILY_SCRUM_CHANNELS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8000'),
  MAX_GRAPH_ITERATIONS: z.coerce.number().default(25),
  FRONTEND_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.format();
    throw new Error(
      `Environment validation failed:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }
  return parsed.data;
}
