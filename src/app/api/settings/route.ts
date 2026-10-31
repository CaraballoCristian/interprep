import { errorResponse } from "@/server/api-errors";
import { readSettings, writeSettings } from "@/server/settings";
import { settingsUpdateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return Response.json({ settings: readSettings() });
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
    return Response.json({ settings: writeSettings(parsed.data) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
