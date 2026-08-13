const GENERIC_SERVER_ERROR = "Something went wrong. Please try again later.";

/**
 * Keep implementation details in the server log while returning a stable,
 * non-technical message to browsers. Route-specific context helps operators
 * diagnose failures without exposing stack messages or database details.
 */
export function unexpectedErrorResponse(
  scope: string,
  error: unknown,
  status = 500,
) {
  logUnexpectedError(scope, error);
  return Response.json(
    { error: GENERIC_SERVER_ERROR },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function logUnexpectedError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
}
