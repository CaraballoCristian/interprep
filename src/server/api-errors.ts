import { ForbiddenError, UnauthorizedError } from "./auth";
import { DeckError } from "./decks";
import { LibraryError } from "./library";
import { StudyError } from "./study";
import { TemplateError } from "./templates";

/** Maps domain errors to REST responses; unknown errors become a 500. */
export function errorResponse(cause: unknown): Response {
  if (cause instanceof UnauthorizedError) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (cause instanceof ForbiddenError) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (cause instanceof LibraryError) {
    const status =
      cause.code === "not_found"
        ? 404
        : cause.code === "duplicate_card"
          ? 409
          : 400;
    return Response.json({ error: cause.code }, { status });
  }

  if (cause instanceof DeckError) {
    const status =
      cause.code === "not_found"
        ? 404
        : cause.code === "duplicate_name" || cause.code === "last_deck"
          ? 409
          : 400;
    return Response.json({ error: cause.code }, { status });
  }

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
