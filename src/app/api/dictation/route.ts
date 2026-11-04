import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import {
  readDictationMeta,
  saveDictationConfig,
} from "@/server/dictation";
import { dictationConfigSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(readDictationMeta(user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = dictationConfigSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    return Response.json({
      config: saveDictationConfig(user.id, parsed.data),
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
