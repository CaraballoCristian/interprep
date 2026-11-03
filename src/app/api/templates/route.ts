import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { listTemplateViews, saveTemplate } from "@/server/templates";
import { templateCreateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ templates: listTemplateViews(user.id) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Saves the given config under a new name. Does not apply it. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = templateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    return Response.json(
      { template: saveTemplate(user.id, parsed.data) },
      { status: 201 },
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
