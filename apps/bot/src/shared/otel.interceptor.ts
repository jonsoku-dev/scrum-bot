import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { createSpan, endSpan } from './tracing.js';

@Injectable()
export class OTelInterceptor implements NestInterceptor {
  private readonly logger = new Logger('OTel');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    const span = createSpan('http.request', {
      'http.method': method,
      'http.url': url,
    });

    request.traceId = span.traceId;

    return next.handle().pipe(
      tap({
        next: () => {
          const status = context.switchToHttp().getResponse().statusCode;
          span.attributes['http.status_code'] = status;
          endSpan(span);
          this.logger.log(
            JSON.stringify({
              traceId: span.traceId,
              method,
              url,
              status,
              durationMs: span.durationMs,
            }),
          );
        },
        error: (err) => {
          span.attributes['http.status_code'] = err.status || 500;
          endSpan(span, err);
          this.logger.error(
            JSON.stringify({
              traceId: span.traceId,
              method,
              url,
              status: err.status || 500,
              durationMs: span.durationMs,
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}
