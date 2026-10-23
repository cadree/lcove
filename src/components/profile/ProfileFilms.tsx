import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { filmEmbedSrc, isDirectFilm } from "@/lib/filmEmbed";
import { fromUntyped } from "@/lib/safetyTables";

interface ProfileFilm {
  id: string;
  title: string;
  url: string;
}

function FilmFrame({ film }: { film: ProfileFilm }) {
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
  const [saving, setSaving] = useState(false);
  const films = useQuery({
    queryKey: ["profile-films", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await fromUntyped("profile_films")
        .select("id, title, url")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ProfileFilm[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile-films", ownerId] });

  const addFilm = async () => {
    if (!user || !title.trim() || !url.trim()) {
      toast.error("A film needs a title and a link");
      return;
    }
    setSaving(true);
    const { error } = await fromUntyped("profile_films").insert({
      owner_id: user.id,
      title: title.trim().slice(0, 180),
      url: url.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setUrl("");
    toast.success("Film added");
    refresh();
  };

  const rows = films.data ?? [];

  return (
    <section className="px-4 pt-4">
      <div className="file-panel px-4 py-4">
        <p className="mono-label text-[8px] text-muted-foreground">Films</p>
        <h2 className="ether-title text-[22px]">Links</h2>
        {films.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading films…</p>}
        {films.isError && <p className="mt-3 text-sm text-destructive">Film links could not load.</p>}
        {!films.isLoading && !films.isError && rows.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No film links yet.</p>
        )}
        <div className="mt-3 space-y-4">
          {rows.map((film) => (
            <article key={film.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="font-body font-extrabold">{film.title}</p>
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
              <FilmFrame film={film} />
            </article>
          ))}
        </div>
        {isOwner && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Film title" aria-label="Film title" />
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="YouTube, Vimeo, or video link" aria-label="Film link" />
            <Button type="button" onClick={addFilm} disabled={saving}>Add film</Button>
          </div>
        )}
      </div>
    </section>
  );
}
