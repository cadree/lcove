import { useRef, useState } from 'react';
import { 
  Settings, MapPin, Camera, Loader2, Crown, Heart,
  MessageCircle, Shield, BadgeCheck, UserPlus, UserMinus, Users, Flag, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProfileEffects } from './ProfileEffects';
import type { ProfileCustomization } from '@/hooks/useProfileCustomization';
import { useCreatorVerification } from '@/hooks/useCreatorVerification';
import { useFavorites } from '@/hooks/useFavorites';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { useAuth } from '@/contexts/AuthContext';
import { useMyXp } from '@/hooks/useXp';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { FriendsDrawer } from '@/components/friends/FriendsDrawer';

// Component to show verification badge inline
function ProfileVerificationBadge({ userId }: { userId: string }) {
  const { data: verification } = useCreatorVerification(userId);
  
  if (!verification || verification.status !== 'approved') {
    return null;
  }
  
  return (
    <BadgeCheck className="w-5 h-5 text-primary" />
  );
}

interface ProfileHeaderProps {
  displayName: string;
  avatarUrl: string | null;
  city: string;
  isOwnProfile: boolean;
  isProfileAdmin: boolean;
  customization: ProfileCustomization | null;
  onSettingsClick: () => void;
  onCustomizeClick: () => void;
  onEditProfileClick: () => void;
  onMessageClick: () => void;
  onAvatarUpdate: (url: string) => void;
  userId: string;
  memberTier: "community" | "elite" | null;
  roleLabel?: string;
}

export function ProfileHeader({
  displayName,
  avatarUrl,
  city,
  isOwnProfile,
  isProfileAdmin,
  customization,
  onSettingsClick,
  onCustomizeClick,
  onEditProfileClick,
  onMessageClick,
  onAvatarUpdate,
  userId,
  memberTier,
  roleLabel = "Creator",
}: ProfileHeaderProps) {
  const { user } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { isBlocked, blockUser, unblockUser } = useUserBlocks();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { data: myXp } = useMyXp();

  const isUserFavorite = isFavorite(userId);
  const friendsCount = favorites?.length || 0;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      onAvatarUpdate(publicUrl);
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const coverImage = customization?.background_type === 'image' && customization.background_value
    ? {
        backgroundImage: `url(${customization.background_value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: customization.background_blur ? `blur(${customization.background_blur}px)` : undefined,
        opacity: customization.background_opacity ?? 1,
      }
    : null;

  return (
    <div className="px-4 pt-3">
      <div className="flex min-h-11 items-center justify-between">
        <p className="kicker">Familcy // Lcove</p>
        {isOwnProfile && (
          <Button variant="ghost" size="icon" onClick={onSettingsClick} aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="holo-card mt-2 p-4">
        {coverImage && <div className="mb-3 h-20 overflow-hidden rounded-[12px]" style={coverImage} />}
        <ProfileEffects
          grain={customization?.effect_grain}
          scanlines={customization?.effect_scanlines}
          neonGlow={customization?.effect_neon_glow}
          holographic={customization?.effect_holographic}
          motionGradient={customization?.effect_motion_gradient}
        />
        <div className="relative z-[1] flex items-center gap-3">
          <div className="group relative shrink-0">
            <Avatar className="h-16 w-16 rounded-full border border-border">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="rounded-full bg-muted font-body text-xl font-bold text-foreground">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label="Update profile photo"
                >
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="ether-title truncate text-[24px]">{displayName}</h1>
              <ProfileVerificationBadge userId={userId} />
              {memberTier === "elite" && (
                <Badge className="gap-1 border-0 bg-gradient-to-r from-amber-400 to-orange-500 text-[10px] text-white">
                  <Crown className="h-3 w-3" /> Elite
                </Badge>
              )}
              {memberTier === "community" && (
                <Badge className="gap-1 border-primary/30 bg-primary/20 text-[10px] text-primary">
                  <Heart className="h-3 w-3" /> Community
                </Badge>
              )}
              {isProfileAdmin && (
                <Badge className="gap-1 border-primary/30 bg-primary/20 text-[10px] text-primary">
                  <Shield className="h-3 w-3" /> Admin
                </Badge>
              )}
            </div>
            <p className="lore text-[16px] text-foreground">{roleLabel}</p>
            <p className="mono-label mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {city}
            </p>
          </div>
        </div>

        <div className="relative z-[1] mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {isOwnProfile && myXp && (
            <p className="mono-label text-[10px] text-muted-foreground">Level {myXp.level}</p>
          )}
          {isOwnProfile && (
            <FriendsDrawer>
              <button type="button" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{friendsCount}</span> friends
              </button>
            </FriendsDrawer>
          )}
        </div>

        <div className="relative z-[1] mt-3 flex gap-2">
          {isOwnProfile ? (
            <>
              <Button className="h-11 flex-1" onClick={onEditProfileClick}>Edit profile</Button>
              <Button variant="outline" className="h-11 flex-1" onClick={onCustomizeClick}>Customize</Button>
            </>
          ) : (
            <>
              <Button className="h-11 flex-1" onClick={onMessageClick}>
                <MessageCircle className="h-4 w-4" /> Message
              </Button>
              <Button
                variant={isUserFavorite ? "outline" : "secondary"}
                className="h-11"
                onClick={() => toggleFavorite(userId)}
              >
                {isUserFavorite ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isUserFavorite ? "Remove" : "Add friend"}
              </Button>
            </>
          )}
        </div>

        {!isOwnProfile && user && (
          <div className="relative z-[1] mt-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isBlocked(userId)) unblockUser.mutate(userId);
                else blockUser.mutate(userId);
              }}
            >
              <Ban className="h-4 w-4" />
              {isBlocked(userId) ? "Unblock" : "Block"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
              <Flag className="h-4 w-4" /> Report
            </Button>
            <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="profile" targetId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
