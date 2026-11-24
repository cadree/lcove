import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { discovery } from "@/lib/creativeDiscovery";

/** Where my asks to join trips stand. Fails quietly before the join-requests migration. */
export function useMyTripRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-trip-requests", user?.id],
    queryFn: () => discovery.tripRequests(null),
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });
}
