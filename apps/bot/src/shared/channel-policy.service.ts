import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from './database/drizzle.provider.js';
import { systemSettings } from './database/schema.js';

export interface ChannelPolicy {
  channelId: string;
  enableSummary: boolean;
  enableReview: boolean;
  enableDecisionDetection: boolean;
}

const DEFAULT_POLICY: Omit<ChannelPolicy, 'channelId'> = {
  enableSummary: true,
  enableReview: true,
  enableDecisionDetection: true,
};

const SETTINGS_KEY = 'channel_policies';

@Injectable()
export class ChannelPolicyService {
  private readonly logger = new Logger(ChannelPolicyService.name);
  private policiesCache: Map<string, ChannelPolicy> | null = null;
  private cacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getPolicy(channelId: string): Promise<ChannelPolicy> {
    const policies = await this.loadPolicies();
    return policies.get(channelId) ?? { channelId, ...DEFAULT_POLICY };
  }

  async isEnabled(channelId: string, feature: keyof Omit<ChannelPolicy, 'channelId'>): Promise<boolean> {
    const policy = await this.getPolicy(channelId);
    return policy[feature];
  }

  async setPolicies(policies: ChannelPolicy[]): Promise<void> {
    const value = Object.fromEntries(policies.map((p) => [p.channelId, p]));
    const existing = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.key, SETTINGS_KEY));
    } else {
      await this.db.insert(systemSettings).values({
        key: SETTINGS_KEY,
        value,
      });
    }

    this.policiesCache = null;
    this.logger.log(`Updated channel policies for ${policies.length} channel(s)`);
  }

  private async loadPolicies(): Promise<Map<string, ChannelPolicy>> {
    if (this.policiesCache && Date.now() < this.cacheExpiry) {
      return this.policiesCache;
    }

    const rows = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .limit(1);

    const map = new Map<string, ChannelPolicy>();

    if (rows.length > 0) {
      const raw = rows[0].value as Record<string, ChannelPolicy>;
      for (const [channelId, policy] of Object.entries(raw)) {
        map.set(channelId, { ...DEFAULT_POLICY, ...policy, channelId });
      }
    }

    this.policiesCache = map;
    this.cacheExpiry = Date.now() + ChannelPolicyService.CACHE_TTL_MS;
    return map;
  }
}
