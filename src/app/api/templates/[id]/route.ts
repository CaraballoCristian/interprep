import { errorResponse } from "@/server/api-errors";
import { removeTemplate, updateTemplateConfig } from "@/server/templates";
import { templateUpdateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Renames a template and/or overwrites its config. */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = templateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return Response.json({ template: updateTemplateConfig(id, parsed.data) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    removeTemplate(id);
    return Response.json({ ok: true });
  } catch (cause) {
    return errorResponse(cause);
  }
}
