import { NextResponse } from 'next/server';

import { verifyXeroSignature } from '../../../../lib/xero/webhooks';

type XeroWebhookPayload = {
  events?: Array<{ eventType?: string; eventCategory?: string }>;
};

async function logWebhookEvent(payload: XeroWebhookPayload): Promise<void> {
  for (const event of payload.events ?? []) {
    console.log('[xero webhook]', event.eventType ?? event.eventCategory ?? 'unknown');
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookKey = process.env.XERO_WEBHOOK_KEY?.trim();

  if (webhookKey) {
    const signature = request.headers.get('x-xero-signature');

    if (!signature || !verifyXeroSignature(rawBody, signature, webhookKey)) {
      return new NextResponse('Invalid signature', { status: 401 });
    }
  }

  let payload: XeroWebhookPayload = {};
  try {
    payload = JSON.parse(rawBody) as XeroWebhookPayload;
  } catch {
    console.warn('[xero webhook] received non-JSON payload');
  }

  void logWebhookEvent(payload);

  return new NextResponse(null, { status: 200 });
}
