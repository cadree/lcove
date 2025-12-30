import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Instagram, 
  Loader2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ContactMethod = "manual" | "instagram" | null;

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
  instagramHandle?: string;
  instagramUrl?: string;
}

const methodOptions = [
  { id: "manual" as const, label: "Manual", icon: User, color: "bg-violet-500" },
  { id: "instagram" as const, label: "Instagram", icon: Instagram, color: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500" },
];

export function AddContactDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading
}: AddContactDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod>(null);
  
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
    
    await onSubmit({
      name: displayName,
      socialHandle: `@${cleanHandle}`,
      source: "instagram",
      instagramHandle: cleanHandle,
      instagramUrl: `https://instagram.com/${cleanHandle}`
    });
    
    resetForm();
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
                <div className="grid grid-cols-2 gap-3 mb-6">
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
                  <p className="text-xs text-muted-foreground">
                    Enter the Instagram handle to add this contact
                  </p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddContactDialog;
