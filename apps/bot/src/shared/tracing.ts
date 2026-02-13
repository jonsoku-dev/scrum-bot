import { trace, SpanStatusCode, type Tracer } from '@opentelemetry/api';

const TRACER_NAME = 'scrum-bot';

export interface Span {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error';
  error?: string;
  _otelSpan?: ReturnType<Tracer['startSpan']>;
}

function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

export function createSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): Span {
  const tracer = getTracer();
  const otelSpan = tracer.startSpan(name);
  if (attributes) {
    for (const [k, v] of Object.entries(attributes)) {
      otelSpan.setAttribute(k, v);
    }
  }
  const spanCtx = otelSpan.spanContext();
  return {
    traceId: spanCtx.traceId,
    spanId: spanCtx.spanId,
    name,
    startTime: Date.now(),
    attributes: attributes ?? {},
    status: 'ok',
    _otelSpan: otelSpan,
  };
}

export function endSpan(span: Span, error?: Error): Span {
  span.endTime = Date.now();
  span.durationMs = span.endTime - span.startTime;
  if (error) {
    span.status = 'error';
    span.error = error.message;
    span._otelSpan?.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span._otelSpan?.recordException(error);
  } else {
    span._otelSpan?.setStatus({ code: SpanStatusCode.OK });
  }
  span._otelSpan?.end();
  return span;
}
