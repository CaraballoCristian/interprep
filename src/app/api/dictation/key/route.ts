import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { removeGeminiKey, saveGeminiKey } from "@/server/dictation";
import { dictationKeySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** Stores the user's own Gemini key encrypted at rest. */
export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = dictationKeySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    const { hint } = saveGeminiKey(user.id, parsed.data.apiKey);
    return Response.json({ hasApiKey: true, keyHint: hint });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    removeGeminiKey(user.id);
    return Response.json({ hasApiKey: false, keyHint: null });
  } catch (cause) {
    return errorResponse(cause);
  }
}
