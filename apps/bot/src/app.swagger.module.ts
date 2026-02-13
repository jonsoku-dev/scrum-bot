import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './shared/config/env.validation.js';
import { SharedModule } from './shared/shared.module.js';
import { ApiModule } from './api/api.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ validate: validateEnv, isGlobal: true }),
    SharedModule,
    ApiModule,
  ],
})
export class AppSwaggerModule {}
