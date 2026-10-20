import { supabase } from '@/integrations/supabase/client';
import { logAuthError } from '@/lib/authDebug';
import { saveSignupAttribution } from '@/lib/saveSignupAttribution';

export const PENDING_SIGNUP_KEY = 'ether_pending_signup';

type PendingSignup = {
  displayName?: string;
  phone?: string;
  inviteToken?: string;
};

export async function applyPendingSignupProfile(userId: string): Promise<'ok' | 'invite-failed' | 'empty'> {
  const raw = sessionStorage.getItem(PENDING_SIGNUP_KEY);
  if (!raw) return 'empty';
  let parsed: PendingSignup;
  try {
    parsed = JSON.parse(raw) as PendingSignup;
  } catch (error) {
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    logAuthError('Pending signup profile failed', error);
    return 'empty';
  }

  const displayName = parsed.displayName?.trim();
  const phone = parsed.phone?.trim();
  const inviteToken = parsed.inviteToken?.trim();

  try {
    if (displayName || phone) {
      await supabase.from('profiles').update({
        ...(displayName ? { display_name: displayName } : {}),
        ...(phone ? { phone } : {}),
      }).eq('user_id', userId);
    }
    await saveSignupAttribution(userId);
    if (inviteToken) {
      const { error } = await supabase.rpc('claim_waitlist_invite', { p_token: inviteToken });
      if (error) {
        logAuthError('Waitlist invite claim failed', error);
        return 'invite-failed';
      }
    }
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    return 'ok';
  } catch (error) {
    logAuthError('Pending signup profile failed', error);
    return inviteToken ? 'invite-failed' : 'ok';
  }
}
