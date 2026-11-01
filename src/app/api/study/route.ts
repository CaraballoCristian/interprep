import { z } from "zod";
import { CARD_STATUSES } from "@lib/types";
import {
  applyStudyAction,
  getStudyView,
  StudyError,
} from "@/server/study";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flip"), flipped: z.boolean() }),
  z.object({ type: z.literal("status"), status: z.enum(CARD_STATUSES) }),
  z.object({ type: z.literal("hide") }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("new-round") }),
  z.object({
    type: z.literal("review"),
    statuses: z.array(z.enum(CARD_STATUSES)).min(1),
  }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("leave") }),
]);

function errorResponse(cause: unknown): Response {
  if (cause instanceof StudyError) {
    return Response.json({ error: cause.code }, { status: 409 });
  }

  console.error(cause);
  return Response.json({ error: "internal_error" }, { status: 500 });
}

export function GET() {
  try {
    return Response.json(getStudyView());
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return Response.json(applyStudyAction(parsed.data));
  } catch (cause) {
    return errorResponse(cause);
  }
}
