import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { CostTrackingService } from './cost-tracking.service.js';
import { ContextService } from './context.service.js';
import { AuditLogService } from './audit-log.service.js';
import { PiiMaskingService } from './pii-masking.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { EvalService } from './eval.service.js';
import { ChannelPolicyService } from './channel-policy.service.js';
import { RetentionService } from './retention.service.js';
import { TemporalDecayService } from './temporal-decay.service.js';
import { OpenAiHttpService } from './openai-http.service.js';
import { MetricsService } from './metrics.service.js';

@Global()
@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [CostTrackingService, ContextService, AuditLogService, PiiMaskingService, AuthGuard, RolesGuard, EvalService, ChannelPolicyService, RetentionService, TemporalDecayService, OpenAiHttpService, MetricsService],
  exports: [DatabaseModule, CostTrackingService, ContextService, AuditLogService, PiiMaskingService, AuthGuard, RolesGuard, EvalService, ChannelPolicyService, RetentionService, TemporalDecayService, OpenAiHttpService, MetricsService],
})
export class SharedModule {}
