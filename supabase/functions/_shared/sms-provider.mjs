// Confirmation SMS. Disabled unless Cadre sets SMS_PROVIDER=twilio and the
// account secrets already exist. This module does not create a provider account.

export function resolveSmsProvider(env = {}) {
  const name = String(env.SMS_PROVIDER || "").trim().toLowerCase();
  if (name !== "twilio") return { enabled: false, name: "disabled" };
  const ready = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
  return { enabled: ready, name: ready ? "twilio" : "disabled" };
}

export function smsProviderFromDeno() {
  const env = typeof Deno === "undefined" ? {} : {
    SMS_PROVIDER: Deno.env.get("SMS_PROVIDER"),
    TWILIO_ACCOUNT_SID: Deno.env.get("TWILIO_ACCOUNT_SID"),
    TWILIO_AUTH_TOKEN: Deno.env.get("TWILIO_AUTH_TOKEN"),
    TWILIO_PHONE_NUMBER: Deno.env.get("TWILIO_PHONE_NUMBER"),
  };
  return resolveSmsProvider(env);
}

export async function sendSms(env, { to, body }) {
  const provider = resolveSmsProvider(env);
  if (!provider.enabled) return { skipped: true, reason: "sms_disabled" };
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_PHONE_NUMBER;
  const auth = btoa(`${sid}:${token}`);
  const payload = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });
  if (!response.ok) {
    return { skipped: false, ok: false, status: response.status };
  }
  return { skipped: false, ok: true };
}
