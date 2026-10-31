import { errorResponse } from "@/server/api-errors";
import { applyTemplateToSession } from "@/server/templates";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Applies the template and starts a new round. */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return Response.json(applyTemplateToSession(id));
  } catch (cause) {
    return errorResponse(cause);
  }
}
