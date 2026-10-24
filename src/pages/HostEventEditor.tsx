import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreateEventChoice } from "@/components/events/host/CreateEventChoice";
import { EventFormScreen, type EventFormValues } from "@/components/events/host/EventFormScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { validateEventDraft } from "@/lib/guestEvent";
import { zonedParts, zonedWallTimeToUtc } from "@/lib/eventTime";
import { errorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function blankForm(mode: "tickets" | "rsvp"): EventFormValues {
  return {
    title: "",
    start: "",
    end: "",
    venue: "",
    summary: "",
    address: "",
    price: mode === "tickets" ? "20" : "",
    capacity: "",
    mode,
    hideAddress: false,
    showOnExplore: true,
    passwordProtected: false,
    password: "",
    requireApproval: false,
    allowTransfers: false,
    absorbFees: false,
    repeats: "none",
    fontId: "cinzel",
    theme: "dark",
    videoUrl: "",
    features: "",
    city: "",
    timezone: browserZone(),
  };
}

function isoToInput(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const parts = zonedParts(iso, timeZone);
  const pad = (value: number) => String(value === 24 ? 0 : value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function inputToIso(value: string, timeZone: string) {
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  return zonedWallTimeToUtc(date, time.slice(0, 5), timeZone || "UTC");
}

function missingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column|schema cache/i.test(error.message || "");
}

export default function HostEventEditor() {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editing = Boolean(eventId);
  const orgParam = params.get("org");
  const organizationId = orgParam && /^[0-9a-f-]{36}$/i.test(orgParam) ? orgParam : null;

  const [step, setStep] = useState<"choice" | "form">(editing ? "form" : "choice");
  const [values, setValues] = useState<EventFormValues>(() => blankForm("tickets"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hadPassword, setHadPassword] = useState(false);
  const [tierId, setTierId] = useState<string | null>(null);

  const { data: loaded, isLoading } = useQuery({
    queryKey: ["host-event-edit", eventId],
    enabled: editing && !!user,
    queryFn: async () => {
      const { data: event, error } = await supabase.from("events").select("*").eq("id", eventId!).maybeSingle();
      if (error) throw error;
      if (!event || event.creator_id !== user!.id) return null;
      const { data: tier } = await supabase.from("ticket_tiers").select("id, name, price_cents").eq("event_id", event.id).order("sort_order").limit(1).maybeSingle();
      const { data: attendees } = await supabase.from("event_attendees").select("attendee_name").eq("event_id", event.id).in("status", ["registered", "approved"]).limit(8);
      const names = (attendees || []).map((row) => row.attendee_name).filter((name): name is string => !!name);
      const { count } = await supabase.from("event_attendees").select("id", { count: "exact", head: true }).eq("event_id", event.id).in("status", ["registered", "approved"]);
      const { data: privateAddress } = await supabase.rpc("host_event_address", { p_event_id: event.id });
      return { event, tier, names, going: count || names.length, privateAddress: privateAddress || "" };
    },
  });

  useEffect(() => {
    if (!loaded?.event) return;
    const event = loaded.event;
    const zone = event.timezone || browserZone();
    const paid = (loaded.tier?.price_cents || 0) > 0 || event.ticket_type === "paid";
    setValues({
      title: event.title,
      start: isoToInput(event.start_date, zone),
      end: isoToInput(event.end_date, zone),
      venue: event.venue || "",
      summary: event.description || "",
      address: loaded.privateAddress || event.address || "",
      price: paid ? String(((loaded.tier?.price_cents || Math.round((event.ticket_price || 0) * 100)) / 100)) : "",
      capacity: event.capacity ? String(event.capacity) : "",
      mode: paid ? "tickets" : "rsvp",
      hideAddress: event.hide_address === true,
      showOnExplore: event.is_public !== false,
      passwordProtected: event.password_protected === true,
      password: "",
      requireApproval: event.requires_approval === true,
      allowTransfers: event.allow_transfers === true,
      absorbFees: event.absorb_fees === true,
      repeats: event.recurrence || "none",
      fontId: event.flyer_font || "cinzel",
      theme: event.page_theme === "light" ? "light" : "dark",
      videoUrl: event.video_url || "",
      features: (event.features || []).join(", "),
      city: event.city === "TBA" ? "" : event.city,
      timezone: zone,
    });
    setFlyerUrl(event.image_url);
    setHadPassword(event.password_protected === true);
    setTierId(loaded.tier?.id || null);
    setStep("form");
  }, [loaded]);

  if (!user) {
    navigate(`/auth?redirect=${editing ? `/dashboard/events/${eventId}/edit` : "/dashboard/events/new"}`);
    return null;
  }

  const onFlyer = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      toast.error("Use an image under 10MB.");
      return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/event-images/event-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      toast.error(errorMessage(error, "Flyer upload failed"));
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setFlyerUrl(data.publicUrl);
  };

  const save = async () => {
    const next = validateEventDraft(values);
    if (values.passwordProtected && !values.password.trim() && !hadPassword) {
      next.password = "Add a password, or turn protection off.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const start = inputToIso(values.start, values.timezone);
    const end = inputToIso(values.end, values.timezone);
    if (!start || !end) {
      setErrors({ start: "Add a start time.", end: "Add an end time." });
      return;
    }

    const price = Number(values.price || 0);
    const paid = values.mode === "tickets" && price > 0;
    const capacity = values.capacity.trim() ? Number(values.capacity) : null;
    const features = values.features.split(",").map((item) => item.trim()).filter(Boolean);
    const row = {
      title: values.title.trim(),
      description: values.summary.trim() || null,
      venue: values.venue.trim(),
      address: values.hideAddress ? null : values.address.trim() || null,
      city: values.city.trim() || "TBA",
      start_date: start,
      end_date: end,
      timezone: values.timezone || "UTC",
      recurrence: values.repeats === "none" ? null : values.repeats,
      image_url: flyerUrl,
      ticket_type: paid ? "paid" : "free",
      ticket_price: paid ? price : null,
      capacity,
      is_public: values.showOnExplore,
      status: "published",
      event_type: paid ? "paid_ticket" : "free_rsvp",
      requires_approval: values.requireApproval,
      video_url: values.videoUrl.trim() || null,
      flyer_font: values.fontId,
      page_theme: values.theme,
      hide_address: values.hideAddress,
      absorb_fees: values.absorbFees,
      allow_transfers: values.allowTransfers,
      password_protected: values.passwordProtected,
      features,
    };

    setSaving(true);
    try {
      let id = eventId || "";
      if (editing) {
        const { error } = await supabase.from("events").update(row).eq("id", eventId!).eq("creator_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert({
          ...row,
          creator_id: user.id,
          organization_id: organizationId,
          published_at: new Date().toISOString(),
        }).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      const { error: accessError } = await supabase.rpc("set_event_access", {
        p_event_id: id,
        p_hide_address: values.hideAddress,
        p_private_address: values.address.trim(),
        p_password: values.password,
        p_password_protected: values.passwordProtected,
      });
      if (accessError) {
        toast.message("Event saved. Address privacy needs the hosting migration before it can hide the street.");
      }

      const tier = {
        event_id: id,
        name: paid ? "General Admission" : "RSVP",
        price_cents: paid ? Math.round(price * 100) : 0,
        capacity,
        is_active: true,
        sort_order: 0,
      };
      if (tierId) {
        await supabase.from("ticket_tiers").update(tier).eq("id", tierId);
      } else {
        await supabase.from("ticket_tiers").insert(tier);
      }

      toast.success(editing ? "Event updated." : "Event saved.");
      navigate(`/dashboard/events/${id}`);
    } catch (error) {
      const detail = error as { code?: string; message?: string };
      if (missingColumn(detail)) {
        toast.error("Hosting fields are not on this database yet. Apply the event hosting migration, then save again.");
      } else {
        toast.error(errorMessage(error, "Could not save the event"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (editing && isLoading) return <div className="min-h-screen bg-background" />;
  if (editing && !isLoading && loaded === null) {
    return <div className="min-h-screen bg-background px-6 py-16 text-center">You can only edit events you host.</div>;
  }

  if (step === "choice") {
    return (
      <CreateEventChoice onChoose={(mode) => {
        setValues(blankForm(mode));
        setStep("form");
      }} />
    );
  }

  return (
    <EventFormScreen
      values={values}
      errors={errors}
      guestNames={loaded?.names || []}
      going={loaded?.going || 0}
      saving={saving}
      flyerUrl={flyerUrl}
      onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      onFlyer={onFlyer}
      onBack={() => (editing ? navigate(`/dashboard/events/${eventId}`) : setStep("choice"))}
      onSave={save}
    />
  );
}
