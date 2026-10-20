import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Settings, MapPin, Camera, Loader2, Crown, Heart,
  MessageCircle, Shield, BadgeCheck, UserPlus, UserMinus, Flag, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errorMessage';
import type { ProfileCustomization } from '@/hooks/useProfileCustomization';
import { useCreatorVerification } from '@/hooks/useCreatorVerification';
import { useFavorites } from '@/hooks/useFavorites';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { useAuth } from '@/contexts/AuthContext';
import { useMyXp } from '@/hooks/useXp';
import { xpBar } from '@/lib/noviQuests';
import { Link } from 'react-router-dom';
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
  postCount?: number;
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
  postCount = 0,
}: ProfileHeaderProps) {
  const { user } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { isBlocked, blockUser, unblockUser } = useUserBlocks();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { data: myXp } = useMyXp();

  const isUserFavorite = isFavorite(userId);
  const ownFriends = favorites?.length || 0;
  const { data: otherFriends = 0 } = useQuery({
    queryKey: ["profile-friend-count", userId],
    enabled: !!userId && !isOwnProfile,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("favorite_friends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) return 0;
      return count ?? 0;
    },
  });
  const { data: projectCount = 0 } = useQuery({
    queryKey: ["profile-project-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", userId);
      if (error) return 0;
      return count ?? 0;
    },
  });
  const friendsCount = isOwnProfile ? ownFriends : otherFriends;

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
      toast.error(errorMessage(error, 'Failed to upload profile picture'));
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

      <div className="holo-card relative mt-2 overflow-hidden">
        <div className="relative h-32">
          {coverImage ? (
            <div className="absolute inset-0" style={coverImage} />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(115deg,#7d0610_0%,#c4142d_46%,#79c3cf_100%)]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--card))_0%,transparent_58%)]" />
        </div>
        <div className="relative z-[1] -mt-10 px-4 pb-4">
        <div className="flex items-end gap-3">
          <div className="group relative shrink-0">
            <Avatar className="h-24 w-24 rounded-full border-[3px] border-transparent bg-[conic-gradient(from_140deg,#FF9FC8,#C4142D,#79C3CF,#FF9FC8)] p-[3px] shadow-[0_0_24px_rgba(255,159,200,0.45)]">
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

        {isOwnProfile && (
          <Link to="/quests" className="mt-3 block">
            <div className="mb-1 flex items-center justify-between">
              <span className="mono-label text-[9px] text-[hsl(var(--brand))]">
                {roleLabel} // Lv {xpBar(myXp?.total ?? 0).level}
              </span>
              <span className="mono-label text-[9px] text-muted-foreground">{myXp?.total ?? 0} XP</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]"
                style={{ width: `${Math.round(xpBar(myXp?.total ?? 0).ratio * 100)}%` }}
              />
            </div>
          </Link>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="file-panel min-h-11 rounded-[12px] px-2 py-2 text-center">
            <span className="block font-body text-[19px] font-extrabold text-foreground">{postCount}</span>
            <span className="mono-label text-[8px] text-muted-foreground">Posts</span>
          </div>
          {isOwnProfile ? (
            <FriendsDrawer>
              <button type="button" className="file-panel min-h-11 w-full rounded-[12px] px-2 py-2 text-center">
                <span className="block font-body text-[19px] font-extrabold text-foreground">{friendsCount}</span>
                <span className="mono-label text-[8px] text-muted-foreground">Friends</span>
              </button>
            </FriendsDrawer>
          ) : (
            <div className="file-panel min-h-11 rounded-[12px] px-2 py-2 text-center">
              <span className="block font-body text-[19px] font-extrabold text-foreground">{friendsCount}</span>
              <span className="mono-label text-[8px] text-muted-foreground">Friends</span>
            </div>
          )}
          <div className="file-panel min-h-11 rounded-[12px] px-2 py-2 text-center">
            <span className="block font-body text-[19px] font-extrabold text-foreground">{projectCount}</span>
            <span className="mono-label text-[8px] text-muted-foreground">Projects</span>
          </div>
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
    </div>
  );
}
