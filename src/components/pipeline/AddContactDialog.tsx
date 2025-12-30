import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, User, Mail, Link, Briefcase, StickyNote } from "lucide-react";

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
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
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
      tags: tags.length > 0 ? tags : undefined
    });
    
    resetForm();
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
          {/* Basic Info Section */}
          <Section icon={<User className="w-4 h-4" />} title="Basic Info">
            <div className="space-y-3">
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
                  autoFocus
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
