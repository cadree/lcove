import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useContactAvatar } from "@/hooks/useContactAvatar";
import { toast } from "sonner";

interface ContactAvatarUploadProps {
  avatarUrl: string | null;
  name: string;
  pipelineItemId: string;
  onAvatarChange: (url: string) => void;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
}

export function ContactAvatarUpload({
  avatarUrl,
  name,
  pipelineItemId,
  onAvatarChange,
  size = "md",
  editable = true,
}: ContactAvatarUploadProps) {
  const { uploadAvatar, isUploading } = useContactAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const url = await uploadAvatar(file, pipelineItemId);
      onAvatarChange(url);
      setPreviewUrl(null);
      toast.success("Photo updated");
    } catch (error) {
      setPreviewUrl(null);
      toast.error("Failed to upload photo");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || avatarUrl;
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative group">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={displayUrl || undefined} alt={name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}
