import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setMessage("Missing unsubscribe token.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json();
        if (res.ok && data.valid) setStatus("valid");
        else if (data?.reason === "already_unsubscribed") setStatus("already");
        else {
          setStatus("invalid");
          setMessage(data?.error || "This unsubscribe link is invalid or expired.");
        }
      } catch {
        setStatus("error");
        setMessage("Could not reach the server. Please try again.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) setStatus("done");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else {
        setStatus("error");
        setMessage(data?.error || "Could not process your request.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 text-center space-y-5">
        <h1 className="text-2xl font-semibold">Unsubscribe</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Checking your link…</p>
          </div>
        )}

        {status === "valid" && (
          <>
            <p className="text-muted-foreground">
              Click below to unsubscribe from these emails. You can always re-subscribe later by contacting us.
            </p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}

        {status === "submitting" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Processing…</p>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p>You've been unsubscribed. Sorry to see you go.</p>
          </div>
        )}

        {status === "already" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p>You're already unsubscribed. No further action needed.</p>
          </div>
        )}

        {(status === "invalid" || status === "error") && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p>{message}</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Unsubscribe;
