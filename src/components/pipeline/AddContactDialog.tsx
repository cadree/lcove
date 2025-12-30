import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { 
  User, 
  Instagram, 
  Linkedin, 
  Twitter, 
  FileText,
  Loader2,
  X,
  Target,
  Upload,
  Image,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ContactMethod = "manual" | "instagram" | "linkedin" | "tiktok" | "twitter" | "leadscan" | null;

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
  source?: string;
  socialHandle?: string;
  // Instagram specific fields
  instagramHandle?: string;
  instagramUrl?: string;
  instagramFollowers?: number;
  instagramPosts?: number;
  instagramBio?: string;
  instagramProfileImageUrl?: string;
  instagramVerifiedStatus?: string;
}

const methodOptions = [
  { id: "manual" as const, label: "Manual", icon: User, color: "bg-violet-500" },
  { id: "instagram" as const, label: "Instagram", icon: Instagram, color: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500" },
  { id: "linkedin" as const, label: "LinkedIn", icon: Linkedin, color: "bg-blue-600" },
  { id: "tiktok" as const, label: "TikTok", icon: TikTokIcon, color: "bg-black border border-border" },
  { id: "twitter" as const, label: "Twitter/X", icon: Twitter, color: "bg-black border border-border" },
  { id: "leadscan" as const, label: "Lead Scan", icon: Target, color: "bg-orange-500" },
];

// Custom TikTok icon
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

export function AddContactDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading
}: AddContactDialogProps) {
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  
  // Instagram specific state
  const [igFollowers, setIgFollowers] = useState("");
  const [igPosts, setIgPosts] = useState("");
  const [igBio, setIgBio] = useState("");
  const [igProfileImageUrl, setIgProfileImageUrl] = useState("");
  const [igProfileImageMode, setIgProfileImageMode] = useState<"url" | "upload">("url");

  const resetForm = () => {
    setSelectedMethod(null);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setSocialHandle("");
    setIgFollowers("");
    setIgPosts("");
    setIgBio("");
    setIgProfileImageUrl("");
    setIgProfileImageMode("url");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleBack = () => {
    setSelectedMethod(null);
    setSocialHandle("");
    setIgFollowers("");
    setIgPosts("");
    setIgBio("");
    setIgProfileImageUrl("");
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    await onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      source: "manual"
    });
    
    resetForm();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('contact-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get signed URL (bucket is private)
      const { data: urlData } = await supabase.storage
        .from('contact-avatars')
        .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year
      
      if (urlData?.signedUrl) {
        setIgProfileImageUrl(urlData.signedUrl);
        toast.success("Image uploaded successfully");
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleInstagramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialHandle.trim()) return;
    
    const cleanHandle = socialHandle.replace(/^@/, '').trim();
    
    // Build display name from handle
    const displayName = cleanHandle
      .replace(/[._]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Build subtitle
    const subtitleParts = [];
    if (igFollowers) subtitleParts.push(`${formatCount(parseInt(igFollowers))} followers`);
    if (igPosts) subtitleParts.push(`${igPosts} posts`);
    subtitleParts.push(`@${cleanHandle}`);
    
    await onSubmit({
      name: displayName,
      socialHandle: `@${cleanHandle}`,
      source: "instagram",
      instagramHandle: cleanHandle,
      instagramUrl: `https://instagram.com/${cleanHandle}`,
      instagramFollowers: igFollowers ? parseInt(igFollowers) : undefined,
      instagramPosts: igPosts ? parseInt(igPosts) : undefined,
      instagramBio: igBio || undefined,
      instagramProfileImageUrl: igProfileImageUrl || undefined,
      instagramVerifiedStatus: (igFollowers || igPosts || igBio) ? 'user_entered' : 'unverified'
    });
    
    resetForm();
    toast.success(`Added @${cleanHandle} to pipeline`);
  };

  const formatCount = (n: number) => 
    n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : 
    n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);

  const handleSocialScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialHandle.trim()) return;

    // Use Instagram form for Instagram
    if (selectedMethod === "instagram") {
      return handleInstagramSubmit(e);
    }
    
    // Fallback for other platforms
    const extractedName = socialHandle.replace(/[@_]/g, ' ').trim();
    const formattedName = extractedName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    await onSubmit({
      name: formattedName || socialHandle,
      socialHandle: socialHandle.trim(),
      source: selectedMethod || undefined
    });
    
    resetForm();
  };

  const getSocialLabel = () => {
    switch (selectedMethod) {
      case "instagram": return "Instagram";
      case "linkedin": return "LinkedIn";
      case "tiktok": return "TikTok";
      case "twitter": return "Twitter/X";
      default: return "Social";
    }
  };

  const getSocialPlaceholder = () => {
    switch (selectedMethod) {
      case "instagram": return "@username or instagram.com/username";
      case "linkedin": return "linkedin.com/in/username";
      case "tiktok": return "@username";
      case "twitter": return "@username";
      default: return "@username";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-card border-border max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 sticky top-0 bg-card z-10">
          <button
            onClick={() => handleOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-center text-foreground">
            {selectedMethod === null && "Add Contact"}
            {selectedMethod === "manual" && "Add Manually"}
            {selectedMethod === "instagram" && "Add from Instagram"}
            {selectedMethod && selectedMethod !== "manual" && selectedMethod !== "instagram" && `Add from ${getSocialLabel()}`}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            {selectedMethod === null && (
              <motion.div
                key="method-select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Method Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {methodOptions.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all duration-200"
                    >
                      <div className={`w-12 h-12 rounded-full ${method.color} flex items-center justify-center`}>
                        <method.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{method.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {selectedMethod === "manual" && (
              <motion.form
                key="manual-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleManualSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm text-foreground">
                    Name <span className="text-primary">*</span>
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
                    placeholder="+1..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-muted/30 border-border/50"
                  />
                </div>

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

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-muted/30 border-border/50"
                    onClick={handleBack}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90"
                    disabled={!name.trim() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </motion.form>
            )}

            {selectedMethod === "instagram" && (
              <motion.form
                key="instagram-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleInstagramSubmit}
                className="space-y-4"
              >
                {/* Username (required) */}
                <div className="space-y-2">
                  <Label htmlFor="ig-handle" className="text-sm text-foreground">
                    Instagram Username <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="ig-handle"
                    placeholder="@username"
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                    className="bg-muted/30 border-border/50"
                    autoFocus
                  />
                </div>

                {/* Auto-fetch button (disabled) */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full opacity-50 cursor-not-allowed"
                        disabled
                      >
                        <Info className="w-4 h-4 mr-2" />
                        Fetch automatically
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Coming soon - Instagram API integration</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Separator className="bg-border/50" />

                {/* Optional details section */}
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Enter details (optional)</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ig-followers" className="text-sm text-foreground">Followers</Label>
                      <Input
                        id="ig-followers"
                        type="number"
                        placeholder="2953"
                        value={igFollowers}
                        onChange={(e) => setIgFollowers(e.target.value)}
                        className="bg-muted/30 border-border/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ig-posts" className="text-sm text-foreground">Posts</Label>
                      <Input
                        id="ig-posts"
                        type="number"
                        placeholder="47"
                        value={igPosts}
                        onChange={(e) => setIgPosts(e.target.value)}
                        className="bg-muted/30 border-border/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ig-bio" className="text-sm text-foreground">Bio</Label>
                    <Textarea
                      id="ig-bio"
                      placeholder="Profile bio..."
                      value={igBio}
                      onChange={(e) => setIgBio(e.target.value)}
                      className="bg-muted/30 border-border/50 min-h-[60px]"
                      rows={2}
                    />
                  </div>

                  {/* Profile Image */}
                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">Profile Image</Label>
                    
                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        variant={igProfileImageMode === "url" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIgProfileImageMode("url")}
                        className="flex-1"
                      >
                        <Image className="w-4 h-4 mr-1" />
                        URL
                      </Button>
                      <Button
                        type="button"
                        variant={igProfileImageMode === "upload" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIgProfileImageMode("upload")}
                        className="flex-1"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                    </div>

                    {igProfileImageMode === "url" ? (
                      <Input
                        placeholder="https://... (paste image URL)"
                        value={igProfileImageUrl}
                        onChange={(e) => setIgProfileImageUrl(e.target.value)}
                        className="bg-muted/30 border-border/50"
                      />
                    ) : (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-muted/30 border-border/50"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Choose file
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Preview */}
                    {igProfileImageUrl && (
                      <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <img
                          src={igProfileImageUrl}
                          alt="Profile preview"
                          className="w-12 h-12 rounded-lg object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="text-sm text-muted-foreground truncate flex-1">Image set</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIgProfileImageUrl("")}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-muted/30 border-border/50"
                    onClick={handleBack}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white"
                    disabled={!socialHandle.trim() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Contact"
                    )}
                  </Button>
                </div>
              </motion.form>
            )}

            {selectedMethod && selectedMethod !== "manual" && selectedMethod !== "instagram" && (
              <motion.form
                key="social-scan"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSocialScan}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="social-handle" className="text-sm text-foreground">
                    {getSocialLabel()} Username
                  </Label>
                  <Input
                    id="social-handle"
                    placeholder={getSocialPlaceholder()}
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                    className="bg-muted/30 border-border/50"
                    autoFocus
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-muted/30 border-border/50"
                    onClick={handleBack}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90"
                    disabled={!socialHandle.trim() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Contact"
                    )}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Bottom Section */}
          <div className="mt-6 space-y-4">
            <Separator className="bg-border/50" />
            
            <button className="flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="w-4 h-4" />
              Import file
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}