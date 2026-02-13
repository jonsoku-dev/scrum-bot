import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AppException } from '../exceptions/app.exception.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProd: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;
    let errorCode: string | undefined;
    let details: unknown = null;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const body = exception.getResponse() as { message: string; errorCode?: string };
      message = body.message;
      errorCode = body.errorCode;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      const exceptionResponse = exception.getResponse();
      details = typeof exceptionResponse === 'object' ? exceptionResponse : null;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`HTTP ${status}: ${message}`, stack);

    response.status(status).json({
      success: false,
      error: {
        code: status,
        message: this.isProd && status >= 500 ? 'Internal server error' : message,
        ...(errorCode ? { errorCode } : {}),
        ...(this.isProd ? {} : { details }),
      },
    });
  }
}
