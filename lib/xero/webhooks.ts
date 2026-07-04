import crypto from 'node:crypto';

export function verifyXeroSignature(
  payload: string,
  signature: string,
  webhookKey: string,
): boolean {
  const computed = crypto
    .createHmac('sha256', webhookKey)
    .update(payload, 'utf8')
    .digest('base64');

  const computedBuffer = Buffer.from(computed);
  const signatureBuffer = Buffer.from(signature);

  if (computedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
}
