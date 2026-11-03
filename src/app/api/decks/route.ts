import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { createDeckFromInput, listDeckViews } from "@/server/decks";
import { deckCreateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ decks: listDeckViews(user.id) });
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
    const user = await requireUser();
    return Response.json(
      { deck: createDeckFromInput(user.id, parsed.data) },
      { status: 201 },
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
