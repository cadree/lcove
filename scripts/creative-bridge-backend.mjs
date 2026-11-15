// Fixture Supabase for the creative-bridge phone checks. Every REST and RPC
// request runs on a local PGlite (creative-bridge-fixture.mjs: prod's rules plus
// the real migrations) as the signed-in user from the request's bearer token,
// under RLS, so two phones signed in as different people each see only what
// they may see. Tables the fixture doesn't have answer empty.
import { as } from "./creative-bridge-fixture.mjs";

const headers = {
  "access-control-allow-origin": "*", "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS", "content-type": "application/json",
  "access-control-expose-headers": "content-range",
};
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
export const tokenFor = (uid) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: uid, role: "authenticated", aud: "authenticated", exp: 4102444800 })}.fixture`;
const userJson = (uid) => ({ id: uid, aud: "authenticated", role: "authenticated", email: `${uid.slice(-4)}@example.com`, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" });

/** Sign a browser context in as `uid` (the session the app's fixture client reads). */
export async function signIn(context, uid) {
  const session = { access_token: tokenFor(uid), token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "fixture", user: userJson(uid) };
  await context.addInitScript(([value, id]) => {
    localStorage.setItem(`welcome_shown_${id}`, "true");
    localStorage.setItem("sb-fixture-auth-token", value);
  }, [JSON.stringify(session), uid]);
}

const viewerOf = (req) => {
  try {
    const token = (req.headers()["authorization"] || "").replace(/^Bearer /, "");
    const sub = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
    return /^[0-9a-f-]{36}$/.test(sub) ? sub : null;
  } catch {
    return null;
  }
};

const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "ILIKE" };

/**
 * @param db PGlite
 * @param opts.rpcs names of RPCs that run on the database (named arguments)
 * @param opts.fixed { [rpcOrTable]: (viewer, args) => body } canned answers
 * @param opts.rows { [table]: async (row, viewer) => row } extra fields per row
 * @param opts.log array that collects every request
 */
// PostgREST sends date columns as "YYYY-MM-DD", not timestamps.
const DATE_AS_TEXT = { parsers: { 1082: (value) => value } };

export function backend(db, { rpcs = [], fixed = {}, rows = {}, log = [] } = {}) {
  const q = (sql, params) => db.query(sql, params, DATE_AS_TEXT);
  const columns = new Map();
  const tableColumns = async (table) => {
    if (!columns.has(table)) {
      const found = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table])).rows;
      columns.set(table, found.length ? new Set(found.map((r) => r.column_name)) : null);
    }
    return columns.get(table);
  };
  const run = async (viewer, fn) => {
    if (viewer) await as(db, "authenticated", viewer);
    else await as(db, "anon");
    try {
      return await fn();
    } finally {
      await db.exec("RESET ROLE");
    }
  };

  const rest = async (req, url, table, viewer) => {
    const cols = await tableColumns(table);
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (!cols) return { body: single ? null : [] };
    const params = [];
    const where = [];
    for (const [key, raw] of url.searchParams) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
      if (key === "or" || !cols.has(key)) continue;
      const negate = raw.startsWith("not.");
      const [op, ...rest] = (negate ? raw.slice(4) : raw).split(".");
      const value = rest.join(".");
      let clause = null;
      if (op === "is") clause = `${key} IS ${value === "null" ? "NULL" : value === "true" ? "TRUE" : "FALSE"}`;
      else if (op === "in") {
        params.push(value.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, "")));
        clause = `${key}::text = ANY($${params.length}::text[])`;
      } else if (OPS[op]) {
        params.push(op === "like" || op === "ilike" ? value.replace(/\*/g, "%") : value);
        clause = `${key}${op === "like" || op === "ilike" ? "::text" : ""} ${OPS[op]} $${params.length}`;
      }
      if (clause) where.push(negate ? `NOT (${clause})` : clause);
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const extra = rows[table] || ((r) => r);
    return run(viewer, async () => {
      let out;
      if (req.method() === "GET" || req.method() === "HEAD") {
        const order = (url.searchParams.get("order") || "").split(",").map((o) => o.split(".")).filter(([c]) => cols.has(c))
          .map(([c, dir]) => `${c} ${dir === "desc" ? "DESC" : "ASC"}`).join(", ");
        const limit = Number(url.searchParams.get("limit")) || null;
        out = (await q(`SELECT * FROM public.${table}${whereSql}${order ? ` ORDER BY ${order}` : ""}${limit ? ` LIMIT ${limit}` : ""}`, params)).rows;
        if (req.method() === "HEAD" || (req.headers()["prefer"] || "").includes("count=exact")) {
          return { headers: { ...headers, "content-range": `0-${Math.max(out.length - 1, 0)}/${out.length}` }, body: req.method() === "HEAD" ? "" : await Promise.all(out.map((r) => extra(r, viewer))) };
        }
      } else if (req.method() === "POST") {
        const payload = JSON.parse(req.postData() || "[]");
        out = [];
        for (const item of Array.isArray(payload) ? payload : [payload]) {
          const keys = Object.keys(item).filter((k) => cols.has(k));
          out.push((await q(`INSERT INTO public.${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, keys.map((k) => item[k]))).rows[0]);
        }
      } else if (req.method() === "PATCH") {
        const payload = JSON.parse(req.postData() || "{}");
        const keys = Object.keys(payload).filter((k) => cols.has(k));
        if (!keys.length) return { body: single ? null : [] };
        const set = keys.map((k, i) => `${k} = $${params.length + i + 1}`).join(", ");
        out = (await q(`UPDATE public.${table} SET ${set}${whereSql} RETURNING *`, [...params, ...keys.map((k) => payload[k])])).rows;
      } else if (req.method() === "DELETE") {
        out = (await q(`DELETE FROM public.${table}${whereSql} RETURNING *`, params)).rows;
      } else {
        return { body: [] };
      }
      out = await Promise.all(out.map((r) => extra(r, viewer)));
      return { body: single ? out[0] ?? null : out };
    }).catch((e) => ({ status: 400, body: { message: e.message, code: e.code || "P0001" } }));
  };

  const rpc = async (fn, args, viewer) => {
    const keys = Object.keys(args);
    const sql = `SELECT public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) r`;
    return run(viewer, async () => ({ body: (await db.query(sql, keys.map((k) => args[k]))).rows[0].r }))
      .catch((e) => ({ status: 400, body: { message: e.message, code: e.code || "P0001" } }));
  };

  return async function install(page) {
    await page.route("**/*supabase.co/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      const viewer = viewerOf(req);
      if (url.pathname.endsWith("/auth/v1/user")) {
        return route.fulfill({ status: viewer ? 200 : 401, headers, body: JSON.stringify(viewer ? userJson(viewer) : {}) });
      }
      if (url.pathname.includes("/auth/")) return route.fulfill({ status: 401, headers, body: "{}" });
      const fn = url.pathname.split("/rest/v1/rpc/")[1];
      const table = fn ? null : url.pathname.split("/rest/v1/")[1];
      log.push({ viewer, method: req.method(), fn, table, search: url.search });
      let result;
      const args = fn ? JSON.parse(req.postData() || "{}") : null;
      const key = fn || table || url.pathname.split("/functions/v1/")[1];
      if (key && fixed[key]) result = { body: await fixed[key](viewer, args, req, url) };
      else if (fn && rpcs.includes(fn)) result = await rpc(fn, args, viewer);
      else if (table) result = await rest(req, url, table, viewer);
      else result = { body: fn ? null : {} };
      if (result.status === 400 && process.env.DEBUG_REST) console.error("backend 400", key, result.body.message);
      // PostgREST returns JSON for every RPC result, strings included; HEAD bodies are empty.
      const raw = typeof result.body === "string" && !fn && result.body === "";
      return route.fulfill({ status: result.status || 200, headers: result.headers || headers, body: raw ? "" : JSON.stringify(result.body ?? null) });
    });
  };
}
