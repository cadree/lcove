import { useState, useRef, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  MapPin,
  Calendar,
  Store,
  Coins,
  Edit,
  BookOpen,
  Heart,
  Crown,
  Camera,
  Loader2,
  Sparkles,
  ArrowLeft,
  MessageCircle,
  Plus,
  Grid,
  Bookmark,
  FileText,
  FolderKanban,
  Rocket,
  ChevronRight,
  Star,
  Shield,
} from "lucide-react";
import { MusicProfileBlock } from "@/components/music/MusicProfileBlock";
import { ConnectMusicDialog } from "@/components/music/ConnectMusicDialog";
import { ProfileCustomizationDialog } from "@/components/profile/ProfileCustomizationDialog";
import { ProfileRecordPlayer } from "@/components/profile/ProfileRecordPlayer";
import { ProfileEffects, HolographicCard, NeonText } from "@/components/profile/ProfileEffects";
import { CreatePostDialog } from "@/components/profile/CreatePostDialog";
import { ProfilePostsGrid } from "@/components/profile/ProfilePostsGrid";
import { PostDetailModal } from "@/components/profile/PostDetailModal";
import { CreateBlogDialog } from "@/components/profile/CreateBlogDialog";
import { ProfileBlogsGrid } from "@/components/profile/ProfileBlogsGrid";
import { UserReviews } from "@/components/profile/UserReviews";
import { CreatorModuleTabs } from "@/components/profile/CreatorModuleTabs";
import { ReputationScore } from "@/components/profile/ReputationScore";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useProfileCustomization } from "@/hooks/useProfileCustomization";
import { useProfilePosts } from "@/hooks/useProfilePosts";
import { useProfileBlogs, BlogPost } from "@/hooks/useProfileBlogs";
import { useCreatorRoles } from "@/hooks/useCreatorModules";
import { THEME_PRESETS, ThemePreset } from "@/lib/profileThemes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProfilePost } from "@/types/post";

const Profile = () => {
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // If viewing another user's profile, use their ID; otherwise use current user's ID
  const targetUserId = urlUserId || user?.id;
  const isOwnProfile = !urlUserId || urlUserId === user?.id;
  
  const { profile, loading, updateProfile } = useProfile(targetUserId);
  const { credits } = useCredits();
  const { customization, isOwner, saveCustomization } = useProfileCustomization(targetUserId);
  const { posts, isLoading: postsLoading, createPost, deletePost } = useProfilePosts(targetUserId);
  const { blogs, isLoading: blogsLoading, createBlog, deleteBlog } = useProfileBlogs(targetUserId);
  const { data: creatorRoles = [] } = useCreatorRoles(targetUserId);
  const [showMusicDialog, setShowMusicDialog] = useState(false);
  const [showCustomizationDialog, setShowCustomizationDialog] = useState(false);
  const [showCreatePostDialog, setShowCreatePostDialog] = useState(false);
  const [showCreateBlogDialog, setShowCreateBlogDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const volumeSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasCreatorRoles = creatorRoles.length > 0;

  // Debounced volume save
  const handleVolumeChange = useCallback((volume: number) => {
    if (volumeSaveTimeoutRef.current) {
      clearTimeout(volumeSaveTimeoutRef.current);
    }
    volumeSaveTimeoutRef.current = setTimeout(() => {
      saveCustomization.mutate({ profile_music_volume: volume });
    }, 500);
  }, [saveCustomization]);

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

  // If viewing own profile but not logged in
  if (!user && !urlUserId) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Sign in to view your profile</h2>
          <p className="text-muted-foreground text-center">Create an account or sign in to customize your profile and connect with the community.</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  // If profile not found for the given userId
  if (!loading && !profile && urlUserId) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Profile not found</h2>
          <p className="text-muted-foreground text-center">This user doesn't exist or their profile is not available.</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </PageLayout>
    );
  }

  // Default values for display
  const displayName = profile?.display_name || 'Creative';
  const bio = profile?.bio || 'Welcome to my profile!';
  const city = profile?.city || 'Location not set';
  const avatarUrl = profile?.avatar_url;

  // Get theme preset
  const themePreset = (customization?.theme_preset as ThemePreset) || 'clean_modern';
  const theme = THEME_PRESETS[themePreset];
  const isCyberpunk = themePreset === 'cyberpunk';
  const isRetro = themePreset === 'retro_spacehey';

  // Determine background styles based on customization
  const getBackgroundStyle = () => {
    if (!customization) {
      return "bg-gradient-to-br from-primary/30 via-background to-accent/20";
    }
    
    if (customization.background_type === 'image') {
      return "";
    }
    if (customization.background_type === 'color') {
      return customization.background_value;
    }
    // gradient
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

  // Get theme-specific card styles
  const getCardStyle = () => {
    if (isCyberpunk) return "bg-black/90 border border-cyan-500/30 rounded-none";
    if (isRetro) return "bg-black/80 border-2 border-pink-500/50 rounded-lg";
    return "glass-strong rounded-xl";
  };

  // Get theme-specific text styles
  const getHeadingStyle = () => {
    if (customization?.custom_font) {
      return { fontFamily: customization.custom_font };
    }
    return {};
  };

  // Get accent color
  const accentColor = customization?.accent_color_override || theme.primaryAccent;

  return (
    <PageLayout showNotificationBell={false}>
      <div
        className="min-h-screen relative"
        style={getHeadingStyle()}
      >
        {/* Cover Image / Background */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className={cn("relative h-48 sm:h-64 overflow-hidden", getBackgroundStyle())}
        >
          {/* Background with opacity/blur */}
          {customization?.background_type === 'image' && customization.background_value && (
            <div 
              className="absolute inset-0"
              style={backgroundImageStyle}
            />
          )}

          {/* Overlay Tint */}
          {customization?.overlay_tint && (
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundColor: customization.overlay_tint,
                opacity: customization.overlay_opacity ?? 0.3,
              }}
            />
          )}

          {/* Theme Effects */}
          <ProfileEffects
            grain={customization?.effect_grain}
            scanlines={customization?.effect_scanlines}
            neonGlow={customization?.effect_neon_glow}
            holographic={customization?.effect_holographic}
            motionGradient={customization?.effect_motion_gradient}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Back Button - show when viewing other profiles */}
          {!isOwnProfile && (
            <Button
              variant="glass"
              size="icon"
              className="absolute top-4 left-4 w-10 h-10 z-10"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          
          {/* Settings Button - only show for own profile */}
          {isOwnProfile && (
            <Button
              variant="glass"
              size="icon"
              className="absolute top-4 right-4 w-10 h-10 z-10"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}

          {/* Customize Button - only show for own profile */}
          {isOwnProfile && (
            <Button
              variant="glass"
              size="icon"
              className="absolute top-4 right-16 w-10 h-10 z-10"
              onClick={() => setShowCustomizationDialog(true)}
            >
              <Sparkles className="w-5 h-5" />
            </Button>
          )}
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
              
              {/* Upload overlay - only show for own profile */}
              {isOwnProfile && (
                <>
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
                </>
              )}
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

            {/* Action Buttons */}
            {isOwnProfile ? (
              <Button variant="outline" className="hidden sm:flex">
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <Button 
                variant="default" 
                className="hidden sm:flex"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            {isCyberpunk ? (
              <>
                <HolographicCard className={cn(getCardStyle(), "p-4 text-center")}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Coins className="w-4 h-4" style={{ color: accentColor }} />
                    <NeonText color={accentColor} className="font-mono text-xl font-bold">
                      {credits?.balance || 0}
                    </NeonText>
                  </div>
                  <span className="text-xs text-cyan-400/70">LC Credits</span>
                </HolographicCard>
                <HolographicCard className={cn(getCardStyle(), "p-4 text-center")}>
                  <NeonText color={accentColor} className="font-mono text-xl font-bold block mb-1">
                    0
                  </NeonText>
                  <span className="text-xs text-cyan-400/70">Projects</span>
                </HolographicCard>
                <HolographicCard className={cn(getCardStyle(), "p-4 text-center")}>
                  <NeonText color={accentColor} className="font-mono text-xl font-bold block mb-1">
                    0
                  </NeonText>
                  <span className="text-xs text-cyan-400/70">Events</span>
                </HolographicCard>
              </>
            ) : (
              <>
                <div className={cn(getCardStyle(), "p-4 text-center")}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Coins className="w-4 h-4" style={{ color: isRetro ? '#ff69b4' : undefined }} />
                    <span 
                      className="font-display text-xl font-medium"
                      style={{ color: isRetro ? '#ff69b4' : undefined }}
                    >
                      {credits?.balance || 0}
                    </span>
                  </div>
                  <span className={cn("text-xs", isRetro ? "text-pink-300" : "text-muted-foreground")}>LC Credits</span>
                </div>
                <div className={cn(getCardStyle(), "p-4 text-center")}>
                  <span 
                    className="font-display text-xl font-medium block mb-1"
                    style={{ color: isRetro ? '#00ffff' : undefined }}
                  >
                    0
                  </span>
                  <span className={cn("text-xs", isRetro ? "text-cyan-300" : "text-muted-foreground")}>Projects</span>
                </div>
                <div className={cn(getCardStyle(), "p-4 text-center")}>
                  <span 
                    className="font-display text-xl font-medium block mb-1"
                    style={{ color: isRetro ? '#ff69b4' : undefined }}
                  >
                    0
                  </span>
                  <span className={cn("text-xs", isRetro ? "text-pink-300" : "text-muted-foreground")}>Events</span>
                </div>
              </>
            )}
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

          {/* Reputation Score - show for all profiles */}
          {targetUserId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mb-8"
            >
              <ReputationScore userId={targetUserId} />
            </motion.div>
          )}

          {/* Creator Module Tabs - show if user has creator roles */}
          {targetUserId && hasCreatorRoles && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46 }}
              className="mb-8"
            >
              <CreatorModuleTabs userId={targetUserId} isOwner={isOwnProfile} />
            </motion.div>
          )}

          {/* Quick Actions - Projects */}
          {isOwnProfile && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mb-8"
            >
              <h2 className="font-display text-lg font-medium text-foreground mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link 
                  to="/projects"
                  className={cn(
                    getCardStyle(),
                    "p-4 flex flex-col items-center gap-2 hover:scale-[1.02] transition-transform cursor-pointer"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Browse Projects</span>
                  <span className="text-xs text-muted-foreground text-center">Find collaborators</span>
                </Link>
                <Link 
                  to="/projects"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/projects');
                    // Small delay to let the page load, then trigger the create dialog
                    setTimeout(() => {
                      document.querySelector<HTMLButtonElement>('[data-create-project]')?.click();
                    }, 100);
                  }}
                  className={cn(
                    getCardStyle(),
                    "p-4 flex flex-col items-center gap-2 hover:scale-[1.02] transition-transform cursor-pointer border-primary/30"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Post a Project</span>
                  <span className="text-xs text-muted-foreground text-center">Need help? Ask the community</span>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Profile Music Record Player - shows when music is enabled */}
          {customization?.profile_music_enabled && (customization?.profile_music_url || customization?.profile_music_preview_url) && (
            <ProfileRecordPlayer
              musicUrl={customization.profile_music_url}
              previewUrl={customization.profile_music_preview_url}
              title={customization.profile_music_title}
              artist={customization.profile_music_artist}
              albumArtUrl={customization.profile_music_album_art_url}
              source={customization.profile_music_source as 'spotify' | 'apple_music' | 'upload' | null}
              externalId={customization.profile_music_external_id}
              defaultVolume={customization.profile_music_volume ?? 0.5}
              isOwner={isOwner}
              onVolumeChange={handleVolumeChange}
            />
          )}

          {/* Music Block - only show for own profile with connect option */}
          {isOwnProfile && (
            <MusicProfileBlock onConnectClick={() => setShowMusicDialog(true)} />
          )}

          {/* Posts Grid Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 mb-8"
          >
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="w-full justify-center border-t border-border rounded-none bg-transparent h-auto py-0">
                <TabsTrigger 
                  value="posts" 
                  className="flex-1 rounded-none border-t-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent py-3"
                >
                  <Grid className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Posts</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="blogs" 
                  className="flex-1 rounded-none border-t-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent py-3"
                >
                  <FileText className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Blog</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="saved" 
                  className="flex-1 rounded-none border-t-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent py-3"
                >
                  <Bookmark className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Saved</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="posts" className="mt-4">
                <ProfilePostsGrid 
                  posts={posts}
                  onPostClick={(post) => setSelectedPost(post)}
                  isLoading={postsLoading}
                />
              </TabsContent>
              <TabsContent value="blogs" className="mt-4">
                <ProfileBlogsGrid 
                  blogs={blogs}
                  onBlogClick={(blog) => setSelectedBlog(blog)}
                  isLoading={blogsLoading}
                  isOwner={isOwnProfile}
                />
              </TabsContent>
              <TabsContent value="saved" className="mt-4">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
                    <Bookmark className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-xl font-medium text-foreground mb-2">Save</h3>
                  <p className="text-muted-foreground text-sm max-w-[250px]">
                    Save photos and videos that you want to see again.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* User Reviews Section */}
          {targetUserId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mb-8"
            >
              <UserReviews userId={targetUserId} />
            </motion.div>
          )}

          {/* Additional Blocks - only show for own profile */}
          {isOwnProfile && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-2 gap-4 mb-8"
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
              <Link to="/book" className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors col-span-2">
                <BookOpen className="w-6 h-6 text-foreground mb-2" />
                <span className="text-sm text-muted-foreground">The Book of LCOVE</span>
              </Link>
            </motion.div>
          )}

          {/* Message button for mobile - only show on other users' profiles */}
          {!isOwnProfile && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-8 mb-8 sm:hidden"
            >
              <Button 
                className="w-full"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message {displayName}
              </Button>
            </motion.div>
          )}

          {/* Music Dialog - only for own profile */}
          {isOwnProfile && (
            <ConnectMusicDialog open={showMusicDialog} onOpenChange={setShowMusicDialog} />
          )}
          
          {/* Customization Dialog - only for own profile */}
          {isOwnProfile && (
            <ProfileCustomizationDialog 
              open={showCustomizationDialog} 
              onOpenChange={setShowCustomizationDialog} 
            />
          )}

          {/* Create Post Dialog - only for own profile */}
          {isOwnProfile && (
            <CreatePostDialog
              open={showCreatePostDialog}
              onOpenChange={setShowCreatePostDialog}
              onCreatePost={async (data) => {
                await createPost.mutateAsync(data);
              }}
              userAvatar={avatarUrl}
              userName={displayName}
            />
          )}

          {/* Create Blog Dialog - only for own profile */}
          {isOwnProfile && (
            <CreateBlogDialog
              open={showCreateBlogDialog}
              onOpenChange={setShowCreateBlogDialog}
              onCreateBlog={async (data) => {
                await createBlog.mutateAsync(data);
              }}
            />
          )}

          {/* Post Detail Modal */}
          <PostDetailModal
            post={selectedPost}
            open={!!selectedPost}
            onOpenChange={(open) => !open && setSelectedPost(null)}
            isOwner={isOwnProfile}
            onDelete={(postId) => {
              deletePost.mutate(postId);
              setSelectedPost(null);
            }}
          />
        </div>

        {/* Floating Create Buttons - only for own profile */}
        {isOwnProfile && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-50 flex flex-col gap-3"
          >
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-12 rounded-full shadow-lg bg-background/90 backdrop-blur-sm"
              onClick={() => setShowCreateBlogDialog(true)}
              title="Write Blog"
            >
              <FileText className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => setShowCreatePostDialog(true)}
              title="Create Post"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
};

export default Profile;