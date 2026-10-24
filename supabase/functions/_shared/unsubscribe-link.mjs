export async function unsubscribeLink(admin, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized.includes("@")) return { suppressed: false, url: null };
  const { data: existing, error } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (error) return { suppressed: false, url: null };
  if (existing?.used_at) return { suppressed: true, url: null };
  let token = existing?.token;
  if (!token) {
    token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
    const { error: insertError } = await admin
      .from("email_unsubscribe_tokens")
      .upsert({ token, email: normalized }, { onConflict: "email" });
    if (insertError) return { suppressed: false, url: null };
  }
  return {
    suppressed: false,
    url: `https://etherbylcove.com/unsubscribe?token=${encodeURIComponent(token)}`,
  };
}
