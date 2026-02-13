import { Injectable, Logger } from '@nestjs/common';
import type { ScrumStateType, ScrumStateUpdate } from '../state.js';
import { CostTrackingService } from '../../shared/cost-tracking.service.js';

const MIN_CONTEXT_CHUNKS = 1;

@Injectable()
export class ContextGateNode {
  private readonly logger = new Logger(ContextGateNode.name);

  constructor(private readonly costTracker: CostTrackingService) {}

  async execute(
    state: ScrumStateType,
  ): Promise<Partial<ScrumStateUpdate>> {
    const contextCount = state.retrievedContext.length;

    if (contextCount < MIN_CONTEXT_CHUNKS && state.input.type !== 'manual') {
      this.logger.warn(
        `Insufficient context: ${contextCount} chunks retrieved (min: ${MIN_CONTEXT_CHUNKS})`,
      );
      return {
        control: {
          iteration: state.control.iteration,
          maxIteration: state.control.maxIteration,
          abortReason: 'context_insufficient',
        },
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { estimatedCostUsd } = await this.costTracker.getTotalCost(todayStart);
    const { degrade, reason } = this.costTracker.shouldDegrade(estimatedCostUsd);

    if (degrade) {
      this.logger.warn(`Budget exceeded — entering degrade mode: ${reason}`);
      return {
        control: {
          iteration: state.control.iteration,
          maxIteration: state.control.maxIteration,
          abortReason: 'budget_exceeded',
        },
      };
    }

    return {};
  }
}
