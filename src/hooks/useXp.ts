import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { callRpc } from '@/lib/rpc';

/** The signed-in user's own XP. The RPC ignores every other user id. */
export function useMyXp() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-xp', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const data = await callRpc<{ total: number; level: number } | null>('my_xp');
      return {
        total: Number(data?.total ?? 0),
        level: Number(data?.level ?? 1),
      };
    },
  });
}
