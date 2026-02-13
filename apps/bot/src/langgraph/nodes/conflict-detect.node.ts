import { Injectable } from '@nestjs/common';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';

@Injectable()
export class ConflictDetectNode {
  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const reviews = state.reviews;
    const conflicts: Array<{
      between: string;
      topic: string;
      resolutionProposal: string;
    }> = [];

    const bizRec = (reviews.biz as Record<string, unknown> | null)
      ?.decision as { recommendation?: string } | undefined;
    const qaRisks = (reviews.qa as Record<string, unknown> | null)
      ?.stateModelRisks as Array<Record<string, unknown>> | undefined;
    const designConstraints = (
      reviews.design as Record<string, unknown> | null
    )?.uiConstraints as string[] | undefined;

    if (bizRec?.recommendation === 'REJECT' && qaRisks && qaRisks.length === 0) {
      conflicts.push({
        between: 'biz,qa',
        topic: 'Business rejects but QA found no risks',
        resolutionProposal: 'Defer to business rationale',
      });
    }

    if (
      bizRec?.recommendation === 'APPROVE' &&
      designConstraints &&
      designConstraints.length > 3
    ) {
      conflicts.push({
        between: 'biz,design',
        topic: 'Business approves but design has many constraints',
        resolutionProposal: 'Proceed with design constraints as acceptance criteria',
      });
    }

    return { conflicts };
  }
}
