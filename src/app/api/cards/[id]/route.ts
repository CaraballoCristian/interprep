import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { removeCard, updateCardFromInput } from "@/server/library";
import { cardUpdateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Updates content fields and/or visibility. Content fields are merged over the
 * stored card, so the client may send only what changed.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = cardUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    return Response.json({
      card: updateCardFromInput(user.id, id, parsed.data),
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Deletes a card permanently. */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireUser();
    removeCard(user.id, id);
    return Response.json({ ok: true });
  } catch (cause) {
    return errorResponse(cause);
  }
}
