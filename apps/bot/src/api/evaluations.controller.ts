import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Inject,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { summaries, drafts } from '../shared/database/schema.js';
import { EvalService } from '../shared/eval.service.js';

@ApiTags('Evaluations')
@Controller('api/evaluations')
export class EvaluationsController {
  private readonly logger = new Logger(EvaluationsController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly evalService: EvalService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List evaluations' })
  @ApiQuery({ name: 'targetType', required: false, description: 'Filter by target type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 50)' })
  @ApiResponse({ status: 200, description: 'List of evaluations' })
  async listEvaluations(
    @Query('targetType') targetType?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const data = await this.evalService.getEvaluations(
        targetType,
        Number.isNaN(parsedLimit) ? 50 : parsedLimit,
      );

      return {
        success: true,
        data,
        meta: { total: data.length },
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to list evaluations: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException('Failed to list evaluations');
    }
  }

  @Post('evaluate/summary/:id')
  @ApiOperation({ summary: 'Evaluate a summary by ID' })
  @ApiParam({ name: 'id', description: 'Summary ID' })
  @ApiResponse({ status: 201, description: 'Evaluation result' })
  @ApiResponse({ status: 404, description: 'Summary not found' })
  async evaluateSummary(@Param('id') id: string) {
    const [record] = await this.db
      .select()
      .from(summaries)
      .where(eq(summaries.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundException(`Summary ${id} not found`);
    }

    const result = await this.evalService.evaluateSummary(
      id,
      record.summary,
      record.summary,
    );

    return { success: true, data: result };
  }

  @Post('evaluate/draft/:id')
  @ApiOperation({ summary: 'Evaluate a draft by ID' })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiResponse({ status: 201, description: 'Evaluation result' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async evaluateDraft(@Param('id') id: string) {
    const [record] = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundException(`Draft ${id} not found`);
    }

    const result = await this.evalService.evaluateDraft(id, record.content);

    return { success: true, data: result };
  }
}
