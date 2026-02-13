import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';

export const DRIZZLE = Symbol('DRIZZLE');
export type DrizzleDB = MySql2Database<typeof schema>;

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const pool = mysql.createPool({
      uri: configService.getOrThrow<string>('DATABASE_URL'),
    });
    return drizzle(pool, { schema, mode: 'default' });
  },
};
