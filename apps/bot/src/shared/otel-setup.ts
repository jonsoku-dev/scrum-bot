import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const exporterUrl =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318/v1/traces';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'scrum-bot',
      [ATTR_SERVICE_VERSION]: '0.1.0',
    }),
    traceExporter: new OTLPTraceExporter({ url: exporterUrl }),
  });
  sdk.start();
}

export function shutdownTracing(): Promise<void> {
  return sdk?.shutdown() ?? Promise.resolve();
}
