import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc } from "@/lib/rpc";
import { filmEmbedSrc, isDirectFilm } from "@/lib/filmEmbed";
import { fromUntyped } from "@/lib/safetyTables";
import { isIosApp } from "@/lib/platform";

interface ProfileFilm {
  id: string;
  title: string;
  price_cents: number;
  locked: boolean;
  url: string | null;
}

function FilmFrame({ film }: { film: ProfileFilm }) {
  if (!film.url || film.locked) return null;
  const embed = filmEmbedSrc(film.url);
  if (embed) {
    return (
      <iframe
        title={film.title}
        src={embed}
        className="aspect-video w-full rounded-[14px]"
        allow="encrypted-media; fullscreen"
        allowFullScreen
      />
    );
  }
  if (isDirectFilm(film.url)) {
    return <video src={film.url} controls className="aspect-video w-full rounded-[14px] object-contain bg-black" />;
  }
  return (
    <a href={film.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
      Open {film.title}
    </a>
  );
}

export function ProfileFilms({ ownerId, isOwner }: { ownerId: string; isOwner: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const films = useQuery({
    queryKey: ["profile-films", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const rows = await callRpc<ProfileFilm[]>("list_profile_films", { p_owner: ownerId });
      return Array.isArray(rows) ? rows : [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile-films", ownerId] });

  const addFilm = async () => {
    if (!user || !title.trim() || !url.trim()) {
      toast.error("A film needs a title and a link");
      return;
    }
    const dollars = Number(price || 0);
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error("Price has to be a number");
      return;
    }
    setSaving(true);
    const { error } = await fromUntyped("profile_films").insert({
      owner_id: user.id,
      title: title.trim().slice(0, 180),
      url: url.trim(),
      price_cents: Math.round(dollars * 100),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setUrl("");
    setPrice("");
    toast.success("Film added");
    refresh();
  };

  const pay = async (filmId: string) => {
    if (isIosApp()) {
      toast.error("Paid films aren't available in the iOS app");
      return;
    }
    const { data, error } = await supabase.functions.invoke("create-film-checkout", { body: { filmId } });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.needs_connect) {
      toast.error(data.error || "This creator can't receive payouts yet");
      return;
    }
    if (data?.already) {
      toast.success("You already unlocked this film");
      refresh();
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    if (!data?.url) {
      toast.error("Stripe did not return a checkout link");
      return;
    }
    window.location.assign(data.url);
  };

  const rows = films.data ?? [];

  return (
    <section className="px-4 pt-4">
      <div className="file-panel px-4 py-4">
        <p className="mono-label text-[8px] text-muted-foreground">Films</p>
        <h2 className="ether-title text-[22px]">Links</h2>
        {films.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading films…</p>}
        {!films.isLoading && rows.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No film links yet.</p>
        )}
        <div className="mt-3 space-y-4">
          {rows.map((film) => (
            <article key={film.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-body font-extrabold">{film.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {film.price_cents > 0 ? `$${(film.price_cents / 100).toFixed(2)}` : "Free"}
                    {film.locked ? " · Locked" : ""}
                  </p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    className="mono-label inline-flex h-11 items-center text-[10px] text-muted-foreground"
                    onClick={async () => {
                      const { error } = await fromUntyped("profile_films").delete().eq("id", film.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Film removed");
                        refresh();
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {film.locked ? (
                <Button type="button" onClick={() => pay(film.id)} disabled={!user}>
                  {user ? "Unlock" : "Sign in to unlock"}
                </Button>
              ) : (
                <FilmFrame film={film} />
              )}
            </article>
          ))}
        </div>
        {isOwner && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Film title" aria-label="Film title" />
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="YouTube, Vimeo, or video link" aria-label="Film link" />
            <Input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price in USD, blank if free" inputMode="decimal" aria-label="Film price" />
            <Button type="button" onClick={addFilm} disabled={saving}>Add film</Button>
          </div>
        )}
      </div>
    </section>
  );
}
