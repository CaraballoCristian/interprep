import { errorResponse } from "@/server/api-errors";
import {
  createCardFromInput,
  getLibraryView,
  parseLibraryFilter,
} from "@/server/library";
import { cardCreateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** Library listing with server-side search and filters. */
export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(getLibraryView(parseLibraryFilter(params)));
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Manual card creation. New cards are always visible. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = cardCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return Response.json(
      { card: createCardFromInput(parsed.data) },
      { status: 201 },
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
