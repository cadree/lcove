import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { callRpc } from "@/lib/rpc";
import { useIsAdmin } from "@/hooks/useAdmin";
import {
  chunk,
  mergeResults,
  resolveFilters,
  type BulkAction,
  type BulkResult,
  type MemberFilters,
  type MemberPage,
  type MemberSort,
  type SortDir,
} from "@/lib/adminMembers";

export const ADMIN_MEMBERS_KEY = "admin-members";

export interface MemberPageArgs {
  filters: MemberFilters;
  sort: MemberSort;
  dir: SortDir;
  page: number;
  pageSize: number;
}

/** One page of members from the server. Only this page is loaded, never the whole list. */
export function useAdminMemberPage(args: MemberPageArgs) {
  const { isAdmin } = useIsAdmin();
  const filters = resolveFilters(args.filters);
  return useQuery({
    queryKey: [ADMIN_MEMBERS_KEY, "page", filters, args.sort, args.dir, args.page, args.pageSize],
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MemberPage> => {
      const data = await callRpc<MemberPage>("admin_list_members", {
        p_filters: filters,
        p_sort: args.sort,
        p_dir: args.dir,
        p_limit: args.pageSize,
        p_offset: args.page * args.pageSize,
      });
      return {
        total: Number(data?.total ?? 0),
        rows: (data?.rows ?? []).map((row) => ({ ...row, credit_balance: Number(row.credit_balance ?? 0) })),
      };
    },
  });
}

export interface MemberDetail {
  skills: string[];
  passions: string[];
  creative_roles: string[];
  social_links: Record<string, string | undefined> | null;
  bio: string | null;
}

export function useAdminMemberDetail(userId: string | null) {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: [ADMIN_MEMBERS_KEY, "detail", userId],
    enabled: isAdmin && !!userId,
    queryFn: () => callRpc<MemberDetail>("admin_member_detail", { p_user_id: userId }),
  });
}

/** Every id that matches the filter (server caps it), for "select all that match". */
export function fetchMatchingMemberIds(filters: MemberFilters): Promise<string[]> {
  return callRpc<string[]>("admin_member_ids", { p_filters: resolveFilters(filters), p_cap: 5000 }).then(
    (ids) => ids ?? [],
  );
}

/** Run one bulk action over any number of people, 500 per server call. */
export async function runBulkAction(
  action: BulkAction,
  userIds: string[],
  options: { reason?: string; payload?: Record<string, unknown>; onProgress?: (done: number) => void } = {},
): Promise<BulkResult> {
  const parts: BulkResult[] = [];
  let processed = 0;
  for (const ids of chunk(userIds)) {
    try {
      parts.push(
        await callRpc<BulkResult>("admin_bulk_member_action", {
          p_user_ids: ids,
          p_action: action,
          p_reason: options.reason ?? null,
          p_payload: options.payload ?? {},
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parts.push({
        action,
        requested: ids.length,
        succeeded: 0,
        failed: ids.length,
        errors: ids.map((user_id) => ({ user_id, error: message })),
        done: [],
        before: [],
      });
    }
    processed += ids.length;
    options.onProgress?.(processed);
  }
  return mergeResults(action, parts);
}

/** Everything that shows members on the admin page, refreshed together. */
export function useRefreshAdminMembers() {
  const client = useQueryClient();
  return useCallback(() => {
    for (const key of [ADMIN_MEMBERS_KEY, "admin-user-data", "admin-users", "admin-actions", "admin-dashboard-stats", "people-members"]) {
      client.invalidateQueries({ queryKey: [key] });
    }
  }, [client]);
}

/** Drop people from every cached page right away, before the server refetch lands. */
export function useHideMembersLocally() {
  const client = useQueryClient();
  return useCallback(
    (ids: string[]) => {
      const gone = new Set(ids);
      client.setQueriesData<MemberPage>({ queryKey: [ADMIN_MEMBERS_KEY, "page"] }, (page) =>
        page
          ? {
              total: Math.max(0, page.total - page.rows.filter((row) => gone.has(row.user_id)).length),
              rows: page.rows.filter((row) => !gone.has(row.user_id)),
            }
          : page,
      );
    },
    [client],
  );
}
