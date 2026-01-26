import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, X, User, Mail, Link, Briefcase, StickyNote, Users, Camera, Search } from "lucide-react";
import { useUserSearch, SearchedUser } from "@/hooks/useUserSearch";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContactFormData) => Promise<void>;
  isLoading: boolean;
}

export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: string;
  tags?: string[];
  avatarUrl?: string;
  linkedUserId?: string;
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

// Simple debounce hook
function useDebounceValue(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  });

  // Use effect for proper debouncing
  const timeoutRef = useRef<NodeJS.Timeout>();
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  timeoutRef.current = setTimeout(() => {
    setDebouncedValue(value);
  }, delay);

  return debouncedValue;
}

export function AddContactDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading
}: AddContactDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>("");
  const [tagsInput, setTagsInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  
  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const debouncedSearch = useDebounceValue(userSearchQuery, 300);
  const { data: searchResults, isLoading: isSearching } = useUserSearch(debouncedSearch, showUserSearch);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setRole("");
    setInstagramUrl("");
    setTwitterUrl("");
    setLinkedinUrl("");
    setTiktokUrl("");
    setWebsiteUrl("");
    setNotes("");
    setPriority("");
    setTagsInput("");
    setAvatarUrl("");
    setLinkedUserId(null);
    setUserSearchQuery("");
    setShowUserSearch(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSelectUser = (user: SearchedUser) => {
    // Auto-fill from the selected user's profile (phone is not available from search for privacy)
    setName(user.display_name || "");
    setAvatarUrl(user.avatar_url || "");
    setLinkedUserId(user.user_id);
    // Phone is not exposed in user search for privacy - user must enter manually
    
    // Fill social links if available
    if (user.social_links) {
      setInstagramUrl(user.social_links.instagram || "");
      setTwitterUrl(user.social_links.twitter || "");
      setLinkedinUrl(user.social_links.linkedin || "");
      setTiktokUrl(user.social_links.tiktok || "");
      setWebsiteUrl(user.social_links.website || "");
    }
    
    // Close search
    setShowUserSearch(false);
    setUserSearchQuery("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Parse tags from comma-separated input
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    await onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      instagramUrl: instagramUrl.trim() || undefined,
      twitterUrl: twitterUrl.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      tiktokUrl: tiktokUrl.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      priority: priority || undefined,
      tags: tags.length > 0 ? tags : undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      linkedUserId: linkedUserId || undefined
    });
    
    resetForm();
  };

  const handleAvatarUrlChange = (url: string) => {
    setAvatarUrl(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-card border-border max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 sticky top-0 bg-card z-10 border-b border-border/50">
          <button
            onClick={() => handleOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-foreground">Add Contact</h2>
          <p className="text-sm text-muted-foreground mt-1">Add a new contact to your pipeline</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Find Ether User Section */}
          <Section icon={<Users className="w-4 h-4" />} title="Add from Ether">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search Ether users by name..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setShowUserSearch(true);
                  }}
                  onFocus={() => setShowUserSearch(true)}
                  className="pl-9 bg-muted/30 border-border/50"
                />
              </div>
              
              {/* Search Results */}
              {showUserSearch && userSearchQuery.length >= 2 && (
                <div className="border border-border rounded-lg bg-background max-h-48 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <div className="divide-y divide-border">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {user.display_name || 'Unnamed User'}
                            </p>
                            {user.city && (
                              <p className="text-xs text-muted-foreground truncate">{user.city}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No users found
                    </p>
                  )}
                </div>
              )}
              
              {linkedUserId && (
                <div className="flex items-center gap-2 text-xs text-green-500">
                  <span>✓ Linked to Ether user</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedUserId(null);
                      setAvatarUrl("");
                    }}
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    Unlink
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* Avatar & Basic Info Section */}
          <Section icon={<User className="w-4 h-4" />} title="Basic Info">
            <div className="space-y-3">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-border">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    {name ? name.charAt(0).toUpperCase() : <Camera className="w-6 h-6" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="avatarUrl" className="text-xs text-muted-foreground">
                    Avatar URL (optional)
                  </Label>
                  <Input
                    id="avatarUrl"
                    placeholder="https://example.com/photo.jpg"
                    value={avatarUrl}
                    onChange={(e) => handleAvatarUrlChange(e.target.value)}
                    className="bg-muted/30 border-border/50 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-muted/30 border-border/50"
                  autoFocus={!linkedUserId}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-sm text-foreground">Company</Label>
                  <Input
                    id="company"
                    placeholder="Company name"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm text-foreground">Role</Label>
                  <Input
                    id="role"
                    placeholder="Job title"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Contact Info Section */}
          <Section icon={<Mail className="w-4 h-4" />} title="Contact Info">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm text-foreground">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
            </div>
          </Section>

          {/* Social & Links Section */}
          <Section icon={<Link className="w-4 h-4" />} title="Social & Links">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="text-sm text-foreground">Instagram URL</Label>
                  <Input
                    id="instagram"
                    placeholder="instagram.com/username"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="text-sm text-foreground">Twitter/X URL</Label>
                  <Input
                    id="twitter"
                    placeholder="twitter.com/username"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="text-sm text-foreground">LinkedIn URL</Label>
                  <Input
                    id="linkedin"
                    placeholder="linkedin.com/in/username"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="text-sm text-foreground">TikTok URL</Label>
                  <Input
                    id="tiktok"
                    placeholder="tiktok.com/@username"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm text-foreground">Website URL</Label>
                <Input
                  id="website"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
            </div>
          </Section>

          {/* Organization Section */}
          <Section icon={<Briefcase className="w-4 h-4" />} title="Organization">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high' | '')}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags" className="text-sm text-foreground">Tags</Label>
                <Input
                  id="tags"
                  placeholder="influencer, brand, partner (comma separated)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
                <p className="text-xs text-muted-foreground">Separate multiple tags with commas</p>
              </div>
            </div>
          </Section>

          {/* Notes Section */}
          <Section icon={<StickyNote className="w-4 h-4" />} title="Notes">
            <Textarea
              id="notes"
              placeholder="Add any notes about this contact..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-muted/30 border-border/50 min-h-[100px] resize-none"
            />
          </Section>

          {/* Submit */}
          <div className="pt-2 sticky bottom-0 bg-card pb-1">
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding Contact...
                </>
              ) : (
                "Add Contact"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddContactDialog;
