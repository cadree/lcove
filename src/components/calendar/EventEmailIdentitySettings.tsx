import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2, Upload } from "lucide-react";
import { useEventEmailBranding } from "@/hooks/useEventEmailBranding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  eventId: string;
  hostDisplayName?: string | null;
}

export function EventEmailIdentitySettings({ eventId, hostDisplayName }: Props) {
  const { branding, loading, save, refresh } = useEventEmailBranding(eventId);

  const [fromName, setFromName] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [signature, setSignature] = useState("");
  const [brandColor, setBrandColor] = useState("#e91e8c");
  const [headerImageUrl, setHeaderImageUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (branding) {
      setFromName(branding.from_name_override || "");
      setOrganizerName(branding.organizer_name || "");
      setReplyTo(branding.reply_to_email || "");
      setPersonalNote(branding.personal_note || "");
      setSignature(branding.signature || "");
      setBrandColor(branding.brand_color || "#e91e8c");
      setHeaderImageUrl(branding.header_image_url || "");
    }
  }, [branding]);

  const isVerified = Boolean(branding?.reply_to_verified_at && branding?.reply_to_email === replyTo);
  const effectiveFromName = fromName || `${hostDisplayName || "Host"} via Ether`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        from_name_override: fromName.trim() || null,
        organizer_name: organizerName.trim() || null,
        personal_note: personalNote.trim() || null,
        signature: signature.trim() || null,
        brand_color: brandColor,
        header_image_url: headerImageUrl.trim() || null,
        reply_to_email: replyTo.trim() || null,
      });
      toast.success("Email identity saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSendCode = async () => {
    if (!replyTo.trim()) {
      toast.error("Enter a reply-to email first");
      return;
    }
    setSendingCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("verify-host-email", {
        body: { action: "request", email: replyTo.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast.success("Verification code sent");
      setVerifyMode(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to send code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirm = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setConfirming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("verify-host-email", {
        body: { action: "confirm", eventId, email: replyTo.trim(), code },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast.success("Reply-to verified");
      setVerifyMode(false);
      setCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Invalid code");
    } finally {
      setConfirming(false);
    }
  };

  const handleHeaderUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/event-branding/${eventId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      setHeaderImageUrl(data.publicUrl);
      toast.success("Header image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Event Email Identity
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize how invitations and reminders appear in your guests' inbox.
        </p>
      </div>

      <Card className="p-4 bg-muted/30 space-y-1">
        <div className="text-xs text-muted-foreground">Recipients will see:</div>
        <div className="text-sm font-medium">
          From: <span className="text-primary">{effectiveFromName}</span> &lt;events@notify.etherbylcove.com&gt;
        </div>
        <div className="text-sm">
          Reply-To: {replyTo || "support@notify.etherbylcove.com"}
          {isVerified && <Badge variant="secondary" className="ml-2 gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>}
        </div>
      </Card>

      <div className="space-y-3">
        <div>
          <Label>From Name</Label>
          <Input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder={`${hostDisplayName || "Host"} via Ether`}
            maxLength={80}
          />
        </div>

        <div>
          <Label>Organizer Name</Label>
          <Input
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
            placeholder={hostDisplayName || "Your name or brand"}
          />
        </div>

        <div>
          <Label>Reply-To Email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={replyTo}
              onChange={(e) => { setReplyTo(e.target.value); setVerifyMode(false); }}
              placeholder="you@example.com"
            />
            {!isVerified && (
              <Button onClick={handleSendCode} disabled={sendingCode || !replyTo.trim()} variant="outline">
                {sendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            )}
          </div>
          {verifyMode && !isVerified && (
            <div className="flex gap-2 mt-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                maxLength={6}
              />
              <Button onClick={handleConfirm} disabled={confirming || code.length !== 6}>
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label>Personal Note (intro line for invites)</Label>
          <Textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="I’d love to personally invite you to this experience..."
            rows={2}
          />
        </div>

        <div>
          <Label>Signature</Label>
          <Input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Founder, ETHER"
          />
        </div>

        <div>
          <Label>Header Image</Label>
          <div className="flex gap-2 items-center">
            <Input
              value={headerImageUrl}
              onChange={(e) => setHeaderImageUrl(e.target.value)}
              placeholder="Image URL or upload"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleHeaderUpload(e.target.files[0])}
              />
              <Button type="button" variant="outline" disabled={uploading} asChild>
                <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
              </Button>
            </label>
          </div>
          {headerImageUrl && (
            <img src={headerImageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-md" />
          )}
        </div>

        <div>
          <Label>Brand Color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border border-border"
            />
            <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="flex-1" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Email Identity
      </Button>
    </div>
  );
}
