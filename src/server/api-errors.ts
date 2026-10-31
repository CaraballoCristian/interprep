import { StudyError } from "./study";
import { TemplateError } from "./templates";

/** Maps domain errors to REST responses; unknown errors become a 500. */
export function errorResponse(cause: unknown): Response {
  if (cause instanceof TemplateError) {
    const status =
      cause.code === "not_found"
        ? 404
        : cause.code === "duplicate_name"
          ? 409
          : 400;
    return Response.json({ error: cause.code }, { status });
  }

  if (cause instanceof StudyError) {
    return Response.json({ error: cause.code }, { status: 409 });
  }

  console.error(cause);
  return Response.json({ error: "internal_error" }, { status: 500 });
}
