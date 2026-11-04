import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { generateDictation } from "@/server/dictation";
import { dictationGenerateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = dictationGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    return Response.json(
      await generateDictation(user.id, parsed.data.config),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
