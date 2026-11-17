/**
 * Supabase Auth email quota failures are distinct from SMTP authentication
 * failures and from an invalid/expired verification code.
 */
export function emailSendingHelp(error: { message?: string; code?: string; status?: number }): {
  title: string;
  description: string;
} | null {
  const message = (error.message || "").toLowerCase();
  if (error.code === "over_email_send_rate_limit" || message.includes("email rate limit exceeded")) {
    return {
      title: "Verification emails temporarily limited",
      description:
        "ETHER cannot send another verification email right now. Check your inbox for the most recent code; it may still work. If your email is already verified, sign in to resume. Otherwise, request another code later.",
    };
  }
  return null;
}

/** Only email-delivery failures can leave an unverified signup that needs
 * confirmation recovery. Do not treat arbitrary signup failures this way. */
export function signupEmailDeliveryFailed(error: { message?: string; code?: string; status?: number }): boolean {
  const message = (error.message || "").toLowerCase();
  return Boolean(emailSendingHelp(error)) ||
    message.includes("smtp") ||
    message.includes("authentication credentials invalid") ||
    message.includes("error sending confirmation email") ||
    message.includes("failed to send confirmation email");
}
