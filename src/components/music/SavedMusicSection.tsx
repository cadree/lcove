import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bookmark, Music } from "lucide-react";
import { useSavedTracksForProfile } from "@/hooks/useMusicLibrary";
import { PreviewPlayer } from "./PreviewPlayer";

interface SavedMusicSectionProps {
  userId: string;
}

export const SavedMusicSection = ({ userId }: SavedMusicSectionProps) => {
  const { data: saves = [], isLoading } = useSavedTracksForProfile(userId);

  if (isLoading || saves.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-xl overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bookmark className="w-4 h-4 text-primary" />
          <h3 className="font-display text-base font-medium text-foreground">
            Collected Music
          </h3>
          <span className="text-xs text-muted-foreground">({saves.length})</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {saves.map((save) => {
            const t = save.track;
            if (!t) return null;
            return (
              <div
                key={save.id}
                className="rounded-xl overflow-hidden bg-muted/10 border border-border/30 group"
              >
                <div className="aspect-square bg-muted relative">
                  {t.cover_image_url ? (
                    <img src={t.cover_image_url} alt={t.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-2">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <Link
                    to={`/profile/${t.artist_user_id}`}
                    className="text-xs text-muted-foreground hover:text-primary truncate block"
                  >
                    by {t.artist?.display_name || "Artist"}
                  </Link>
                  {t.audio_file_url && (
                    <PreviewPlayer
                      audioUrl={t.preview_clip_url || t.audio_file_url}
                      startSeconds={t.preview_start_seconds || 0}
                      durationSeconds={t.preview_duration_seconds || 15}
                      locked
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
