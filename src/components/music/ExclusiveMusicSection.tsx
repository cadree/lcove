import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Music, Plus, Upload, Loader2, Lock, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccessRuleEditor } from "./AccessRuleEditor";
import { useLockedMusic } from "@/hooks/useLockedMusic";
import {
  useCreateMusicPayoutAccount,
  useRefreshMusicPayoutStatus,
} from "@/hooks/useMusicPayouts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errorMessage";
import { AUDIO_FILE_ACCEPT, AUDIO_UPLOAD_ACTION, AUDIO_UPLOAD_REJECTED, audioContentType, audioExtension, isAudioUpload } from "@/lib/audioFiles";
import { makePreviewClip, PREVIEW_SECONDS } from "@/lib/audioPreview";
import {
  LOCKED_AUDIO_DETAIL,
  LOCKED_MUSIC_BUCKET,
  LOCKED_UPLOAD_MESSAGES,
  formatBytes,
  lockedUploadProblems,
  parsePriceCents,
  type LockedUploadProblem,
} from "@/lib/lockedMusic";

interface ExclusiveMusicSectionProps {
  userId: string;
  /** Hide the owner's "sell tracks" prompt (used before they've connected any music). */
  hideOwnerEmpty?: boolean;
}

/**
 * Locked-music tools around the catalog: the owner uploads, sets rules and
 * connects payouts here; visitors only see a note when buying is unavailable.
 * The track cards themselves live in the catalog sections (MusicCatalog).
 */
export const ExclusiveMusicSection = ({ userId, hideOwnerEmpty = false }: ExclusiveMusicSectionProps) => {
  const { user } = useAuth();
  const {
    tracks,
    isLoading,
    createTrack,
    isOwner,
    rules,
    createRule,
    updateRule,
    deleteRule,
    payoutStatus,
  } = useLockedMusic(userId);
  const createPayoutAccount = useCreateMusicPayoutAccount();
  const refreshPayoutStatus = useRefreshMusicPayoutStatus();
  const refreshPayoutsRef = useRef(refreshPayoutStatus.mutate);
  refreshPayoutsRef.current = refreshPayoutStatus.mutate;

  const [showUpload, setShowUpload] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [freeListening, setFreeListening] = useState(true);
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [previewStart, setPreviewStart] = useState("0");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadProblems, setUploadProblems] = useState<LockedUploadProblem[]>([]);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // On mount, refresh live payout status if owner has account but flag isn't set
  useEffect(() => {
    if (isOwner && payoutStatus?.has_account && !payoutStatus.payout_enabled) {
      refreshPayoutsRef.current();
    }
  }, [isOwner, payoutStatus?.has_account, payoutStatus?.payout_enabled]);

  useEffect(() => {
    if (!isOwner || !payoutStatus?.has_account) return;
    const refresh = () => { if (document.visibilityState === "visible") refreshPayoutsRef.current(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isOwner, payoutStatus?.has_account]);

  const hasMonetizedContent =
    tracks.some((t) => (t.price_cents || 0) > 0) ||
    rules.some((r) => r.amount_cents > 0 && r.is_active);

  const showPayoutWarning = isOwner && hasMonetizedContent && !payoutStatus?.payout_enabled;

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setUploadProblems((prev) => prev.filter((p) => p !== "cover_type" && p !== "cover_size"));
  };

  const hasSubscriptionRule = rules.some((r) => r.rule_type === "subscription" && r.is_active);

  const resetUploadForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewPrice("");
    setFreeListening(true);
    setAllowDownloads(false);
    setPreviewStart("0");
    setAudioFile(null);
    setCoverFile(null);
    setCoverPreview("");
    setUploadProblems([]);
    setUploadStep("");
  };

  const handleUploadTrack = async () => {
    if (!user) return;
    const problems = lockedUploadProblems({
      title: newTitle,
      audio: audioFile,
      cover: coverFile,
      price: newPrice,
      isAudio: isAudioUpload,
      hasSubscriptionRule,
      freeListening,
    });
    setUploadProblems(problems);
    if (problems.length > 0 || !audioFile) return;

    setIsUploading(true);
    const uploaded: Array<{ bucket: string; path: string }> = [];
    try {
      const stamp = Date.now();
      const startSeconds = Math.max(0, parseInt(previewStart || "0", 10) || 0);

      // Preview first: if the browser can decode the file, fans get a real
      // 15-second clip. The full file is never used as the preview.
      setUploadStep(freeListening ? "Preparing your track…" : "Making the preview…");
      const preview = freeListening ? null : await makePreviewClip(audioFile, startSeconds, PREVIEW_SECONDS);

      setUploadStep(`Uploading ${formatBytes(audioFile.size)}…`);
      const audioExt = audioExtension(audioFile.name) || "mp3";
      const audioPath = `${user.id}/exclusive-${stamp}.${audioExt}`;
      const { error: audioErr } = await supabase.storage
        .from(LOCKED_MUSIC_BUCKET)
        .upload(audioPath, audioFile, { upsert: false, contentType: audioContentType(audioFile) });
      if (audioErr) throw audioErr;
      uploaded.push({ bucket: LOCKED_MUSIC_BUCKET, path: audioPath });

      let previewUrl: string | undefined;
      if (preview) {
        const previewPath = `${user.id}/exclusive-preview-${stamp}.wav`;
        const { error: previewErr } = await supabase.storage
          .from("media")
          .upload(previewPath, preview.blob, { upsert: false, contentType: "audio/wav" });
        if (previewErr) throw previewErr;
        uploaded.push({ bucket: "media", path: previewPath });
        previewUrl = supabase.storage.from("media").getPublicUrl(previewPath).data.publicUrl;
      }

      let coverUrl: string | undefined;
      if (coverFile) {
        setUploadStep("Uploading cover art…");
        const coverExt = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const coverPath = `${user.id}/exclusive-cover-${stamp}.${coverExt}`;
        const { error: coverErr } = await supabase.storage
          .from("media")
          .upload(coverPath, coverFile, { upsert: false, contentType: coverFile.type || undefined });
        if (coverErr) throw coverErr;
        uploaded.push({ bucket: "media", path: coverPath });
        coverUrl = supabase.storage.from("media").getPublicUrl(coverPath).data.publicUrl;
      }

      setUploadStep("Saving…");
      await createTrack.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        audio_file_path: audioPath,
        preview_clip_url: previewUrl,
        duration_seconds: preview?.durationSeconds,
        cover_image_url: coverUrl,
        price_cents: freeListening ? 0 : parsePriceCents(newPrice) ?? 0,
        access_type: freeListening ? "free" : hasSubscriptionRule && !newPrice.trim() ? "subscription" : "purchase",
        is_published: true,
        allow_downloads: !freeListening && allowDownloads,
        preview_start_seconds: startSeconds,
        preview_duration_seconds: PREVIEW_SECONDS,
      });
      if (!preview && !freeListening) {
        toast.info("Track is up. We couldn't make a preview from this file, so fans see it locked without a sample.");
      }

      resetUploadForm();
      setShowUpload(false);
    } catch (error) {
      console.error("Upload error:", error);
      // Don't leave orphaned files behind when the save fails part-way.
      for (const file of uploaded) {
        await supabase.storage.from(file.bucket).remove([file.path]).catch(() => undefined);
      }
      toast.error(errorMessage(error, "Failed to upload track"));
    } finally {
      setIsUploading(false);
      setUploadStep("");
    }
  };

  if (isLoading) return null;

  if (!isOwner) {
    if (!hasMonetizedContent || !payoutStatus || payoutStatus.payout_enabled) return null;
    return (
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          This artist hasn't connected payouts yet, so purchases and subscriptions are temporarily unavailable. Free tracks remain available to listen to, and paid tracks have previews.
        </p>
      </div>
    );
  }
  if (hideOwnerEmpty && tracks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-xl overflow-hidden"
      data-testid="locked-music-tools"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Lock className="w-4 h-4 text-amber-500" />
            <h3 className="font-display text-base font-medium text-foreground">
              Uploaded music
            </h3>
            {tracks.length > 0 && (
              <span className="text-xs text-muted-foreground">({tracks.length})</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs min-h-11"
              onClick={() => setShowRules(!showRules)}
            >
              Rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs min-h-11"
              onClick={() => setShowUpload(true)}
              data-testid="exclusive-upload-open"
            >
              <Plus className="w-3 h-3 mr-1" /> Upload
            </Button>
          </div>
        </div>
        {tracks.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Free tracks play in full. Paid tracks stay sealed until unlocked. Use Arrange to put them in a section.
          </p>
        )}

        {/* Payout warning banner — owner only */}
        {showPayoutWarning && (
          <div className="mt-4 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Connect payouts to start selling
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buyers can't purchase your tracks until you connect a payout account.
                100% of every sale goes directly to you.
              </p>
              <Button
                size="sm"
                className="mt-3 min-h-11 text-xs"
                disabled={createPayoutAccount.isPending}
                onClick={() => createPayoutAccount.mutate()}
              >
                {createPayoutAccount.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                )}
                {payoutStatus?.has_account ? "Finish payout setup" : "Connect payouts"}
              </Button>
            </div>
          </div>
        )}

        {/* Access Rules Editor (owner only) */}
        {isOwner && showRules && (
          <div className="mt-4 p-4 rounded-lg bg-muted/10 border border-border/20">
            <AccessRuleEditor
              rules={rules}
              onCreateRule={(r) => createRule.mutate(r)}
              onUpdateRule={(r) => updateRule.mutate(r)}
              onDeleteRule={(id) => deleteRule.mutate(id)}
            />
          </div>
        )}


        {tracks.length === 0 && (
          <div className="text-center pt-4 pb-2 text-muted-foreground">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm text-foreground">Upload music from your files</p>
            <p className="text-xs mt-1">Share a full track for free listening, or set a price for paid access.</p>
            <Button size="sm" className="mt-3 min-h-11" onClick={() => setShowUpload(true)}>
              <Plus className="w-4 h-4 mr-1" /> Upload a track
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={(open) => { if (!isUploading) setShowUpload(open); }}>
        <DialogContent className="max-w-md flex flex-col p-4 sm:p-6" data-testid="exclusive-upload-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload a track
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
            <div className="space-y-2">
              <Label htmlFor="exclusive-title">Title</Label>
              <Input
                id="exclusive-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Track name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Tell fans about this track..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclusive-audio-file">Audio file</Label>
              <label
                htmlFor="exclusive-audio-file"
                className="relative block border-2 border-dashed border-border/60 rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
              >
                {audioFile ? (
                  <p className="text-sm text-foreground break-all">{audioFile.name} · {formatBytes(audioFile.size)}</p>
                ) : (
                  <div>
                    <Music className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {AUDIO_UPLOAD_ACTION}
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{LOCKED_AUDIO_DETAIL}</p>
                <input
                  id="exclusive-audio-file"
                  ref={audioInputRef}
                  type="file"
                  accept={AUDIO_FILE_ACCEPT}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAudioFile(file);
                    setUploadProblems(
                      file
                        ? lockedUploadProblems({ title: "x", audio: file, cover: null, price: "1", isAudio: isAudioUpload })
                        : [],
                    );
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Cover art</Label>
              <button
                type="button"
                className="w-full min-h-11 border-2 border-dashed border-border/60 rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-20 h-20 mx-auto rounded-lg object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Optional · square image under 5MB</p>
                )}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Listening access</legend>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={freeListening ? "default" : "outline"} className="min-h-11" aria-pressed={freeListening}
                  onClick={() => { setFreeListening(true); setUploadProblems((p) => p.filter((v) => v !== "price")); }}>
                  Free listening
                </Button>
                <Button type="button" variant={freeListening ? "outline" : "default"} className="min-h-11" aria-pressed={!freeListening}
                  onClick={() => setFreeListening(false)}>
                  Paid access
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {freeListening ? "Listeners can play the full track in Ether. No payouts setup needed. Downloads are off."
                  : "Fans hear a 15-second preview and pay to unlock the full track."}
              </p>
            </fieldset>

            {!freeListening && <>
            <div className="space-y-2">
              <Label htmlFor="exclusive-price">Price (USD)</Label>
              <Input
                id="exclusive-price"
                type="text"
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => {
                  setNewPrice(e.target.value);
                  setUploadProblems((prev) => prev.filter((p) => p !== "price"));
                }}
                placeholder={hasSubscriptionRule ? "4.99, or empty for subscribers only" : "4.99"}
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Set $0.50–$500 for paid access.{hasSubscriptionRule ? " Leave empty for subscribers only." : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Preview start (seconds)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="h-11"
                value={previewStart}
                onChange={(e) => setPreviewStart(e.target.value)}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                Locked listeners hear a 15-second preview starting from this point.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <div>
                <Label className="text-sm">Allow downloads</Label>
                <p className="text-[11px] text-muted-foreground">
                  Only listeners with a completed track purchase can download the original file.
                </p>
              </div>
              <Switch checked={allowDownloads} onCheckedChange={setAllowDownloads} />
            </div>
            </>}
          </div>

          {uploadProblems.length > 0 && (
            <ul role="alert" className="space-y-1 text-xs text-destructive" data-testid="exclusive-upload-problems">
              {uploadProblems.map((problem) => (
                <li key={problem} className="flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {problem === "audio_type" ? AUDIO_UPLOAD_REJECTED : LOCKED_UPLOAD_MESSAGES[problem]}
                </li>
              ))}
            </ul>
          )}
          {isUploading && uploadStep && (
            <p className="text-xs text-muted-foreground" aria-live="polite">{uploadStep}</p>
          )}

          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" className="min-h-11" disabled={isUploading} onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              className="min-h-11"
              onClick={handleUploadTrack}
              disabled={isUploading}
              data-testid="exclusive-upload-submit"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
