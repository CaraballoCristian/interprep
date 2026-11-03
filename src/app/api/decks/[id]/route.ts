import { errorResponse } from "@/server/api-errors";
import { removeDeck, renameDeckFromInput } from "@/server/decks";
import { deckUpdateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Renames a deck. */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = deckUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return Response.json({ deck: renameDeckFromInput(id, parsed.data) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Deletes a deck and every card in it. */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return Response.json({ ok: true, ...removeDeck(id) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
