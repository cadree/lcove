import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireInternalSecret } from '../_shared/require-caller.ts'

// Internal suppression writer. Resend bounce webhooks are not connected.
// Callers POST JSON with header x-internal-secret:
//   { email, reason: "bounce" | "complaint" | "unsubscribe", message_id?, metadata? }

interface SuppressionPayload {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  message_id?: string
  metadata?: Record<string, unknown>
}

const jsonHeaders = { 'Content-Type': 'application/json' }

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  })
}

function parseSuppressionPayload(body: string): SuppressionPayload {
  const parsed = JSON.parse(body) as Partial<SuppressionPayload>
  const email = typeof parsed.email === 'string' ? parsed.email.trim() : ''
  const reason = parsed.reason
  if (!email || (reason !== 'bounce' && reason !== 'complaint' && reason !== 'unsubscribe')) {
    throw new Error('Missing required fields: email, reason')
  }
  return {
    email,
    reason,
    message_id: typeof parsed.message_id === 'string' ? parsed.message_id : undefined,
    metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : undefined,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const denied = requireInternalSecret(req, jsonHeaders)
  if (denied) return denied

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let payload: SuppressionPayload
  try {
    payload = parseSuppressionPayload(await req.text())
  } catch (error) {
    console.error('Invalid suppression payload', {
      message: error instanceof Error ? error.message : 'invalid',
    })
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  const sendLogStatus = mapReasonToStatus(payload.reason)
  const sendLogMessage = mapReasonToMessage(payload.reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    console.warn('Failed to insert email_send_log', {
      error: insertError,
    })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason: payload.reason,
    has_message_id: !!payload.message_id,
  })

  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}
