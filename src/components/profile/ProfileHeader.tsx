import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, MapPin, Camera, Loader2, Sparkles, 
  ArrowLeft, MessageCircle, Edit, Shield, BadgeCheck, UserPlus, UserMinus, Users 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProfileEffects } from './ProfileEffects';
import type { ProfileCustomization } from '@/hooks/useProfileCustomization';
import { useCreatorVerification } from '@/hooks/useCreatorVerification';
import { useFavorites } from '@/hooks/useFavorites';
import { FriendsDrawer } from '@/components/friends/FriendsDrawer';
import type { ThemePreset } from '@/lib/profileThemes';
import { THEME_PRESETS } from '@/lib/profileThemes';

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
}: ProfileHeaderProps) {
  const navigate = useNavigate();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  const isUserFavorite = isFavorite(userId);
  const friendsCount = favorites?.length || 0;

  const themePreset = (customization?.theme_preset as ThemePreset) || 'clean_modern';
  const theme = THEME_PRESETS[themePreset];

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

  const getBackgroundStyle = () => {
    if (!customization) {
      return "bg-gradient-to-br from-primary/20 via-background to-accent/10";
    }
    
    if (customization.background_type === 'image') {
      return "";
    }
    if (customization.background_type === 'color') {
      return customization.background_value;
    }
    return `bg-gradient-to-br ${customization.background_value}`;
  };

  const backgroundImageStyle = customization?.background_type === 'image' 
    ? { 
        backgroundImage: `url(${customization.background_value})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        filter: customization.background_blur ? `blur(${customization.background_blur}px)` : undefined,
        opacity: customization.background_opacity ?? 1,
      }
    : {
        opacity: customization?.background_opacity ?? 1,
      };

  return (
    <>
      {/* Cover Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className={cn("relative h-44 sm:h-56 overflow-hidden", getBackgroundStyle())}
      >
        {customization?.background_type === 'image' && customization.background_value && (
          <div className="absolute inset-0" style={backgroundImageStyle} />
        )}

        {customization?.overlay_tint && (
          <div 
            className="absolute inset-0"
            style={{ 
              backgroundColor: customization.overlay_tint,
              opacity: customization.overlay_opacity ?? 0.3,
            }}
          />
        )}

        <ProfileEffects
          grain={customization?.effect_grain}
          scanlines={customization?.effect_scanlines}
          neonGlow={customization?.effect_neon_glow}
          holographic={customization?.effect_holographic}
          motionGradient={customization?.effect_motion_gradient}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Top Actions */}
        <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
          {!isOwnProfile ? (
            <Button 
              variant="glass" 
              size="icon" 
              className="w-10 h-10" 
              onClick={() => navigate('/home')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <div />
          )}
          
          {isOwnProfile && (
            <div className="flex gap-2">
              <Button variant="glass" size="icon" className="w-10 h-10" onClick={onCustomizeClick}>
                <Sparkles className="w-5 h-5" />
              </Button>
              <Button variant="glass" size="icon" className="w-10 h-10" onClick={onSettingsClick}>
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Profile Info Section */}
      <div className="px-5 -mt-14 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-end gap-4"
        >
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-background shadow-xl ring-2 ring-primary/20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-2xl font-display">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {isOwnProfile && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                  ) : (
                    <Camera className="w-6 h-6 text-foreground" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </>
            )}
          </div>

          {/* Name & Location */}
          <div className="flex-1 pb-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground truncate">
                {displayName}
              </h1>
              <ProfileVerificationBadge userId={userId} />
              {isProfileAdmin && (
                <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 text-xs">
                  <Shield className="w-3 h-3" />
                  Admin
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {city}
              </p>
              
              {isOwnProfile && (
                <FriendsDrawer>
                  <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-medium">{friendsCount}</span> friends
                  </button>
                </FriendsDrawer>
              )}
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex gap-3 mt-5"
        >
          {isOwnProfile ? (
            <Button 
              variant="outline" 
              className="flex-1 h-11"
              onClick={onEditProfileClick}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <>
              <Button 
                variant="default" 
                className="flex-1 h-11"
                onClick={onMessageClick}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>
              <Button 
                variant={isUserFavorite ? "outline" : "secondary"}
                className="h-11"
                onClick={() => toggleFavorite(userId)}
              >
                {isUserFavorite ? (
                  <>
                    <UserMinus className="w-4 h-4 mr-2" />
                    Remove
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </>
                )}
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
}
