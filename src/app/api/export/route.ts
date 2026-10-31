import { errorResponse } from "@/server/api-errors";
import { buildExport } from "@/server/library";
import { exportFormatSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** Full backup of every card as CSV or JSON. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = exportFormatSchema.safeParse(params.get("format") ?? "csv");

  if (!parsed.success) {
    return Response.json({ error: "invalid_format" }, { status: 400 });
  }

  try {
    const file = buildExport(parsed.data);
    // Spreadsheets need the BOM to read UTF-8 accents correctly.
    const body = parsed.data === "csv" ? `\uFEFF${file.body}` : file.body;

    return new Response(body, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${file.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
