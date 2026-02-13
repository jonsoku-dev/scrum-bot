import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.provider.js';
import { apiKeys } from '../database/schema.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * AuthGuard — API key-based authentication.
 *
 * Reads the `X-API-Key` header, hashes it with SHA-256, and looks it up in the
 * `api_keys` table. On success it attaches `{ id, name, role }` to `request.user`.
 *
 * Endpoints decorated with `@Public()` skip authentication entirely.
 *
 * ─── Creating the first API key ───
 * Generate a random key, hash it, and insert directly:
 *
 *   const key = crypto.randomBytes(32).toString('hex');
 *   const hash = crypto.createHash('sha256').update(key).digest('hex');
 *   INSERT INTO api_keys (name, key_hash, role) VALUES ('bootstrap-admin', '<hash>', 'ADMIN');
 *
 * Then use `key` as the X-API-Key header value. Store it securely — it cannot be recovered.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip auth for @Public() endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing or invalid X-API-Key header');
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const rows = await this.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        role: apiKeys.role,
        isActive: apiKeys.isActive,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid API key');
    }

    const apiKey = rows[0];

    // Attach user info to request for downstream guards / handlers
    Object.assign(request, {
      user: { id: apiKey.id, name: apiKey.name, role: apiKey.role },
    });

    // Fire-and-forget lastUsedAt update (non-blocking)
    this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .then(() => {})
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to update lastUsedAt for key ${apiKey.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return true;
  }
}
