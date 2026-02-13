import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { slackEvents } from '../shared/database/schema.js';

@ApiTags('Events')
@Controller('api/events')
export class EventsController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Get()
  @ApiOperation({ summary: 'List Slack events' })
  @ApiQuery({ name: 'channelId', required: false, description: 'Filter by channel ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 50, max 200)' })
  @ApiResponse({ status: 200, description: 'List of events' })
  async listEvents(
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);

    const whereClause = channelId
      ? eq(slackEvents.channelId, channelId)
      : undefined;

    const data = await this.db
      .select({
        id: slackEvents.id,
        channelId: slackEvents.channelId,
        messageTs: slackEvents.messageTs,
        threadTs: slackEvents.threadTs,
        userId: slackEvents.userId,
        eventType: slackEvents.eventType,
        text: slackEvents.text,
        permalink: slackEvents.permalink,
        createdAt: slackEvents.createdAt,
      })
      .from(slackEvents)
      .where(whereClause)
      .orderBy(desc(slackEvents.createdAt))
      .limit(take);

    return {
      success: true,
      data,
      meta: { total: data.length },
    };
  }
}
