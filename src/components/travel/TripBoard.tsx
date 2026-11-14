import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { jpegStorageName } from "@/lib/heicImage";
import { safeWebLink } from "@/lib/tripMoney";
import { tripRange } from "@/lib/tripDates";
import { checklist, clock, itineraryDays, tripDays, type BoardItem, type BoardKind } from "@/lib/tripBoard";

type Tab = "plan" | "photos" | "packing" | "shopping";
const TABS: [Tab, string][] = [["plan", "Itinerary"], ["photos", "Inspiration"], ["packing", "Packing"], ["shopping", "Shopping"]];

/** The trip's shared plan: itinerary, inspiration photos, and packing/shopping lists. Travelers only. */
export function TripBoard({ trip, organizer, closed }: { trip: { id: string; starts_on: string; ends_on: string }; organizer: boolean; closed: boolean }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [tab, setTab] = useState<Tab>("plan");
  const key = ["trip-board", trip.id];
  const board = useQuery({
    queryKey: key,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("creative_trip_board").select("*").eq("trip_id", trip.id).order("created_at");
      if (error) throw error;
      return data as BoardItem[];
    },
  });
  const refresh = () => cache.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: async (row: { kind: BoardKind; title: string; detail?: string; day?: string | null; at_time?: string | null; image_url?: string | null }) => {
      const { error } = await supabase.from("creative_trip_board").insert({ trip_id: trip.id, ...row });
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (item: BoardItem) => {
      const { error } = await supabase.from("creative_trip_board").update({ done: !item.done }).eq("id", item.id);
      if (error) throw error;
    },
    onMutate: async (item) => {
      cache.setQueryData<BoardItem[]>(key, (rows) => rows?.map((r) => (r.id === item.id ? { ...r, done: !r.done } : r)));
    },
    onSettled: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creative_trip_board").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const [uploading, setUploading] = useState(false);
  const uploadPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = jpegStorageName(`${user.id}/trip-board/${trip.id}/${crypto.randomUUID()}.${ext}`, file.type);
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) throw error;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      await add.mutateAsync({ kind: "photo", title: file.name.replace(/\.[^.]+$/, "").slice(0, 140) || "Inspiration", image_url: url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that photo");
    } finally {
      setUploading(false);
    }
  };

  if (board.isError) return null; // Board not available yet (before its migration): the rest of the trip still works.
  const items = board.data || [];
  const mine = (item: BoardItem) => organizer || item.created_by === user?.id;
  const removeButton = (item: BoardItem) =>
    !closed && mine(item) ? (
      <button type="button" aria-label={`Remove ${item.title}`} className="min-h-11 min-w-11 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => remove.mutate(item.id)}>
        <Trash2 size={16} className="mx-auto" />
      </button>
    ) : null;

  return (
    <section className="file-panel space-y-4 p-5" aria-label="Trip board">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">Trip board</h3>
        <p className="text-xs text-muted-foreground">Only travelers on this trip see it.</p>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${tab === id ? "bg-[#faf4ed] text-[#1d1a22]" : "bg-white/5"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "plan" && (
        <div className="space-y-4">
          {itineraryDays(items).map(({ day, stops }) => (
            <div key={day || "undated"}>
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{day ? tripRange(day, day) : "Anytime"}</p>
              <ul className="divide-y divide-border/30">
                {stops.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 py-2">
                    <span className="w-16 shrink-0 pt-0.5 text-xs text-muted-foreground">{clock(s.at_time)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{s.title}</span>
                      {s.detail && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {s.detail}</span>}
                    </span>
                    {removeButton(s)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!items.some((i) => i.kind === "stop") && <p className="text-sm text-muted-foreground">No stops yet. Add the first shoot, meal or meetup.</p>}
          {!closed && (
            <form
              className="grid grid-cols-2 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                const title = String(data.get("title") || "").trim();
                if (!title) return;
                add.mutate(
                  { kind: "stop", title, detail: String(data.get("place") || "").trim(), day: String(data.get("day") || "") || null, at_time: String(data.get("time") || "") || null },
                  { onSuccess: () => form.reset() }
                );
              }}
            >
              <Input name="title" aria-label="What" placeholder="What (e.g. Rooftop shoot)" maxLength={140} className="col-span-2" required />
              <select name="day" aria-label="Day" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Any day</option>
                {tripDays(trip.starts_on, trip.ends_on).map((d) => (
                  <option key={d} value={d}>{tripRange(d, d)}</option>
                ))}
              </select>
              <Input name="time" type="time" aria-label="Time" />
              <Input name="place" aria-label="Where" placeholder="Where (optional)" maxLength={500} className="col-span-2" />
              <Button type="submit" className="col-span-2" disabled={add.isPending}>Add to itinerary</Button>
            </form>
          )}
        </div>
      )}

      {tab === "photos" && (
        <div className="space-y-3">
          <ul className="grid grid-cols-3 gap-2">
            {items.filter((i) => i.kind === "photo").map((p) => {
              const src = safeWebLink(p.image_url);
              return (
                <li key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-white/5">
                  {src && <img src={src} alt={p.title} loading="lazy" className="h-full w-full object-cover" />}
                  {!closed && mine(p) && (
                    <button type="button" aria-label={`Remove ${p.title}`} onClick={() => remove.mutate(p.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5">
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {!items.some((i) => i.kind === "photo") && <p className="text-sm text-muted-foreground">Pin looks, locations and references for the shoot.</p>}
          {!closed && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 text-sm">
              <ImagePlus size={16} /> {uploading ? "Adding…" : "Add inspiration photo"}
              <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadPhoto(f); }} />
            </label>
          )}
        </div>
      )}

      {(tab === "packing" || tab === "shopping") && (
        <div className="space-y-3">
          <ul className="divide-y divide-border/30">
            {checklist(items, tab).map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={i.done} disabled={closed} onChange={() => toggle.mutate(i)} className="h-5 w-5 accent-[#ff9fc8]" />
                  <span className={i.done ? "text-muted-foreground line-through" : ""}>{i.title}</span>
                </label>
                {removeButton(i)}
              </li>
            ))}
          </ul>
          {!checklist(items, tab).length && <p className="text-sm text-muted-foreground">{tab === "packing" ? "Gear, chargers, permits…" : "Snacks, props, film…"}</p>}
          {!closed && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const title = String(new FormData(form).get("item") || "").trim();
                if (title) add.mutate({ kind: tab, title }, { onSuccess: () => form.reset() });
              }}
            >
              <Input name="item" aria-label={`Add to ${tab} list`} placeholder={tab === "packing" ? "Add something to pack" : "Add something to buy"} maxLength={140} />
              <Button type="submit" disabled={add.isPending}>Add</Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
