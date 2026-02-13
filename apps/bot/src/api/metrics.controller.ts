import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricsService } from '../shared/metrics.service.js';
import { Public } from '../shared/guards/public.decorator.js';

@ApiTags('Metrics')
@Controller('api/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get in-memory operational metrics snapshot' })
  @ApiResponse({ status: 200, description: 'Metrics snapshot' })
  getMetrics() {
    return {
      success: true,
      data: this.metricsService.getSnapshot(),
    };
  }
}
