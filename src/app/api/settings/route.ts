import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { readSettings, writeSettings } from "@/server/settings";
import { settingsUpdateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ settings: readSettings(user.id) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Partial update of theme and/or language. */
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    return Response.json({
      settings: writeSettings(user.id, parsed.data),
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
