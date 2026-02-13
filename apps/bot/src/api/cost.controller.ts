import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CostTrackingService } from '../shared/cost-tracking.service.js';

@ApiTags('Cost')
@Controller('api/cost')
export class CostController {
  constructor(private readonly costTrackingService: CostTrackingService) {}

  @Get()
  @ApiOperation({ summary: 'Get cost tracking data' })
  @ApiQuery({ name: 'since', required: false, description: 'Filter costs since ISO date' })
  @ApiResponse({ status: 200, description: 'Cost data with degradation status' })
  async getCosts(@Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : undefined;
    const data = await this.costTrackingService.getTotalCost(sinceDate);
    const degradation = this.costTrackingService.shouldDegrade(
      data.estimatedCostUsd,
    );
    return { success: true, data: { ...data, degradation } };
  }
}
