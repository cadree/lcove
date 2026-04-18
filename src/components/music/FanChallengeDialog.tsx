import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Instagram, Music2, Twitter, Sparkles, Upload, Loader2, Target } from "lucide-react";
import {
  getChallengeMeta,
  useCompleteChallenge,
} from "@/hooks/useFanChallenges";
import type { ExclusiveAccessRule } from "@/hooks/useExclusiveMusic";

const PLATFORM_META: Record<string, { label: string; Icon: any; color: string }> = {
  instagram: { label: "Instagram", Icon: Instagram, color: "text-pink-500" },
  tiktok: { label: "TikTok", Icon: Music2, color: "text-foreground" },
  x: { label: "X (Twitter)", Icon: Twitter, color: "text-sky-500" },
  other: { label: "Anywhere", Icon: Sparkles, color: "text-amber-500" },
};

interface FanChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: ExclusiveAccessRule | null;
  trackTitle: string;
  trackId: string;
}

export const FanChallengeDialog = ({
  open,
  onOpenChange,
  rule,
  trackTitle,
  trackId,
}: FanChallengeDialogProps) => {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofText, setProofText] = useState("");
  const complete = useCompleteChallenge();

  if (!rule) return null;
  const meta = getChallengeMeta(rule);
  const platformKey = (meta.platform || "other").toLowerCase();
  const platform = PLATFORM_META[platformKey] || PLATFORM_META.other;
  const requiresProof = !!meta.requires_proof;

  const canSubmit = !requiresProof || !!proofFile || proofText.trim().length > 3;

  const handleSubmit = async () => {
    try {
      await complete.mutateAsync({
        rule,
        trackId,
        proofFile,
        proofText,
      });
      setProofFile(null);
      setProofText("");
      onOpenChange(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" />
            Fan Challenge
          </DialogTitle>
          <DialogDescription>
            Unlock <span className="font-medium text-foreground">{trackTitle}</span> by supporting the artist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
            <platform.Icon className={`w-5 h-5 ${platform.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{rule.label || `Share on ${platform.label}`}</p>
              <p className="text-xs text-muted-foreground">{platform.label}</p>
            </div>
          </div>

          {(rule.description || meta.instructions) && (
            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {rule.description || meta.instructions}
            </div>
          )}

          {requiresProof && (
            <div className="space-y-3 p-3 rounded-lg border border-dashed border-border/60">
              <p className="text-xs font-medium text-foreground">
                Proof required — upload a screenshot or paste the link
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs">Screenshot</Label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 cursor-pointer hover:bg-accent/30 text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  {proofFile ? proofFile.name : "Choose image..."}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Or paste a link / handle</Label>
                <Textarea
                  value={proofText}
                  onChange={(e) => setProofText(e.target.value)}
                  placeholder="https://instagram.com/p/..."
                  className="min-h-[60px] text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || complete.isPending}
            >
              {complete.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              I completed this
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
