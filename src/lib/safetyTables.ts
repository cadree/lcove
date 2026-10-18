import { supabase } from "@/integrations/supabase/client";
import type { ReportTargetType } from "@/lib/reportReasons";

// content_reports is created in a migration that is newer than
// src/integrations/supabase/types.ts. Regenerate that file with
// `supabase gen types` (see README) instead of editing it by hand.

export interface ContentReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface ContentReportInsert {
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: "open";
}

export interface ContentReportUpdate {
  status: "actioned" | "dismissed";
  reviewed_by: string;
  reviewed_at: string;
  updated_at: string;
}

interface QueryError {
  message: string;
  code?: string;
}

interface ContentReportQuery {
  select: (columns: string) => {
    order: (
      column: string,
      options: { ascending: boolean },
    ) => Promise<{ data: ContentReportRow[] | null; error: QueryError | null }>;
  };
  insert: (
    row: ContentReportInsert,
  ) => Promise<{ data: ContentReportRow | null; error: QueryError | null }>;
  update: (row: ContentReportUpdate) => {
    eq: (
      column: "id",
      value: string,
    ) => Promise<{ data: ContentReportRow | null; error: QueryError | null }>;
  };
}

export function fromUntyped(table: "content_reports"): ContentReportQuery {
  const client = supabase as unknown as {
    from: (name: "content_reports") => ContentReportQuery;
  };
  return client.from(table);
}
