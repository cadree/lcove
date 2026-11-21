function recordMessage(error: object): string | undefined {
  if (!("message" in error)) return undefined;
  const message = error.message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

const GENERIC_FUNCTION_ERROR = /non-2xx|Edge Function/i;

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (typeof error === "string" && error.length > 0 && !GENERIC_FUNCTION_ERROR.test(error)) return error;
  if (error instanceof Error && error.message && !GENERIC_FUNCTION_ERROR.test(error.message)) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = recordMessage(error);
    if (message && !GENERIC_FUNCTION_ERROR.test(message)) return message;
  }
  return fallback;
}
