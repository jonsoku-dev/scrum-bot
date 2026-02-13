import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/shared/database/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://scrum:scrum@localhost:3306/scrumbot',
  },
});
