import { Injectable, Logger } from '@nestjs/common';
import { interrupt } from '@langchain/langgraph';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';

@Injectable()
export class ApprovalNode {
  private readonly logger = new Logger(ApprovalNode.name);

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const raw = interrupt({
      message: 'Please review the generated draft',
      draft: state.draft,
    });

    const decision = raw as Record<string, unknown> | null;
    const approved =
      decision != null &&
      typeof decision === 'object' &&
      decision.approved === true;

    if (decision == null || typeof decision !== 'object' || typeof decision.approved !== 'boolean') {
      this.logger.warn(
        `Invalid interrupt response: ${JSON.stringify(decision)}. Treating as rejected.`,
      );
    }

    return {
      approved,
      approval: {
        status: approved ? 'approved' : 'rejected',
        id: typeof decision?.id === 'string' ? decision.id : undefined,
      },
    };
  }
}
