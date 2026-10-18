import { supabase } from '@/integrations/supabase/client';
import { logAuthError } from '@/lib/authDebug';

export const PENDING_SIGNUP_KEY = 'ether_pending_signup';

export async function applyPendingSignupProfile(userId: string) {
  const raw = sessionStorage.getItem(PENDING_SIGNUP_KEY);
  if (!raw) return;
  sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  try {
    const parsed = JSON.parse(raw) as { displayName?: string; phone?: string };
    const displayName = parsed.displayName?.trim();
    const phone = parsed.phone?.trim();
    if (!displayName && !phone) return;
    await supabase.from('profiles').update({
      ...(displayName ? { display_name: displayName } : {}),
      ...(phone ? { phone } : {}),
    }).eq('user_id', userId);
  } catch (error) {
    console.error('Failed to save signup profile');
    logAuthError('Pending signup profile failed', error);
  }
}
