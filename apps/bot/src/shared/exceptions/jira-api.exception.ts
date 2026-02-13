import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception.js';

export class JiraApiException extends AppException {
  constructor(message: string, public readonly jiraStatus?: number) {
    super(
      message,
      HttpStatus.BAD_GATEWAY,
      'JIRA_API_ERROR',
    );
  }
}
