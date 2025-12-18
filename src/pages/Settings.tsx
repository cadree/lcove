import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Bell,
  Save,
  Loader2,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationPreferences } from "@/hooks/useNotifications";
import { toast } from "sonner";

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, loading, updateProfile } = useProfile();
  const { preferences, isLoading: prefsLoading, updatePreferences } = useNotificationPreferences();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setCity(profile.city || "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        display_name: displayName || null,
        bio: bio || null,
        city: city || null,
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-foreground">
            Settings
          </h1>
        </motion.div>

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

        {/* Notification Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-6"
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
          </div>
        </motion.section>
      </div>
    </PageLayout>
  );
};

export default Settings;
