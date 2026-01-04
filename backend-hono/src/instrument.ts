import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://0802a9bb94dcbee78c1d063f16e94f46@o4510609880252416.ingest.us.sentry.io/4510609880580096',
  integrations: [
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  tracesSampleRate: 1.0,
  // Send default PII like IP address for better context.
  sendDefaultPii: true,
});
