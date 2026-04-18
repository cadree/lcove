import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Music, Plus, Upload, Loader2, Lock } from "lucide-react";
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
import { ExclusiveTrackCard } from "./ExclusiveTrackCard";
import { AccessRuleEditor } from "./AccessRuleEditor";
import {
  useExclusiveTracks,
  useAccessRules,
  type ExclusiveTrack,
  type ExclusiveAccessRule,
} from "@/hooks/useExclusiveMusic";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ExclusiveMusicSectionProps {
  userId: string;
}

export const ExclusiveMusicSection = ({ userId }: ExclusiveMusicSectionProps) => {
  const { user } = useAuth();
  const {
    tracks,
    isLoading,
    hasAccess,
    createTrack,
    updateTrack,
    deleteTrack,
    isOwner,
  } = useExclusiveTracks(userId);
  const { rules, createRule, updateRule, deleteRule } = useAccessRules(userId);

  const [showUpload, setShowUpload] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [previewStart, setPreviewStart] = useState("0");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleUploadTrack = async () => {
    if (!user || !newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!audioFile) {
      toast.error("Please select an audio file");
      return;
    }

    setIsUploading(true);
    try {
      // Upload audio
      const audioExt = audioFile.name.split(".").pop() || "mp3";
      const audioPath = `${user.id}/exclusive-${Date.now()}.${audioExt}`;
      const { error: audioErr } = await supabase.storage
        .from("media")
        .upload(audioPath, audioFile, { upsert: true });
      if (audioErr) throw audioErr;
      const { data: audioUrl } = supabase.storage.from("media").getPublicUrl(audioPath);

      // Upload cover if provided
      let coverUrl: string | undefined;
      if (coverFile) {
        const coverExt = coverFile.name.split(".").pop() || "jpg";
        const coverPath = `${user.id}/exclusive-cover-${Date.now()}.${coverExt}`;
        const { error: coverErr } = await supabase.storage
          .from("media")
          .upload(coverPath, coverFile, { upsert: true });
        if (coverErr) throw coverErr;
        const { data: coverData } = supabase.storage.from("media").getPublicUrl(coverPath);
        coverUrl = coverData.publicUrl;
      }

      await createTrack.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        audio_file_url: audioUrl.publicUrl,
        cover_image_url: coverUrl,
        price_cents: Math.round(parseFloat(newPrice || "0") * 100),
        access_type: "purchase",
        is_published: true,
        allow_downloads: allowDownloads,
        preview_start_seconds: Math.max(0, parseInt(previewStart || "0", 10) || 0),
        preview_duration_seconds: 15,
      });

      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewPrice("");
      setAllowDownloads(false);
      setPreviewStart("0");
      setAudioFile(null);
      setCoverFile(null);
      setCoverPreview("");
      setShowUpload(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload track");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePurchase = async (track: ExclusiveTrack, rule: ExclusiveAccessRule) => {
    if (!user) {
      toast.error("Sign in to purchase music");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("purchase-exclusive-track", {
        body: {
          track_id: track.id,
          access_rule_id: rule.id,
          artist_user_id: track.artist_user_id,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Failed to start purchase");
    }
  };

  if (isLoading) {
    return (
      <div className="glass-strong rounded-xl p-6 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Always render — visitors should see exclusive offerings even when locked
  if (!isOwner && tracks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-xl overflow-hidden"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <h3 className="font-display text-base font-medium text-foreground">
              Exclusive Music
            </h3>
            {tracks.length > 0 && (
              <span className="text-xs text-muted-foreground">({tracks.length})</span>
            )}
          </div>
          {isOwner && (
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowRules(!showRules)}
              >
                Rules
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowUpload(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> Upload
              </Button>
            </div>
          )}
        </div>

        {/* Access Rules Editor (owner only) */}
        {isOwner && showRules && (
          <div className="mb-4 p-4 rounded-lg bg-muted/10 border border-border/20">
            <AccessRuleEditor
              rules={rules}
              onCreateRule={(r) => createRule.mutate(r)}
              onUpdateRule={(r) => updateRule.mutate(r)}
              onDeleteRule={(id) => deleteRule.mutate(id)}
            />
          </div>
        )}

        {/* Track Grid */}
        {tracks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {tracks.map((track) => (
              <ExclusiveTrackCard
                key={track.id}
                track={track}
                hasAccess={hasAccess(track.id)}
                isOwner={isOwner}
                rules={rules}
                onDelete={() => deleteTrack.mutate(track.id)}
                onTogglePublish={() =>
                  updateTrack.mutate({
                    id: track.id,
                    is_published: !track.is_published,
                  })
                }
                onPurchase={handlePurchase}
              />
            ))}
          </div>
        ) : (
          isOwner && (
            <div className="text-center py-6 text-muted-foreground">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Upload exclusive tracks for your fans</p>
            </div>
          )
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Exclusive Track
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Track name"
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
              <Label>Audio File *</Label>
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => audioInputRef.current?.click()}
              >
                {audioFile ? (
                  <p className="text-sm text-foreground">{audioFile.name}</p>
                ) : (
                  <div>
                    <Music className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Click to select MP3, WAV, FLAC, etc.
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Cover Art</Label>
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-20 h-20 mx-auto rounded-lg object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Optional cover image</p>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
            </div>

            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00 (free preview, paid full access)"
              />
            </div>

            <div className="space-y-2">
              <Label>Preview start (seconds)</Label>
              <Input
                type="number"
                min="0"
                step="1"
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
                  Buyers can download the original audio file.
                </p>
              </div>
              <Switch checked={allowDownloads} onCheckedChange={setAllowDownloads} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadTrack}
              disabled={isUploading || !newTitle.trim() || !audioFile}
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
