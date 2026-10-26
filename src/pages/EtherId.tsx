import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EtherIdFace, monthName } from "@/components/profile/EtherIdFace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { shotSessionEnabled } from "@/lib/shotSession";
import {
  MEMBER_OF_HINT,
  MEMBER_OF_LIMIT,
  birthdayError,
  memberOfError,
  normalizeMemberOf,
  normalizeUsername,
  usernameError,
  verifyUrl,
  walletButtonVisible,
  type EtherIdCard,
} from "@/lib/etherId";
import { toast } from "sonner";

const SHOT_CARD: EtherIdCard = {
  display_name: "Cadre Wallace",
  username: "cadre",
  avatar_url: "/ether-id/shot-avatar.svg",
  status: "Active",
  member_since: "2026-10-01",
  member_since_label: "October 2026",
  passion: "Creative Director",
  peer_review_average: 4.5,
  peer_review_count: 2,
  peer_review_label: "4.5 average · 2 reviews",
  projects_completed: 2,
  projects_label: "2 completed",
  birthday_label: "March 4",
  birthday_note: "self-reported",
  show_birthday: true,
  birthday_month: 3,
  birthday_day: 4,
  member_of: null,
  city: "Los Angeles",
  token: "eid1.shot.1.signature",
  verify_path: "/id/v/shot-active",
};

async function loadCard(): Promise<EtherIdCard | null> {
  if (shotSessionEnabled()) return SHOT_CARD;
  const { data, error } = await supabase.rpc("get_my_ether_id");
  if (error) throw error;
  return (data as unknown as EtherIdCard | null) ?? null;
}

export default function EtherId() {
  const { session } = useAuth();
  useEffect(() => {
    document.body.classList.add("ether-id-page");
    return () => document.body.classList.remove("ether-id-page");
  }, []);
  const queryClient = useQueryClient();
  const shot = shotSessionEnabled();
  const cardQuery = useQuery({ queryKey: ["ether-id"], queryFn: loadCard });
  const walletQuery = useQuery({
    queryKey: ["ether-id-wallet"],
    enabled: !shot,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ether-id-pass", {
        body: { action: "status" },
      });
      if (error) return { configured: false };
      return { configured: Boolean((data as { configured?: boolean } | null)?.configured) };
    },
  });
  const card = cardQuery.data;
  const [username, setUsername] = useState<string | null>(null);
  const [memberOf, setMemberOf] = useState<string | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [showBirthday, setShowBirthday] = useState<boolean | null>(null);
  const usernameValue = username ?? card?.username ?? "";
  const memberOfValue = memberOf ?? card?.member_of ?? "";
  const monthValue = month ?? card?.birthday_month ?? null;
  const dayValue = day ?? card?.birthday_day ?? null;
  const showValue = showBirthday ?? card?.show_birthday ?? false;

  const save = useMutation({
    mutationFn: async () => {
      const nameError = usernameError(usernameValue);
      const dateError = birthdayError(monthValue, dayValue);
      const ofError = memberOfError(memberOfValue);
      if (nameError || dateError || ofError) throw new Error(nameError || dateError || ofError || "Check the card");
      if (shot) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sign in to save your Ether ID");
      const { error } = await supabase
        .from("profiles")
        .update({
          username: normalizeUsername(usernameValue) || null,
          member_of: normalizeMemberOf(memberOfValue),
          birthday_month: monthValue,
          birthday_day: dayValue,
          show_birthday: Boolean(showValue && monthValue && dayValue),
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ether-id"] });
      toast.success("Ether ID updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not update Ether ID");
    },
  });

  const refresh = useMutation({
    mutationFn: async () => {
      if (shot) return;
      const { error } = await supabase.rpc("refresh_my_ether_id_token");
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ether-id"] });
      toast.success("Verification code refreshed");
    },
    onError: () => toast.error("Could not refresh the code"),
  });

  const addToWallet = async () => {
    if (!session?.access_token) {
      toast.error("Sign in to add this card to Apple Wallet");
      return;
    }
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ether-id-pass`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "download" }),
    });
    if (!response.ok) {
      toast.error("Could not build the Apple Wallet pass");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ether-id.pkpass";
    link.click();
    URL.revokeObjectURL(url);
  };

  const href = card ? verifyUrl(window.location.origin, card.verify_path) : "";
  const showWallet = walletButtonVisible(shot ? false : walletQuery.data?.configured);

  return (
    <PageLayout bleed>
      <div className="px-6 pb-24 pt-6">
        <PageHeader
          eyebrow="Member"
          title="Ether ID"
          description="Your card. The verify page reads status live."
          showMore={false}
        />
        {cardQuery.isLoading && <p className="text-sm text-muted-foreground">Loading your card…</p>}
        {cardQuery.isError && <p className="text-sm text-destructive">Could not load your Ether ID.</p>}
        {card && (
          <>
            <div className="-mx-2">
              <EtherIdFace card={card} verifyHref={href} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                Refresh code
              </Button>
              {showWallet && (
                <Button type="button" className="min-h-11" onClick={() => void addToWallet()}>
                  Add to Apple Wallet
                </Button>
              )}
            </div>

            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ether-username">Username</Label>
                <Input
                  id="ether-username"
                  value={usernameValue}
                  onChange={(event) => setUsername(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="name"
                  className="min-h-11"
                />
                <p className="text-sm text-muted-foreground">Shown as @{normalizeUsername(usernameValue) || "username"}.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ether-member-of">Member of</Label>
                <Input
                  id="ether-member-of"
                  value={memberOfValue}
                  maxLength={MEMBER_OF_LIMIT}
                  onChange={(event) => setMemberOf(event.target.value)}
                  placeholder="LCOVE"
                  className="min-h-11"
                />
                <p className="text-sm text-muted-foreground">{MEMBER_OF_HINT}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ether-birthday-month">Birthday</Label>
                <div className="flex gap-2">
                  <select
                    id="ether-birthday-month"
                    className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    value={monthValue ?? ""}
                    onChange={(event) => setMonth(event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">Month</option>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>{monthName(index + 1)}</option>
                    ))}
                  </select>
                  <select
                    id="ether-birthday-day"
                    aria-label="Birthday day"
                    className="min-h-11 w-24 rounded-md border border-input bg-background px-3 text-sm"
                    value={dayValue ?? ""}
                    onChange={(event) => setDay(event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>{index + 1}</option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-muted-foreground">
                  Month and day only. Self-reported. This is not age verification.
                </p>
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <Label htmlFor="ether-show-birthday">Show on my Ether ID</Label>
                  <Switch
                    id="ether-show-birthday"
                    checked={showValue}
                    onCheckedChange={setShowBirthday}
                    disabled={monthValue == null || dayValue == null}
                  />
                </div>
              </div>
              <Button type="submit" className="min-h-11 w-full" disabled={save.isPending}>
                Save
              </Button>
            </form>
          </>
        )}
      </div>
    </PageLayout>
  );
}
