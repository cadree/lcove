import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PRESET_AMOUNTS = [5, 10, 25, 50];

export function DonateDialog({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"one_time" | "recurring">("one_time");
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveAmount = isCustom ? Number(customAmount) : amount;

  const handleDonate = async () => {
    if (!effectiveAmount || effectiveAmount < 1) {
      toast.error("Minimum donation is $1");
      return;
    }

    setLoading(true);
    try {
      // Build headers – include auth if logged in
      const headers: Record<string, string> = {};
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const { data, error } = await supabase.functions.invoke("create-fund-donation", {
        body: { amount: effectiveAmount, mode },
        headers,
      });

      if (error) throw error;
      if (data?.url) {
        const win = window.open(data.url, "_blank");
        if (!win || win.closed) {
          try {
            window.location.href = data.url;
          } catch {
            toast.info("Click to complete your donation", {
              duration: 15000,
              action: { label: "Open Checkout", onClick: () => window.open(data.url, "_blank") },
            });
          }
        }
        setOpen(false);
      }
    } catch (err) {
      console.error("Donation error:", err);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Heart className="w-5 h-5 text-primary" />
            Support the Community Fund
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Payment type */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "one_time" | "recurring")}>
            <TabsList className="w-full">
              <TabsTrigger value="one_time" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                One-Time
              </TabsTrigger>
              <TabsTrigger value="recurring" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Monthly
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Preset amounts */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Choose an amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={!isCustom && amount === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setAmount(preset); setIsCustom(false); }}
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Or enter a custom amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min={1}
                placeholder="Custom amount"
                className="pl-7"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setIsCustom(true); }}
                onFocus={() => setIsCustom(true)}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {mode === "recurring" ? "Monthly donation" : "One-time donation"}
            </p>
            <p className="text-3xl font-bold text-foreground mt-1">
              ${effectiveAmount || 0}
              {mode === "recurring" && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
            </p>
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground text-center">
              No account needed — you'll enter your email at checkout.
            </p>
          )}

          <Button className="w-full group" size="lg" onClick={handleDonate} disabled={loading || !effectiveAmount || effectiveAmount < 1}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Heart className="w-4 h-4 mr-2" />
            )}
            {loading ? "Redirecting..." : "Donate Now"}
            {!loading && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
