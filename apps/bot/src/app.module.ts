import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SlackModule } from 'nestjs-slack-bolt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { validateEnv } from './shared/config/env.validation.js';
import { SharedModule } from './shared/shared.module.js';
import { SlackFeatureModule } from './slack/slack-feature.module.js';
import { DraftsModule } from './drafts/drafts.module.js';
import { ApiModule } from './api/api.module.js';
import { OTelInterceptor } from './shared/otel.interceptor.js';
import { QueueModule } from './shared/queue/queue.module.js';
import { AuthGuard } from './shared/guards/auth.guard.js';
import { RolesGuard } from './shared/guards/roles.guard.js';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter.js';
import { AppScheduleModule } from './shared/schedule/schedule.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ validate: validateEnv, isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '../web/build/client'),
      exclude: ['/api/(.*)', '/api-json'],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    SlackModule.forRoot(),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 60 }] }),
    QueueModule,
    SharedModule,
    SlackFeatureModule,
    DraftsModule,
    ApiModule,
    AppScheduleModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: OTelInterceptor },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
