import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DecisionService } from '../drafts/decision.service.js';

@ApiTags('Decisions')
@Controller('api/decisions')
export class DecisionsController {
  constructor(private readonly decisionService: DecisionService) {}

  @Get()
  @ApiOperation({ summary: 'List decisions' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'List of decisions' })
  async listDecisions(@Query('status') status?: string) {
    const data = await this.decisionService.findAll(
      status ? { status } : undefined,
    );

    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get decision by ID' })
  @ApiParam({ name: 'id', description: 'Decision ID' })
  @ApiResponse({ status: 200, description: 'Decision details' })
  async getDecision(@Param('id') id: string) {
    const data = await this.decisionService.findById(id);

    return {
      success: true,
      data,
    };
  }
}
