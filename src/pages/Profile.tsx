import { useState, useCallback, useRef, useEffect, type CSSProperties } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Bookmark, ArrowLeft, LayoutGrid, Users, LayoutDashboard, ShoppingBag, Calendar, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MusicProfileBlock } from "@/components/music/MusicProfileBlock";
import { ConnectMusicDialog } from "@/components/music/ConnectMusicDialog";
import { ProfileCustomizationDialog } from "@/components/profile/ProfileCustomizationDialog";
import { ProfileRecordPlayer } from "@/components/profile/ProfileRecordPlayer";
import { ProfilePostsGrid } from "@/components/profile/ProfilePostsGrid";
import { PostDetailModal } from "@/components/profile/PostDetailModal";
import { CreateBlogDialog } from "@/components/profile/CreateBlogDialog";
import { ProfileBlogsGrid } from "@/components/profile/ProfileBlogsGrid";
import { UserReviews } from "@/components/profile/UserReviews";
import { CreatorModuleTabs } from "@/components/profile/CreatorModuleTabs";
import { EditProfileDetailsDialog } from "@/components/profile/EditProfileDetailsDialog";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProfileAboutSection } from "@/components/profile/ProfileAboutSection";
import { ProfileFolders } from "@/components/profile/ProfileFolders";
import { ProfileBookEntry, ProfileQuickLinks, ToolsEntry } from "@/components/profile/ProfileQuickLinks";
import { FolderDetailView } from "@/components/profile/FolderDetailView";
import { ProfileLayoutEditor } from "@/components/profile/ProfileLayoutEditor";
import { ProfileFriendsSection } from "@/components/profile/ProfileFriendsSection";
import { ProfileEventsDashboard } from "@/components/profile/ProfileEventsDashboard";
import { ProfileMyTickets } from "@/components/profile/ProfileMyTickets";
import { useProfile } from "@/hooks/useProfile";
import { useMembership } from "@/hooks/useMembership";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useProfileCustomization } from "@/hooks/useProfileCustomization";
import { useProfilePosts } from "@/hooks/useProfilePosts";
import { useProfileBlogs } from "@/hooks/useProfileBlogs";
import { useCreatorRoles } from "@/hooks/useCreatorModules";
import { useUserSkills, useUserPassions, useUserCreativeRoles } from "@/hooks/useUserDetails";
import { useUserIsAdmin } from "@/hooks/useUserIsAdmin";
import { usePortfolioFolders, PortfolioFolder } from "@/hooks/usePortfolioFolders";
import { useProfileLayout, ProfileSection } from "@/hooks/useProfileLayout";
import { toast } from "sonner";
import { ProfilePost } from "@/types/post";
import { applyProfileCustomization, hexToHslChannels } from "@/lib/profileSections";
import { ProfileEffects } from "@/components/profile/ProfileEffects";

const Profile = () => {
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const targetUserId = urlUserId || user?.id;
  const isOwnProfile = !urlUserId || urlUserId === user?.id;
  
  const { profile, loading, updateProfile } = useProfile(targetUserId);
  const { membership } = useMembership();
  const { credits } = useCredits();
  const { customization, isOwner, saveCustomization } = useProfileCustomization(targetUserId);
  const { posts, isLoading: postsLoading, deletePost } = useProfilePosts(targetUserId);
  const { blogs, isLoading: blogsLoading, createBlog, deleteBlog } = useProfileBlogs(targetUserId);
  const { data: creatorRoles = [] } = useCreatorRoles(targetUserId);
  const { data: userSkills = [] } = useUserSkills(targetUserId);
  const { data: userPassions = [] } = useUserPassions(targetUserId);
  const { data: userCreativeRoles = [] } = useUserCreativeRoles(targetUserId);
  const { data: isProfileAdmin = false } = useUserIsAdmin(targetUserId);
  const { folders } = usePortfolioFolders(targetUserId);
  const { layout } = useProfileLayout(targetUserId);
  const { createDirectConversation } = useConversations();

  const [showMusicDialog, setShowMusicDialog] = useState(false);
  const [showCustomizationDialog, setShowCustomizationDialog] = useState(false);
  const [showCreateBlogDialog, setShowCreateBlogDialog] = useState(false);
  const [showEditDetailsDialog, setShowEditDetailsDialog] = useState(false);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PortfolioFolder | null>(null);
  const volumeSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const hasCreatorRoles = creatorRoles.length > 0;

  useEffect(() => {
    if (searchParams.get("action") === "create-blog" && isOwnProfile) {
      setShowCreateBlogDialog(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, isOwnProfile, setSearchParams]);

  // Square portfolio grid sits above the rest of the module stack.
  const visibleSections = applyProfileCustomization(layout, customization)
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);
  const postsSection = visibleSections.find((section) => section.id === "posts_tabs");
  const moduleSections = visibleSections.filter((section) => section.id !== "posts_tabs");

  const handleVolumeChange = useCallback((volume: number) => {
    if (volumeSaveTimeoutRef.current) {
      clearTimeout(volumeSaveTimeoutRef.current);
    }
    volumeSaveTimeoutRef.current = setTimeout(() => {
      saveCustomization.mutate({ profile_music_volume: volume });
    }, 500);
  }, [saveCustomization]);

  const handleAvatarUpdate = async (url: string) => {
    await updateProfile({ avatar_url: url });
  };

  const handleMessageClick = async () => {
    if (!targetUserId) return;
    try {
      const conversation = await createDirectConversation.mutateAsync(targetUserId);
      navigate(`/messages?chat=${conversation.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start conversation');
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

  if (!user && !urlUserId) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Sign in to view your profile</h2>
          <p className="text-muted-foreground text-center">Create an account or sign in to customize your profile.</p>
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (!loading && !profile && urlUserId) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Private profile</h2>
          <p className="text-muted-foreground text-center">This profile is not available.</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </PageLayout>
    );
  }

  const displayName = profile?.display_name || 'Creative';
  const bio = profile?.bio?.trim() || '';
  const city = profile?.city || 'Location not set';
  const avatarUrl = profile?.avatar_url;

  // Render a section based on its ID
  const renderSection = (section: ProfileSection) => {
    switch (section.id) {
      case 'friends':
        if (!isOwnProfile) return null;
        return <ProfileFriendsSection key="friends" />;
      case 'stats':
        return (
          <ProfileStats
            key="stats"
            credits={credits?.balance || 0}
            projectCount={0}
            eventCount={0}
            isOwnProfile={isOwnProfile}
          />
        );
      case 'about':
        return (
          <ProfileAboutSection
            key="about"
            bio={bio}
            creativeRoles={userCreativeRoles}
            skills={userSkills}
            passions={userPassions}
            isOwner={isOwnProfile}
            onEditClick={() => setShowEditDetailsDialog(true)}
          />
        );
      case 'portfolio':
        if (selectedFolder) {
          return (
            <FolderDetailView
              key="portfolio"
              folder={selectedFolder}
              userId={targetUserId || ''}
              isOwner={isOwnProfile}
              onBack={() => setSelectedFolder(null)}
              onPostClick={(item) => {
                // Only open post modal for actual posts with media, not external links
                if ('source' in item && item.source === 'portfolio_item' && item.external_url) {
                  return; // External links are handled in FolderDetailView
                }
                if (item.media_url) {
                  setSelectedPost(item as ProfilePost);
                }
              }}
            />
          );
        }
        if (folders.length > 0 || isOwnProfile) {
          return (
            <ProfileFolders
              key="portfolio"
              userId={targetUserId || ''}
              isOwner={isOwnProfile}
              onFolderClick={(folder) => setSelectedFolder(folder)}
            />
          );
        }
        return null;
      case 'creator_modules':
        if (!targetUserId || !hasCreatorRoles) return null;
        return (
          <motion.div
            key="creator_modules"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="px-5 py-4"
          >
            <CreatorModuleTabs userId={targetUserId} isOwner={isOwnProfile} />
          </motion.div>
        );
      case 'music':
        return (
          <div key="music">
            {customization?.profile_music_enabled && (customization?.profile_music_url || customization?.profile_music_preview_url) && (
              <div className="px-5">
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
              </div>
            )}
            <div className="px-5 py-4">
              <MusicProfileBlock
                userId={targetUserId}
                onConnectClick={() => setShowMusicDialog(true)}
              />
            </div>
          </div>
        );
      case 'posts_tabs':
        return (
          <motion.div
            key="posts_tabs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="px-5 py-4"
          >
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="w-full justify-center border-b border-border rounded-none bg-transparent h-auto py-0 px-0">
                <TabsTrigger 
                  value="posts" 
                  className="min-h-11 flex-1 rounded-none border-b-2 border-transparent px-2 font-mono text-[10px] uppercase tracking-[0.14em] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Posts
                </TabsTrigger>
                <TabsTrigger 
                  value="blogs" 
                  className="min-h-11 flex-1 rounded-none border-b-2 border-transparent px-2 font-mono text-[10px] uppercase tracking-[0.14em] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Blogs
                </TabsTrigger>
                <TabsTrigger 
                  value="saved" 
                  className="min-h-11 flex-1 rounded-none border-b-2 border-transparent px-2 font-mono text-[10px] uppercase tracking-[0.14em] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Saved
                </TabsTrigger>
              </TabsList>
              <TabsContent value="posts" className="mt-4">
                <ProfilePostsGrid 
                  posts={posts}
                  onPostClick={(post) => setSelectedPost(post)}
                  isLoading={postsLoading}
                  isOwner={isOwnProfile}
                />
              </TabsContent>
              <TabsContent value="blogs" className="mt-4">
                {isOwnProfile && (
                  <Button
                    variant="outline"
                    className="mb-4 min-h-11"
                    onClick={() => setShowCreateBlogDialog(true)}
                  >
                    <PenLine className="w-4 h-4 mr-2" />
                    Write a blog
                  </Button>
                )}
                <ProfileBlogsGrid 
                  blogs={blogs}
                  onBlogClick={(blog) => navigate(`/blog/${blog.id}`)}
                  isLoading={blogsLoading}
                  isOwner={isOwnProfile}
                />
              </TabsContent>
              <TabsContent value="saved" className="mt-4">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center mb-4">
                    <Bookmark className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Save</h3>
                  <p className="text-muted-foreground text-sm max-w-[220px]">
                    Save content you want to see again.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        );
      case 'reviews':
        if (!targetUserId) return null;
        return (
          <motion.div
            key="reviews"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="px-5 py-4"
          >
            <UserReviews userId={targetUserId} />
          </motion.div>
        );
      case 'quick_links':
        return <ProfileQuickLinks key="quick_links" isOwner={isOwnProfile} />;
      case 'pipeline':
        if (!isOwnProfile) return null;
        return (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 py-4"
          >
            <Card 
              className="bg-muted/30 border-border/50 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate('/pipeline')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">My Pipeline</h3>
                  <p className="text-xs text-muted-foreground">Manage your contacts and leads</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </div>
            </Card>
          </motion.div>
        );
      case 'boards':
        if (!isOwnProfile) return null;
        return (
          <motion.div
            key="boards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 py-4"
          >
            <Card 
              className="bg-muted/30 border-border/50 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate('/boards')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">Boards</h3>
                  <p className="text-xs text-muted-foreground">Visual canvas workspaces</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </div>
            </Card>
          </motion.div>
        );
      case 'store':
        if (!isOwnProfile) return null;
        return (
          <motion.div
            key="store"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 py-4"
          >
            <Card 
              className="bg-muted/30 border-border/50 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate('/store')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">My Store</h3>
                  <p className="text-xs text-muted-foreground">Manage your products and sales</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </div>
            </Card>
          </motion.div>
        );
      case 'calendar':
        if (!isOwnProfile) return null;
        return (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 py-4"
          >
            <Card 
              className="bg-muted/30 border-border/50 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate('/calendar')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">Calendar</h3>
                  <p className="text-xs text-muted-foreground">View your schedule</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </div>
            </Card>
          </motion.div>
        );
      case 'events_dashboard':
        if (!isOwnProfile) return null;
        return <ProfileEventsDashboard key="events_dashboard" />;
      case 'my_tickets':
        if (!isOwnProfile) return null;
        return <ProfileMyTickets key="my_tickets" />;
      default:
        return null;
    }
  };

  const accentChannels = customization?.accent_color_override
    ? hexToHslChannels(customization.accent_color_override)
    : null;
  const profileFont = customization?.custom_font || undefined;
  const themeVars: Record<string, string> = {};
  if (profileFont) themeVars["--profile-font"] = profileFont;
  if (accentChannels) {
    themeVars["--primary"] = accentChannels;
    themeVars["--ring"] = accentChannels;
    themeVars["--accent"] = accentChannels;
    themeVars["--foreground"] = accentChannels;
  }
  const themeStyle = themeVars as CSSProperties;
  const showEffects = !!(
    customization?.effect_grain
    || customization?.effect_scanlines
    || customization?.effect_neon_glow
    || customization?.effect_holographic
    || customization?.effect_motion_gradient
  );

  return (
    <PageLayout showNotificationBell={false}>
      <div
        className={`relative min-h-screen pb-20 ${profileFont ? "profile-theme" : ""}`}
        style={themeStyle}
      >
        {showEffects && (
          <ProfileEffects
            className="fixed inset-0 z-30"
            grain={customization?.effect_grain}
            scanlines={customization?.effect_scanlines}
            neonGlow={customization?.effect_neon_glow}
            holographic={customization?.effect_holographic}
            motionGradient={customization?.effect_motion_gradient}
          />
        )}
        {!isOwnProfile && (
          <div className="px-5 pt-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const index = window.history.state?.idx;
                if (typeof index === "number" && index > 0) navigate(-1);
                else navigate("/feed");
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        )}

        {/* Header Section - Always at top */}
        <ProfileHeader
          displayName={displayName}
          avatarUrl={avatarUrl}
          city={city}
          isOwnProfile={isOwnProfile}
          isProfileAdmin={isProfileAdmin}
          customization={customization}
          onSettingsClick={() => navigate('/settings')}
          onCustomizeClick={() => setShowCustomizationDialog(true)}
          onEditProfileClick={() => setShowEditDetailsDialog(true)}
          onMessageClick={handleMessageClick}
          onAvatarUpdate={handleAvatarUpdate}
          userId={targetUserId || ''}
          memberTier={isOwnProfile && membership?.subscribed ? membership.tier : null}
          roleLabel={userCreativeRoles[0]?.name || "Creator"}
        />

        <ProfileBookEntry />
        {isOwnProfile && <ToolsEntry />}

        {postsSection && renderSection(postsSection)}

        <div className="ether-rule mx-5" />

        {/* Edit Layout Button - Only for owner */}
        {isOwnProfile && (
          <div className="px-5 py-2">
            <Button
              variant="outline"
              className="w-full min-h-11"
              onClick={() => setShowLayoutEditor(true)}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Edit Layout
            </Button>
          </div>
        )}

        {moduleSections.map(section => renderSection(section))}

        {/* Dialogs */}
        {isOwnProfile && (
          <>
            <ConnectMusicDialog open={showMusicDialog} onOpenChange={setShowMusicDialog} />
            <ProfileCustomizationDialog open={showCustomizationDialog} onOpenChange={setShowCustomizationDialog} />
            <CreateBlogDialog
              open={showCreateBlogDialog}
              onOpenChange={setShowCreateBlogDialog}
              onCreateBlog={async (data) => { await createBlog.mutateAsync(data); }}
            />
            <EditProfileDetailsDialog
              open={showEditDetailsDialog}
              onOpenChange={setShowEditDetailsDialog}
              currentSkills={userSkills}
              currentPassions={userPassions}
              currentRoles={userCreativeRoles}
            />
            <ProfileLayoutEditor
              userId={targetUserId || ''}
              open={showLayoutEditor}
              onClose={() => setShowLayoutEditor(false)}
            />
          </>
        )}

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
    </PageLayout>
  );
};

export default Profile;
