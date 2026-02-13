import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { Public } from '../shared/guards/public.decorator.js';

@ApiTags('Health')
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check', description: 'Returns application and database health status' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getHealth() {
    let dbStatus = 'disconnected';
    try {
      await this.db.execute(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      db: dbStatus,
      uptime: process.uptime(),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
