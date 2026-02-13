import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception.js';

export class DraftNotFoundException extends AppException {
  constructor(draftId: string) {
    super(
      `Draft ${draftId} not found`,
      HttpStatus.NOT_FOUND,
      'DRAFT_NOT_FOUND',
    );
  }
}
