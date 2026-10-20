export async function readFunctionError(error: unknown, data?: unknown, fallback = "Request failed"): Promise<string> {
  const payload = data && typeof data === "object" && "error" in data && typeof data.error === "string"
    ? data.error
    : "";
  if (payload) return payload;

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) {
          return body.error;
        }
      } catch {
        // The response body was already read or was not JSON.
      }
    }
  }

  if (error instanceof Error && error.message && !/non-2xx|Edge Function/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}
