export function getPublicBaseUrl(): string {
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "PUBLIC_BASE_URL is required for Twilio webhooks (e.g. your ngrok or Cloudflare tunnel URL).",
    );
  }
  return base;
}
