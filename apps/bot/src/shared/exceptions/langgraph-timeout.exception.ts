import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception.js';

export class LangGraphTimeoutException extends AppException {
  constructor(runId?: string) {
    super(
      runId
        ? `LangGraph run ${runId} timed out`
        : 'LangGraph run timed out',
      HttpStatus.GATEWAY_TIMEOUT,
      'LANGGRAPH_TIMEOUT',
    );
  }
}
