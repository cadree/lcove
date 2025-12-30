import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Instagram, 
  Linkedin, 
  Twitter, 
  FileText,
  Loader2,
  X,
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  // Extended Instagram data
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
  profilePictureUrl?: string;
  isVerified?: boolean;
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
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  
  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [socialHandle, setSocialHandle] = useState("");

  const resetForm = () => {
    setSelectedMethod(null);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setSocialHandle("");
    setIsScanning(false);
    setScanProgress(0);
    setScanStatus("");
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
    setIsScanning(false);
    setScanProgress(0);
    setScanStatus("");
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

  const handleInstagramScan = async () => {
    if (!socialHandle.trim()) return;
    
    setIsScanning(true);
    setScanProgress(10);
    setScanStatus("Connecting to Instagram...");

    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 5, 80));
      }, 300);

      setScanProgress(30);
      setScanStatus("Fetching profile data...");

      const { data, error } = await supabase.functions.invoke('scrape-instagram', {
        body: { username: socialHandle.trim() }
      });

      clearInterval(progressInterval);

      if (error) {
        throw new Error(error.message || 'Failed to scrape Instagram');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to extract Instagram data');
      }

      setScanProgress(90);
      setScanStatus("Processing data...");

      const profile = data.data;
      
      setScanProgress(100);
      setScanStatus("Complete!");

      // Submit with extracted data
      await onSubmit({
        name: profile.displayName || socialHandle,
        socialHandle: `@${profile.username}`,
        source: "instagram",
        bio: profile.bio,
        followers: profile.followers,
        following: profile.following,
        posts: profile.posts,
        profilePictureUrl: profile.profilePictureUrl,
        isVerified: profile.isVerified,
        company: profile.category || undefined,
      });

      toast.success(`Instagram profile extracted: ${profile.displayName}`);
      resetForm();

    } catch (err: any) {
      console.error('Instagram scan error:', err);
      toast.error(err.message || 'Failed to scan Instagram profile');
      setIsScanning(false);
      setScanProgress(0);
      setScanStatus("");
    }
  };

  const handleSocialScan = async () => {
    if (!socialHandle.trim()) return;

    // Use real API for Instagram
    if (selectedMethod === "instagram") {
      return handleInstagramScan();
    }
    
    // Fallback for other platforms (simulated for now)
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus("Extracting data...");
    
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    setTimeout(async () => {
      clearInterval(interval);
      setScanProgress(100);
      
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
    }, 2500);
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
      case "instagram": return "@username";
      case "linkedin": return "linkedin.com/in/username";
      case "tiktok": return "@username";
      case "twitter": return "@username";
      default: return "@username";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={() => handleOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-center text-foreground">
            {selectedMethod === null && "Add Contact"}
            {selectedMethod === "manual" && "Add Manually"}
            {selectedMethod && selectedMethod !== "manual" && `Scan ${getSocialLabel()}`}
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

            {selectedMethod && selectedMethod !== "manual" && (
              <motion.div
                key="social-scan"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
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
                    disabled={isScanning}
                    autoFocus
                  />
                </div>

                {/* Progress bar - always visible when scanning */}
                {isScanning && (
                  <div className="space-y-2">
                    <Progress 
                      value={Math.min(scanProgress, 100)} 
                      className="h-2"
                    />
                    <p className="text-sm text-center text-muted-foreground">
                      {scanStatus || "Extracting data..."}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-muted/30 border-border/50"
                    onClick={handleBack}
                    disabled={isScanning}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSocialScan}
                    className="flex-1 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90"
                    disabled={!socialHandle.trim() || isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      "Scan"
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Section - Import file & Stats */}
          <div className="mt-6 space-y-4">
            <Separator className="bg-border/50" />
            
            <button className="flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="w-4 h-4" />
              Import file
            </button>

            <Separator className="bg-border/50" />

            {/* Stats */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Credits</span>
                <span className="text-foreground font-medium">29.15</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contacts</span>
                  <span className="text-foreground font-medium">2 / 500</span>
                </div>
                <Progress value={0.4} className="h-1.5 bg-muted/50" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deals</span>
                  <span className="text-foreground font-medium">1 / 500</span>
                </div>
                <Progress value={0.2} className="h-1.5 bg-muted/50" />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
