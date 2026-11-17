import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { PageMeta } from "@/components/seo/PageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc } from "@/lib/rpc";

type WelcomeStatus = { needs_setup: boolean; card_registered: boolean };

/** One clear greeting, then card registration. No extra marketing copy. */
export default function WelcomeFamilcy() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    callRpc<WelcomeStatus>("get_my_familcy_welcome_status")
      .then((value) => {
        if (cancelled) return;
        if (!value?.needs_setup) {
          navigate("/explore?section=people", { replace: true });
        } else {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [user?.id, navigate]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 pb-12 text-center">
      <PageMeta title="Welcome to the Familcy · ETHER" description="Create your ETHER Card." />
      <EtherWordmark className="mb-12 w-[11rem] max-w-full" />
      <h1 className="ether-title max-w-sm text-4xl text-foreground">Welcome to the Familcy</h1>
      {status === "loading" && <p role="status" className="mt-10 text-sm text-muted-foreground">Loading your membership…</p>}
      {status === "error" && (
        <div className="mt-10 space-y-3">
          <p role="alert" className="text-sm text-muted-foreground">We could not verify your welcome status. Please reload the page.</p>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      )}
      {status === "ready" && (
        <Button
          type="button"
          className="mt-12 min-h-12 w-full max-w-xs"
          onClick={() => navigate("/id?setup=1")}
        >
          Register your ETHER Card
        </Button>
      )}
    </main>
  );
}
