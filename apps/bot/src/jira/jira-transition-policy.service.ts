import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TransitionEntry {
  name: string;
  fromStatus: string;
  toStatus: string;
  transitionId: string;
}

interface TransitionPolicy {
  transitions: Record<string, TransitionEntry>;
}

@Injectable()
export class JiraTransitionPolicyService {
  private readonly logger = new Logger(JiraTransitionPolicyService.name);
  private readonly policy: TransitionPolicy;

  constructor() {
    const policyPath = join(__dirname, '../policies/jira.transitions.json');
    try {
      const raw = readFileSync(policyPath, 'utf-8');
      this.policy = JSON.parse(raw) as TransitionPolicy;
      this.logger.log(
        `Loaded ${Object.keys(this.policy.transitions).length} Jira transition mappings`,
      );
    } catch {
      this.logger.warn(
        'jira.transitions.json not found or invalid — using empty transition map',
      );
      this.policy = { transitions: {} };
    }
  }

  resolveTransitionId(transitionKey: string): string | null {
    const entry = this.policy.transitions[transitionKey];
    return entry?.transitionId ?? null;
  }

  findByTargetStatus(targetStatus: string): TransitionEntry | null {
    const entries = Object.values(this.policy.transitions);
    return (
      entries.find(
        (e) => e.toStatus.toLowerCase() === targetStatus.toLowerCase(),
      ) ?? null
    );
  }

  listTransitions(): Array<{ key: string } & TransitionEntry> {
    return Object.entries(this.policy.transitions).map(([key, entry]) => ({
      key,
      ...entry,
    }));
  }
}
