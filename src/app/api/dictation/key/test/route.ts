import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { testGeminiKey } from "@/server/dictation";

export const dynamic = "force-dynamic";

/** Metadata-only validation; it does not spend generation tokens. */
export async function POST() {
  try {
    const user = await requireUser();
    await testGeminiKey(user.id);
    return Response.json({ ok: true });
  } catch (cause) {
    return errorResponse(cause);
  }
}
