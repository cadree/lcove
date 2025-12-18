import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Settings,
  MapPin,
  Link as LinkIcon,
  Instagram,
  Calendar,
  Store,
  Coins,
  Edit,
  Heart,
  Crown,
  Camera,
  Loader2,
} from "lucide-react";
import { MusicProfileBlock } from "@/components/music/MusicProfileBlock";
import { ConnectMusicDialog } from "@/components/music/ConnectMusicDialog";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Profile = () => {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const { credits } = useCredits();
  const [showMusicDialog, setShowMusicDialog] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await updateProfile({ avatar_url: publicUrl });
      if (updateError) throw updateError;

      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  // Default values for display
  const displayName = profile?.display_name || 'Creative';
  const bio = profile?.bio || 'Welcome to my profile!';
  const city = profile?.city || 'Location not set';
  const avatarUrl = profile?.avatar_url;

  return (
    <PageLayout>
      <div className="min-h-screen">
        {/* Cover Image */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative h-48 sm:h-64 bg-gradient-to-br from-primary/30 via-background to-accent/20"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Settings Button */}
          <Button
            variant="glass"
            size="icon"
            className="absolute top-4 right-4 w-10 h-10"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </motion.div>

        <div className="px-6 -mt-16 relative z-10">
          {/* Avatar & Basic Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-start gap-4 mb-6"
          >
            {/* Avatar with upload */}
            <div className="relative group">
              <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Upload overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
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
            </div>

            {/* Info */}
            <div className="flex-1 pt-2">
              <h1 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-1">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground/70 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {city}
              </p>
            </div>

            {/* Edit Button */}
            <Button variant="outline" className="hidden sm:flex">
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <div className="glass-strong rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Coins className="w-4 h-4 text-primary" />
                <span className="font-display text-xl font-medium text-foreground">
                  {credits?.balance || 0}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">LC Credits</span>
            </div>
            <div className="glass-strong rounded-xl p-4 text-center">
              <span className="font-display text-xl font-medium text-foreground block mb-1">
                0
              </span>
              <span className="text-xs text-muted-foreground">Projects</span>
            </div>
            <div className="glass-strong rounded-xl p-4 text-center">
              <span className="font-display text-xl font-medium text-foreground block mb-1">
                0
              </span>
              <span className="text-xs text-muted-foreground">Events</span>
            </div>
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="font-display text-lg font-medium text-foreground mb-3">About</h2>
            <p className="text-muted-foreground leading-relaxed">{bio}</p>
          </motion.div>

          {/* Music Block */}
          <MusicProfileBlock onConnectClick={() => setShowMusicDialog(true)} />

          {/* Additional Blocks (Preview) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 gap-4 mb-8 mt-8"
          >
            <Link to="/store" className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Store className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">My Store</span>
            </Link>
            <Link to="/calendar" className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Calendar className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">My Events</span>
            </Link>
            <Link to="/fund" className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Heart className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm text-muted-foreground">Community Fund</span>
            </Link>
            <Link to="/membership" className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Crown className="w-6 h-6 text-amber-400 mb-2" />
              <span className="text-sm text-muted-foreground">Membership</span>
            </Link>
          </motion.div>

          {/* Music Dialog */}
          <ConnectMusicDialog open={showMusicDialog} onOpenChange={setShowMusicDialog} />
        </div>
      </div>
    </PageLayout>
  );
};

export default Profile;