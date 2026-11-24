const GENERIC_FUNCTION_ERROR = /non-2xx|Edge Function/i;

type JsonBody = { json?: () => Promise<unknown>; clone?: () => JsonBody };

function bodySource(context: JsonBody): JsonBody {
  return typeof context.clone === "function" ? context.clone() : context;
}

export async function readFunctionError(error: unknown, data?: unknown, fallback = "Request failed"): Promise<string> {
  const payload = data && typeof data === "object" && "error" in data && typeof data.error === "string"
    ? data.error
    : "";
  if (payload) return payload;

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: JsonBody }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await bodySource(context).json?.();
        if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) {
          return body.error;
        }
      } catch {
        // The response body was already read or was not JSON.
      }
    }
  }

  if (error instanceof Error && error.message && !GENERIC_FUNCTION_ERROR.test(error.message)) {
    return error.message;
  }
  return fallback;
}

/**
 * Supabase turns every non-2xx function response into a generic Error.
 * Put the JSON error string on that Error so existing toasts keep showing it
 * when auth and validation responses stop using status 500.
 */
export async function withServerFunctionMessage<T extends { data: unknown; error: { message?: string; name?: string; context?: unknown } | null }>(
  result: T,
): Promise<T> {
  if (!result.error) return result;
  const message = await readFunctionError(result.error, result.data, "");
  if (!message || message === result.error.message) return result;
  const readable = new Error(message);
  if (result.error.name) readable.name = result.error.name;
  return { ...result, error: Object.assign(readable, { context: result.error.context }) };
}
