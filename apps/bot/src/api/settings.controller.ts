import {
  Controller,
  Get,
  Put,
  Body,
  Inject,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { systemSettings } from '../shared/database/schema.js';
import { Roles } from '../shared/guards/roles.decorator.js';
import { AuditLogService } from '../shared/audit-log.service.js';

const KNOWN_KEYS = [
  'decisionKeywords',
  'confidenceThreshold',
  'maxGraphIterations',
  'costBudgetPerSprintUsd',
] as const;

const DEFAULT_SETTINGS: Record<string, unknown> = {
  decisionKeywords: [
    'decided',
    'agreed',
    'consensus',
    'approved',
    'chosen',
    '확정',
    '결정',
    '진행',
    '이대로',
    '배포',
  ],
  confidenceThreshold: 0.85,
  maxGraphIterations: 5,
  costBudgetPerSprintUsd: 10,
};

const updateSettingsSchema = z
  .object({
    decisionKeywords: z.array(z.string().min(1)).optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
    maxGraphIterations: z.number().int().min(1).max(50).optional(),
    costBudgetPerSprintUsd: z.number().min(0).optional(),
  })
  .strict();

@Roles('ADMIN')
@ApiTags('Settings')
@Controller('api/settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get system settings and connection status' })
  @ApiResponse({ status: 200, description: 'System settings' })
  async getSettings() {
    const rows = await this.db.select().from(systemSettings);

    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    const slackToken = this.configService.get<string>('SLACK_BOT_TOKEN');
    const jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL');
    const jiraEmail = this.configService.get<string>('JIRA_EMAIL');

    const connections = {
      slack: {
        connected: !!slackToken,
      },
      jira: {
        connected: !!(jiraBaseUrl && jiraEmail),
        baseUrl: jiraBaseUrl || null,
      },
    };

    settings.llmModel = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    settings.embeddingModel = this.configService.get<string>('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
    settings.dataRetentionDays = Number(this.configService.get<string>('DATA_RETENTION_DAYS', '90'));

    return { settings, connections };
  }

  @Put()
  @ApiOperation({ summary: 'Update system settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiResponse({ status: 400, description: 'Invalid settings' })
  async updateSettings(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.format());
    }

    const data = parsed.data;
    const updatedSettings: Record<string, unknown> = {};

    for (const key of KNOWN_KEYS) {
      if (data[key] !== undefined) {
        const jsonValue: unknown = data[key];

        await this.db
          .insert(systemSettings)
          .values({
            key,
            value: jsonValue,
            updatedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              value: jsonValue,
              updatedAt: new Date(),
            },
          });

        updatedSettings[key] = jsonValue;
        this.logger.log(`Setting "${key}" updated`);

        const user = (req as unknown as Record<string, unknown>)['user'] as { id: string; name: string } | undefined;
        await this.auditLogService.log({
          actorType: 'HUMAN',
          actorId: user?.id ?? 'unknown',
          action: 'POLICY_UPDATE',
          targetType: 'system_settings',
          targetId: key,
          payload: { newValue: jsonValue },
        });
      }
    }

    const rows = await this.db.select().from(systemSettings);
    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return { success: true, settings };
  }
}
