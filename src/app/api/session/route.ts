import { validateConfig } from "@lib/templates/validation";
import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { applyStudyConfig } from "@/server/study";
import { getFiltersView } from "@/server/templates";
import { sessionUpdateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** Current session config plus the options needed by the filters screen. */
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(getFiltersView(user.id));
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Applies a manual config and starts a new round. */
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = sessionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const validation = validateConfig(parsed.data.config);
  if (!validation.ok) {
    return Response.json(
      { error: "invalid_config", reason: validation.error },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    applyStudyConfig(user.id, validation.config, null);
    return Response.json(getFiltersView(user.id));
  } catch (cause) {
    return errorResponse(cause);
  }
}
