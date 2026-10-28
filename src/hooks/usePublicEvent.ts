import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { eventPublicPath } from "../../functions/_shared/eventShare.js";
import { loadPublicEvent, type PublicEventRecord } from "@/lib/loadPublicEvent";

export function useCanonicalEventPath(event: PublicEventRecord | null | undefined) {
  const location = useLocation();
  const navigate = useNavigate();
  const id = event?.id;
  const slug = event?.slug;
  const isPublic = event?.is_public;
  const status = event?.status;
  useEffect(() => {
    if (!id) return;
    const base = eventPublicPath({ id, slug, is_public: isPublic, status });
    const suffix = location.pathname.replace(/^\/(?:event|e)\/[^/]+/, "");
    const next = `${base}${suffix}`;
    if (location.pathname !== next) {
      navigate(`${next}${location.search}${location.hash}`, { replace: true });
    }
  }, [id, slug, isPublic, status, location.pathname, location.search, location.hash, navigate]);
}

export function usePublicEvent(ref: string) {
  const query = useQuery({
    queryKey: ["public-event", ref],
    enabled: Boolean(ref),
    queryFn: () => loadPublicEvent(ref),
  });
  useCanonicalEventPath(query.data);
  return query;
}
