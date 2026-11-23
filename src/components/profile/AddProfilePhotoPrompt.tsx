import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { uploadAvatar } from "@/lib/avatarUpload";
import { errorMessage } from "@/lib/errorMessage";
import {
  MISSING_PHOTO_ACTION,
  MISSING_PHOTO_PROMPT,
  needsActiveMemberPhotoPrompt,
} from "@/lib/profilePhoto";
import { ProfilePhotoInput } from "@/components/profile/ProfilePhotoInput";

interface AddProfilePhotoPromptProps {
  profile: Profile | null | undefined;
  userId: string;
  className?: string;
}

export function AddProfilePhotoPrompt({ profile, userId, className }: AddProfilePhotoPromptProps) {
  const { user } = useAuth();
  const { updateProfile } = useProfile(userId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user || user.id !== userId || !needsActiveMemberPhotoPrompt(profile)) {
    return null;
  }

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAvatar(userId, file);
      const { error } = await updateProfile({ avatar_url: url });
      if (error) throw error;
      toast.success("Photo added");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save your photo. Try again."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`file-panel flex items-center gap-3 px-4 py-3 ${className ?? ""}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/60">
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
      </span>
      <p className="min-w-0 flex-1 font-body text-sm font-medium text-foreground">
        {MISSING_PHOTO_PROMPT}
      </p>
      <Button
        type="button"
        size="sm"
        className="min-h-11 shrink-0"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {MISSING_PHOTO_ACTION}
      </Button>
      <ProfilePhotoInput ref={inputRef} onFile={(file) => void handleFile(file)} disabled={uploading} />
    </div>
  );
}
