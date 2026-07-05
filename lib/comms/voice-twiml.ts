import twilio from "twilio";
import { getPublicBaseUrl } from "./public-url";

export function xmlResponse(twiml: twilio.twiml.VoiceResponse): Response {
  return new Response(twiml.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export function sayAndGather(message: string, callSid: string): Response {
  const baseUrl = getPublicBaseUrl();
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: ["speech"],
    method: "POST",
    speechTimeout: "auto",
    timeout: 8,
    language: "en-GB",
    speechModel: "phone_call",
    enhanced: true,
    action: `${baseUrl}/api/calls/voice/respond?CallSid=${encodeURIComponent(callSid)}`,
  });
  gather.say({ voice: "Polly.Amy", language: "en-GB" }, message);
  twiml.redirect(
    `${baseUrl}/api/calls/voice/respond?CallSid=${encodeURIComponent(callSid)}&NoInput=1`,
  );
  return xmlResponse(twiml);
}

export function sayAndHangUp(message: string): Response {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: "Polly.Amy", language: "en-GB" }, message);
  twiml.hangup();
  return xmlResponse(twiml);
}
