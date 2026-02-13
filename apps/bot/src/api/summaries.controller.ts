import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { summaries } from '../shared/database/schema.js';
import { SummarizeService } from '../drafts/summarize.service.js';

const summarizeSchema = z.object({
  channelId: z.string().min(1),
  messageCount: z.number().optional().default(50),
});

@ApiTags('Summaries')
@Controller('api')
export class SummariesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly summarizeService: SummarizeService,
  ) {}

  @Get('summaries')
  @ApiOperation({ summary: 'List summaries' })
  @ApiResponse({ status: 200, description: 'List of summaries' })
  async listSummaries() {
    try {
      const data = await this.db
        .select()
        .from(summaries)
        .orderBy(desc(summaries.createdAt))
        .limit(50);

      return {
        success: true,
        data,
        meta: { total: data.length },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to list summaries');
    }
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('summarize')
  @ApiOperation({ summary: 'Summarize a channel', description: 'Generate AI summary from recent channel messages' })
  @ApiResponse({ status: 201, description: 'Summary generated' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async summarize(
    @Body() body: { channelId: string; messageCount?: number },
  ) {
    const parsed = summarizeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.format());
    }

    try {
      const result = await this.summarizeService.summarizeChannel(
        body.channelId,
        body.messageCount,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new InternalServerErrorException('Summarization failed');
    }
  }
}
