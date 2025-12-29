import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Bell,
  Save,
  Loader2,
  Lock,
  LogOut,
  Archive,
  Activity,
  BarChart3,
  Heart,
  MessageSquare,
  Eye,
  Users,
  Ban,
  Shield,
  Settings as SettingsIcon,
  ArrowRight,
  Phone,
  Globe,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useNotificationPreferences } from "@/hooks/useNotifications";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Settings = () => {
  const { user, updatePassword, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { profile, loading, updateProfile } = useProfile();
  const { preferences, isLoading: prefsLoading, updatePreferences } = useNotificationPreferences();
  const { blockedUsers, unblockUser, isLoading: blocksLoading } = useUserBlocks();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    instagram: "",
    twitter: "",
    tiktok: "",
    youtube: "",
    linkedin: "",
    website: "",
  });
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch user activity stats
  const { data: activityStats } = useQuery({
    queryKey: ['user-activity-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [likesResult, commentsResult, postsResult] = await Promise.all([
        supabase.from('post_likes').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('post_comments').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('posts').select('id', { count: 'exact' }).eq('user_id', user.id),
      ]);

      return {
        likesGiven: likesResult.count || 0,
        commentsGiven: commentsResult.count || 0,
        postsCreated: postsResult.count || 0,
      };
    },
    enabled: !!user,
  });

  // Fetch insights data
  const { data: insightsData } = useQuery({
    queryKey: ['user-insights', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [likesReceived, commentsReceived, followersResult] = await Promise.all([
        supabase.from('post_likes').select('posts!inner(user_id)', { count: 'exact' }).eq('posts.user_id', user.id),
        supabase.from('post_comments').select('posts!inner(user_id)', { count: 'exact' }).eq('posts.user_id', user.id),
        supabase.from('favorite_friends').select('id', { count: 'exact' }).eq('friend_user_id', user.id),
      ]);

      return {
        likesReceived: likesReceived.count || 0,
        commentsReceived: commentsReceived.count || 0,
        followers: followersResult.count || 0,
      };
    },
    enabled: !!user,
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to log out");
    } finally {
      setLoggingOut(false);
    }
  };

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setCity(profile.city || "");
      setPhone(profile.phone || "");
      setSocialLinks({
        instagram: profile.social_links?.instagram || "",
        twitter: profile.social_links?.twitter || "",
        tiktok: profile.social_links?.tiktok || "",
        youtube: profile.social_links?.youtube || "",
        linkedin: profile.social_links?.linkedin || "",
        website: profile.social_links?.website || "",
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Build social_links object, filtering out empty strings
      const cleanedSocialLinks: Record<string, string> = {};
      Object.entries(socialLinks).forEach(([key, value]) => {
        if (value.trim()) {
          cleanedSocialLinks[key] = value.trim();
        }
      });

      const { error } = await updateProfile({
        display_name: displayName || null,
        bio: bio || null,
        city: city || null,
        phone: phone || null,
        social_links: Object.keys(cleanedSocialLinks).length > 0 ? cleanedSocialLinks : null,
      });
      
      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = (key: string, value: boolean) => {
    updatePreferences({ [key]: value });
    toast.success("Preferences updated");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Sign in to access settings</h2>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (loading || prefsLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="px-4 sm:px-6 py-6 pb-32 max-w-2xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Settings"
          icon={<SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          backPath="/profile"
          className="mb-8"
        />

        {/* Profile Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Profile</h2>
              <p className="text-sm text-muted-foreground">Customize how others see you</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your creative name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Where are you based?"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself and your creative journey..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="bg-background/50 min-h-[100px] resize-none"
              />
            </div>

            <Button 
              onClick={handleSaveProfile} 
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </motion.section>

        {/* Contact Info Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Contact Info</h2>
              <p className="text-sm text-muted-foreground">Add your phone and social media</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">For SMS notifications from the community</p>
            </div>

            <Separator className="bg-border/50" />

            <div className="space-y-4">
              <Label className="text-foreground font-medium">Social Media Links</Label>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2 text-sm">
                    <Instagram className="w-4 h-4" /> Instagram
                  </Label>
                  <Input
                    id="instagram"
                    placeholder="@username or URL"
                    value={socialLinks.instagram}
                    onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-2 text-sm">
                    <Twitter className="w-4 h-4" /> Twitter / X
                  </Label>
                  <Input
                    id="twitter"
                    placeholder="@username or URL"
                    value={socialLinks.twitter}
                    onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    TikTok
                  </Label>
                  <Input
                    id="tiktok"
                    placeholder="@username or URL"
                    value={socialLinks.tiktok}
                    onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube" className="flex items-center gap-2 text-sm">
                    <Youtube className="w-4 h-4" /> YouTube
                  </Label>
                  <Input
                    id="youtube"
                    placeholder="Channel URL"
                    value={socialLinks.youtube}
                    onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2 text-sm">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    placeholder="Profile URL"
                    value={socialLinks.linkedin}
                    onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4" /> Website
                  </Label>
                  <Input
                    id="website"
                    placeholder="https://yoursite.com"
                    value={socialLinks.website}
                    onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveProfile} 
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Contact Info
                </>
              )}
            </Button>
          </div>
        </motion.section>

        {/* Security Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Security</h2>
              <p className="text-sm text-muted-foreground">Update your password</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </div>
        </motion.section>

        {/* Notification Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Notifications</h2>
              <p className="text-sm text-muted-foreground">Choose what updates you receive</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Messages</Label>
                <p className="text-sm text-muted-foreground">New direct messages</p>
              </div>
              <Switch
                checked={preferences?.messages_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('messages_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Comments</Label>
                <p className="text-sm text-muted-foreground">Comments on your posts</p>
              </div>
              <Switch
                checked={preferences?.comments_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('comments_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Likes</Label>
                <p className="text-sm text-muted-foreground">Likes on your posts</p>
              </div>
              <Switch
                checked={preferences?.likes_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('likes_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Project Invites</Label>
                <p className="text-sm text-muted-foreground">Collaboration requests</p>
              </div>
              <Switch
                checked={preferences?.project_invites_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('project_invites_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Event Reminders</Label>
                <p className="text-sm text-muted-foreground">Upcoming event notifications</p>
              </div>
              <Switch
                checked={preferences?.event_reminders_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('event_reminders_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Live Streams</Label>
                <p className="text-sm text-muted-foreground">When creators you follow go live</p>
              </div>
              <Switch
                checked={preferences?.live_streams_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('live_streams_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50 my-4" />
            <p className="text-sm font-medium text-muted-foreground mb-4">Delivery Methods</p>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch
                checked={preferences?.email_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('email_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications on your device</p>
              </div>
              <Switch
                checked={preferences?.push_enabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('push_enabled', checked)}
              />
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-foreground">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive text messages (requires phone number)</p>
              </div>
              <Switch
                checked={preferences?.sms_enabled ?? false}
                onCheckedChange={(checked) => handleNotificationToggle('sms_enabled', checked)}
                disabled={!phone}
              />
            </div>
          </div>
        </motion.section>

        {/* Your Activity Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Your Activity</h2>
              <p className="text-sm text-muted-foreground">See what you've been up to</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center mx-auto mb-2">
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{activityStats?.likesGiven || 0}</p>
              <p className="text-xs text-muted-foreground">Likes Given</p>
            </div>
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{activityStats?.commentsGiven || 0}</p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                <Archive className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{activityStats?.postsCreated || 0}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
          </div>
        </motion.section>

        {/* Insights Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Insights</h2>
              <p className="text-sm text-muted-foreground">Your profile engagement</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center mx-auto mb-2">
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{insightsData?.likesReceived || 0}</p>
              <p className="text-xs text-muted-foreground">Likes Received</p>
            </div>
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{insightsData?.commentsReceived || 0}</p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{insightsData?.followers || 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
          </div>
        </motion.section>

        {/* Blocked Users Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Ban className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Blocked Users</h2>
              <p className="text-sm text-muted-foreground">Manage blocked accounts</p>
            </div>
          </div>

          {blocksLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No blocked users</p>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((blocked) => (
                <div key={blocked.user_id} className="flex items-center justify-between bg-background/50 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {blocked.avatar_url ? (
                        <img src={blocked.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="font-medium text-foreground">{blocked.display_name || 'Unknown User'}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unblockUser.mutate(blocked.user_id)}
                    disabled={unblockUser.isPending}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Admin Section - Only visible to admins */}
        {isAdmin && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-strong rounded-2xl p-6 mb-6"
          >
            <Link to="/admin" className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-medium text-foreground">Admin Dashboard</h2>
                  <p className="text-sm text-muted-foreground">Manage users, credits, and announcements</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </motion.section>
        )}

        {/* Log Out Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-strong rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-foreground">Account</h2>
              <p className="text-sm text-muted-foreground">Sign out of your account</p>
            </div>
          </div>

          <Button 
            variant="destructive" 
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full"
          >
            {loggingOut ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging out...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </>
            )}
          </Button>
        </motion.section>
      </div>
    </PageLayout>
  );
};

export default Settings;
