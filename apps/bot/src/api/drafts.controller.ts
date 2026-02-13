import {
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { DraftService } from '../drafts/draft.service.js';
import { JiraIssueService, type CanonicalDraft } from '../jira/jira-issue.service.js';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { jiraSyncLog } from '../shared/database/schema.js';
import { z } from 'zod';

const updateDraftSchema = z.object({
  content: z.record(z.unknown()).optional(),
  status: z.string().optional(),
});

const approveDraftSchema = z.object({
  approvedBy: z.string().min(1).optional(),
});

const canonicalDraftValidator = z.object({
  projectKey: z.string().optional(),
  issueType: z.string().optional(),
  summary: z.string(),
  descriptionMd: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  links: z.array(z.string()).optional(),
  sourceCitations: z.array(z.string()).optional(),
});

@ApiTags('Drafts')
@Controller('api/drafts')
export class DraftsController {
  private readonly logger = new Logger(DraftsController.name);

  constructor(
    private readonly draftService: DraftService,
    private readonly jiraIssueService: JiraIssueService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List drafts' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiResponse({ status: 200, description: 'List of drafts' })
  async listDrafts(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const data = await this.draftService.findAll({
      status,
      type,
    });

    return {
      success: true,
      data,
      meta: { total: data.length },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get draft by ID' })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiResponse({ status: 200, description: 'Draft details' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async getDraft(@Param('id') id: string) {
    const data = await this.draftService.findById(id);
    if (!data) {
      throw new NotFoundException(`Draft ${id} not found`);
    }

    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft' })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiResponse({ status: 200, description: 'Draft updated' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async updateDraft(
    @Param('id') id: string,
    @Body() body: { content?: Record<string, unknown>; status?: string },
  ) {
    const parsed = updateDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.format());
    }

    const data = await this.draftService.update(id, body);
    if (!data) {
      throw new NotFoundException(`Draft ${id} not found`);
    }

    return {
      success: true,
      data,
    };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a draft and execute Jira action' })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiResponse({ status: 201, description: 'Draft approved' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async approveDraft(
    @Param('id') id: string,
    @Body() body: { approvedBy?: string },
    @Req() req: Request,
  ) {
    const parsed = approveDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.format());
    }

    const user = (req as unknown as Record<string, unknown>)['user'] as { id: string; name: string; role: string } | undefined;
    const approvedBy = parsed.data.approvedBy ?? user?.name ?? 'unknown';

    const data = await this.draftService.approve(id, approvedBy);
    if (!data) {
      throw new NotFoundException(`Draft ${id} not found`);
    }

    const jiraResult = await this.executeJiraAction(id, data);

    return {
      success: true,
      data,
      ...(jiraResult ? { jira: jiraResult } : {}),
    };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a draft' })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiResponse({ status: 201, description: 'Draft rejected' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async rejectDraft(@Param('id') id: string) {
    const data = await this.draftService.reject(id);
    if (!data) {
      throw new NotFoundException(`Draft ${id} not found`);
    }

    return {
      success: true,
      data,
    };
  }

  private async executeJiraAction(
    draftId: string,
    draft: { content: Record<string, unknown>; metadata: Record<string, unknown> | null },
  ): Promise<{ action: string; jiraKey?: string; error?: string } | null> {
    const metadata = draft.metadata ?? {};
    const jiraAction = (metadata.jiraAction as string) ?? 'create';
    const issueKey = metadata.issueKey as string | undefined;
    const transitionId = metadata.transitionId as string | undefined;

    try {
      if (jiraAction === 'update' && issueKey) {
        const requestPayload = draft.content;
        const parsed = canonicalDraftValidator.partial().safeParse(draft.content);
        if (!parsed.success) {
          return { action: 'update', error: `DRAFT_INVALID: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
        }
        await this.jiraIssueService.updateIssue(issueKey, parsed.data);
        await this.logJiraSync(draftId, issueKey, 'update', requestPayload, { ok: true });
        await this.draftService.update(draftId, {
          status: 'executed',
          metadata: { ...metadata, executedAction: 'update' },
        });
        return { action: 'update', jiraKey: issueKey };
      }

      if (jiraAction === 'transition' && issueKey && transitionId) {
        const requestPayload = { issueKey, transitionId };
        await this.jiraIssueService.transitionIssue(issueKey, transitionId);
        await this.logJiraSync(draftId, issueKey, 'transition', requestPayload, { ok: true });
        await this.draftService.update(draftId, {
          status: 'executed',
          metadata: { ...metadata, executedAction: 'transition' },
        });
        return { action: 'transition', jiraKey: issueKey };
      }

      const requestPayload = draft.content;
      const parsed = canonicalDraftValidator.safeParse(draft.content);
      if (!parsed.success) {
        return { action: 'create', error: `DRAFT_INVALID: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
      }
      const result = await this.jiraIssueService.createIssue(parsed.data);
      await this.logJiraSync(draftId, result.jiraKey, 'create', requestPayload, result);
      await this.draftService.update(draftId, {
        status: 'executed',
        metadata: { ...metadata, jiraKey: result.jiraKey, jiraUrl: result.url },
      });
      return { action: 'create', jiraKey: result.jiraKey };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Jira ${jiraAction} failed for draft ${draftId}: ${errorMessage}`);
      await this.draftService.update(draftId, {
        status: 'approved',
        metadata: { ...metadata, jiraError: errorMessage },
      });
      return { action: jiraAction, error: errorMessage };
    }
  }

  private async logJiraSync(
    draftId: string,
    jiraKey: string,
    action: string,
    requestPayload: unknown,
    responsePayload: unknown,
  ): Promise<void> {
    try {
      await this.db.insert(jiraSyncLog).values({
        draftId,
        jiraKey,
        action,
        requestPayload,
        responsePayload,
      });
    } catch (err) {
      this.logger.error(
        `Failed to log jiraSyncLog: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}