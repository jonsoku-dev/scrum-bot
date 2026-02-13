import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { meetingMinutes } from '../shared/database/schema.js';
import { SummarizeService } from '../drafts/summarize.service.js';
import { DraftService } from '../drafts/draft.service.js';
import { AuditLogService } from '../shared/audit-log.service.js';
import { AppException } from '../shared/exceptions/app.exception.js';

const uploadMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  text: z.string().min(11, 'Meeting text must be longer than 10 characters'),
  uploadedBy: z.string().optional(),
});

@ApiTags('Meetings')
@Controller('api/meetings')
export class MeetingsController {
  private readonly logger = new Logger(MeetingsController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly summarizeService: SummarizeService,
    private readonly draftService: DraftService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('upload')
  @ApiOperation({ summary: 'Upload and process meeting minutes' })
  @ApiResponse({ status: 201, description: 'Meeting processed with summary and drafts' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async uploadMeeting(
    @Body() body: { title: string; text: string; uploadedBy?: string },
  ) {
    const parsed = uploadMeetingSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.format());
    }

    const { title, text, uploadedBy } = parsed.data;

    const meetingId = randomUUID();
    await this.db
      .insert(meetingMinutes)
      .values({
        id: meetingId,
        title,
        rawText: text,
        source: 'UPLOAD',
        status: 'PROCESSING',
        uploadedBy: uploadedBy ?? null,
      });
    const meetingRows = await this.db.select().from(meetingMinutes).where(eq(meetingMinutes.id, meetingId));
    const meeting = meetingRows[0];
    if (!meeting) {
      throw new AppException(`Meeting ${meetingId} not found after insert`);
    }

    this.logger.log(`Meeting "${title}" created: ${meeting.id}`);

    try {
      const result = await this.summarizeService.processMeetingMinutes(title, text);

      const draftIds: string[] = [];
      for (const action of result.actions) {
        const draft = await this.draftService.create({
          type: 'jira_ticket',
          sourceEventIds: [meeting.id],
          content: {
            summary: action.description,
            assignee: action.assignee,
            actionType: action.type,
            sourceMeetingId: meeting.id,
          },
          metadata: {
            origin: 'meeting_minutes',
            meetingTitle: title,
          },
        });
        draftIds.push(draft.id);
      }

      await this.db
        .update(meetingMinutes)
        .set({
          status: 'COMPLETED',
          summaryId: result.summaryId,
          draftIds,
          updatedAt: new Date(),
        })
        .where(eq(meetingMinutes.id, meeting.id));

      await this.auditLogService.log({
        actorType: uploadedBy ? 'HUMAN' : 'SYSTEM',
        actorId: uploadedBy ?? 'system',
        action: 'MEETING_UPLOAD',
        targetType: 'meeting_minutes',
        targetId: meeting.id,
        payload: {
          title,
          summaryId: result.summaryId,
          draftCount: draftIds.length,
        },
      });

      this.logger.log(
        `Meeting "${title}" processed — ${draftIds.length} draft(s) created`,
      );

      return {
        success: true,
        data: {
          meetingId: meeting.id,
          summaryId: result.summaryId,
          draftIds,
          summary: result.summary,
        },
      };
    } catch (error) {
      await this.db
        .update(meetingMinutes)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(meetingMinutes.id, meeting.id));

      this.logger.error(
        `Failed to process meeting "${title}": ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new InternalServerErrorException(
        'Failed to process meeting minutes',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List meeting minutes' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 50, max 100)' })
  @ApiResponse({ status: 200, description: 'List of meeting minutes' })
  async listMeetings(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 50, 100);

    const data = await this.db
      .select()
      .from(meetingMinutes)
      .orderBy(desc(meetingMinutes.createdAt))
      .limit(take);

    return {
      success: true,
      data,
      meta: { total: data.length },
    };
  }
}
