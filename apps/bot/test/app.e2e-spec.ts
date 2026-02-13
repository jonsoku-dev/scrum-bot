import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

describe('App Bootstrap (e2e)', () => {
  it('should compile the test module without crashing', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            PORT: 8000,
            DATABASE_URL: 'mysql://test:test@localhost:3306/test',
            SLACK_BOT_TOKEN: 'xoxb-test-token',
            SLACK_SOCKET_MODE: false,
            OPENAI_API_KEY: 'test-key',
            OPENAI_MODEL: 'gpt-4o-mini',
            DAILY_BUDGET_USD: 10,
          })],
        }),
      ],
    }).compile();

    expect(moduleFixture).toBeDefined();

    const app: INestApplication = moduleFixture.createNestApplication();
    expect(app).toBeDefined();
    await app.close();
  });
});
