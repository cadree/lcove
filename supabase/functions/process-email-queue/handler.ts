import { requireInternalSecret } from "../_shared/require-caller.ts";
import { runEmailQueue } from "../_shared/email-queue-dispatch.mjs";

const jsonHeaders = { "Content-Type": "application/json" };

export type EmailQueueDeps = {
  supabase: {
    from: (table: string) => unknown;
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;
  };
  sendEmail: (payload: Record<string, unknown>) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

function configError(): Response {
  return new Response(JSON.stringify({ error: "Server configuration error" }), {
    status: 500,
    headers: jsonHeaders,
  });
}

export async function handleEmailQueueRequest(
  req: Request,
  deps?: EmailQueueDeps,
): Promise<Response> {
  const denied = requireInternalSecret(req, jsonHeaders);
  if (denied) return denied;

  if (!deps) return configError();

  return runEmailQueue(deps);
}
