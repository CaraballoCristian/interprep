import { errorResponse } from "@/server/api-errors";
import { createDeckFromInput, listDeckViews } from "@/server/decks";
import { deckCreateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return Response.json({ decks: listDeckViews() });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Creates a deck with a custom name. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = deckCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return Response.json(
      { deck: createDeckFromInput(parsed.data) },
      { status: 201 },
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
