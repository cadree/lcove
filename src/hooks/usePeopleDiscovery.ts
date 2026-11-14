import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { discovery } from "@/lib/creativeDiscovery";
import { buildPeople, type Member } from "@/lib/peopleDiscovery";
import { abortAfter } from "@/lib/requestDeadline";

interface PassionRow {
  user_id: string;
  custom_name: string | null;
  passions: { name: string } | { name: string }[] | null;
}

/** Every onboarded member with their skills and passions, as the old directory loaded them. */
export async function fetchMembers(): Promise<Member[]> {
  const signal = abortAfter();
  const [profiles, passions, skills] = await Promise.all([
    supabase
      .from("profiles_public")
      .select("user_id, display_name, avatar_url, city, city_display, city_key, bio, created_at")
      .eq("onboarding_completed", true)
      .order("created_at", { ascending: false })
      .abortSignal(signal),
    supabase.from("user_passions").select("user_id, custom_name, passions(name)").abortSignal(signal),
    supabase.from("user_skills").select("user_id, skills(name)").abortSignal(signal),
  ]);
  if (profiles.error) throw profiles.error;
  const add = (map: Map<string, string[]>, id: string, name: string | null | undefined) => {
    const value = name?.trim();
    if (!value) return;
    const list = map.get(id) || [];
    if (!list.includes(value)) list.push(value);
    map.set(id, list);
  };
  const passionsBy = new Map<string, string[]>();
  for (const row of (passions.data || []) as PassionRow[]) {
    const related = Array.isArray(row.passions) ? row.passions[0] : row.passions;
    add(passionsBy, row.user_id, row.custom_name || related?.name);
  }
  const skillsBy = new Map<string, string[]>();
  for (const row of (skills.data || []) as { user_id: string; skills: { name: string } | null }[])
    add(skillsBy, row.user_id, row.skills?.name);
  return (profiles.data || []).map((p) => ({
    ...p,
    skills: skillsBy.get(p.user_id) || [],
    passions: passionsBy.get(p.user_id) || [],
  })) as Member[];
}

/** One source for the globe, the swipe deck and the member list. */
export function usePeopleDiscovery() {
  const { user } = useAuth();
  const { blockedIds } = useUserBlocks();
  const members = useQuery({
    queryKey: ["people-members"],
    queryFn: fetchMembers,
    enabled: !!user,
    staleTime: 60_000,
  });
  const signals = useQuery({
    queryKey: ["discovery-globe", user?.id],
    queryFn: discovery.globe,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const settings = useQuery({
    queryKey: ["discovery-settings", user?.id],
    queryFn: () => discovery.settings(),
    enabled: !!user,
  });
  const people = useMemo(
    () => buildPeople(members.data || [], signals.data, blockedIds),
    [members.data, signals.data, blockedIds],
  );
  return { user, people, members, signals, settings };
}
