import { supabase } from "@/integrations/supabase/client";

/** Call an RPC that is not yet in the generated Functions map. */
export async function callRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = supabase as unknown as {
    rpc: (
      fn: string,
      params?: Record<string, unknown>,
    ) => Promise<{ data: T | null; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
