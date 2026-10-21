import { supabase } from "@/integrations/supabase/client";

// content_reports, stream_chat, and content_likes are created in migrations
// that are newer than src/integrations/supabase/types.ts. Regenerate that
// file with `supabase gen types` instead of editing it by hand.

interface QueryError {
  message: string;
  code?: string;
}

interface QueryResult<T = unknown> {
  data: T | null;
  error: QueryError | null;
  count?: number | null;
}

interface FilterChain<T = unknown> extends PromiseLike<QueryResult<T>> {
  eq: (column: string, value: unknown) => FilterChain<T>;
  order: (column: string, options?: { ascending: boolean }) => FilterChain<T>;
  limit: (count: number) => FilterChain<T>;
  maybeSingle: () => PromiseLike<QueryResult<T>>;
}

interface UntypedTable {
  select: (
    columns: string,
    options?: { count?: "exact"; head?: boolean },
  ) => FilterChain;
  insert: (row: object) => FilterChain;
  update: (row: object) => FilterChain;
  delete: () => FilterChain;
}

export function fromUntyped(
  table: "content_reports" | "stream_chat" | "content_likes" | "profile_films",
): UntypedTable {
  const client = supabase as unknown as {
    from: (name: typeof table) => UntypedTable;
  };
  return client.from(table);
}
