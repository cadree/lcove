import { supabase } from '@/integrations/supabase/client';
import { logAuthError } from '@/lib/authDebug';
import { memberOfError, normalizeMemberOf } from '@/lib/etherId';
import { saveSignupAttribution } from '@/lib/saveSignupAttribution';
import { inviteTokenFromMetadata, WAITLIST_INVITE_METADATA_KEY } from '@/lib/waitlist';

export const PENDING_SIGNUP_KEY = 'ether_pending_signup';
export { inviteTokenFromMetadata, WAITLIST_INVITE_METADATA_KEY } from '@/lib/waitlist';

type PendingSignup = {
  displayName?: string;
  phone?: string;
  inviteToken?: string;
  memberOf?: string;
};

const claimInflight = new Map<string, Promise<boolean>>();

async function claimInvite(token: string, userId: string): Promise<boolean> {
  const existing = claimInflight.get(token);
  if (existing) return existing;
  const pending = (async () => {
    const { error } = await supabase.rpc('claim_waitlist_invite', { p_token: token });
    if (!error) return true;
    logAuthError('Waitlist invite claim failed', error);
    const { data } = await supabase.from('profiles').select('founding').eq('user_id', userId).maybeSingle();
    return Boolean(data?.founding);
  })();
  claimInflight.set(token, pending);
  const claimed = await pending;
  if (!claimed) claimInflight.delete(token);
  return claimed;
}

export function identityFromMetadata(
  metadata: { display_name?: unknown; member_of?: unknown } | null | undefined,
): { displayName?: string; memberOf?: string } {
  const displayName = typeof metadata?.display_name === "string" ? metadata.display_name.trim() : "";
  const memberOf = typeof metadata?.member_of === "string" ? metadata.member_of : "";
  return {
    ...(displayName ? { displayName } : {}),
    ...(memberOf ? { memberOf } : {}),
  };
}

export async function applyPendingSignupProfile(
  userId: string,
  metadataToken?: string | null,
  metadata?: { display_name?: unknown; member_of?: unknown } | null,
): Promise<'ok' | 'invite-failed' | 'empty'> {
  const raw = sessionStorage.getItem(PENDING_SIGNUP_KEY);
  let parsed: PendingSignup = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as PendingSignup;
    } catch (error) {
      sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      logAuthError('Pending signup profile failed', error);
    }
  }

  const fromMeta = identityFromMetadata(metadata);
  const displayName = parsed.displayName?.trim() || fromMeta.displayName;
  const phone = parsed.phone?.trim();
  const memberSource = parsed.memberOf ?? fromMeta.memberOf;
  const memberOf = memberOfError(memberSource) ? null : normalizeMemberOf(memberSource);
  const inviteToken = parsed.inviteToken?.trim() || (metadataToken ?? '').trim();
  if (!displayName && !phone && !memberOf && !inviteToken) return 'empty';

  try {
    if (displayName || phone || memberOf) {
      await supabase.from('profiles').update({
        ...(displayName ? { display_name: displayName } : {}),
        ...(phone ? { phone } : {}),
        ...(memberOf ? { member_of: memberOf } : {}),
      }).eq('user_id', userId);
    }
    await saveSignupAttribution(userId);
    if (inviteToken) {
      const claimed = await claimInvite(inviteToken, userId);
      if (!claimed) return 'invite-failed';
      await supabase.auth.updateUser({ data: { [WAITLIST_INVITE_METADATA_KEY]: '' } });
    }
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    return 'ok';
  } catch (error) {
    logAuthError('Pending signup profile failed', error);
    return inviteToken ? 'invite-failed' : 'ok';
  }
}
