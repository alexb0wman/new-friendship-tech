import { ZodError } from "zod";
export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryable = false) { super(message); }
}
export function invariant(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
export function errorResponse(error: unknown, correlationId: string) {
  const known = error instanceof AppError;
  const validation = error instanceof ZodError;
  const status = known ? error.status : validation ? 422 : 500;
  if (!known && !validation) console.error(JSON.stringify({ event: "request_error", correlationId, kind: error instanceof Error ? error.name : "unknown" }));
  return Response.json({ error: {
    code: known ? error.code : validation ? "VALIDATION" : "INTERNAL",
    message: known ? error.message : validation ? error.issues.map((item) => item.path.join(".") + ": " + item.message).join("; ") : "Something went wrong. Please try again.",
    retryable: known ? error.retryable : status >= 500, correlationId,
  } }, { status, headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlationId } });
}
