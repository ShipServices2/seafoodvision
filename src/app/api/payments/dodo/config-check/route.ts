import { NextResponse } from 'next/server';
import { getDodoRuntimeConfig } from '@/lib/payments/dodo/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getDodoRuntimeConfig();
  return NextResponse.json({
    isCheckoutReady: config.isCheckoutReady,
    isWebhookReady: config.isWebhookReady,
    isEnabled: config.isEnabled,
    apiKeyFound: config.apiKeyFound,
    webhookSecretFound: config.webhookSecretFound,
    environment: config.environment,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
