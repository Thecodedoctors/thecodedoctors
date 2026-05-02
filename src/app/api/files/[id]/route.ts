import { NextResponse } from "next/server";
import { db, files, requests } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth-helpers";
import { userBelongsToClient } from "@/lib/clients";
import { getUploadsBucket } from "@/lib/r2";

/**
 * Authenticated download. Streams the R2 object to the requesting user
 * after verifying they have access to the parent request.
 *
 * Files attached to a request can only be fetched by:
 *   - any staff user
 *   - any member of the client that owns the request
 *
 * Anyone else gets 404 (not 403 — we don't reveal whether the file
 * exists at all).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return new NextResponse("Not found", { status: 404 });

  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const fileRows = await db()
    .select()
    .from(files)
    .where(eq(files.id, id))
    .limit(1);
  if (fileRows.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  const file = fileRows[0];

  // Authorize on the parent request
  if (!file.requestId) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!isStaff(session.user.role)) {
    const reqRows = await db()
      .select({ clientId: requests.clientId })
      .from(requests)
      .where(eq(requests.id, file.requestId))
      .limit(1);
    if (reqRows.length === 0) {
      return new NextResponse("Not found", { status: 404 });
    }
    const ok = await userBelongsToClient(session.user.id, reqRows[0].clientId);
    if (!ok) return new NextResponse("Not found", { status: 404 });
  }

  const bucket = await getUploadsBucket();
  if (!bucket) {
    return new NextResponse("Storage unavailable", { status: 503 });
  }

  const obj = await bucket.get(file.storageKey);
  if (!obj) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Inline images/PDFs in the browser; force download for other types so
  // the user can save them. The query param ?dl=1 forces download in
  // every case.
  const url = new URL(_req.url);
  const forceDownload = url.searchParams.get("dl") === "1";
  const inlineable =
    file.contentType.startsWith("image/") ||
    file.contentType === "application/pdf" ||
    file.contentType.startsWith("text/");
  const disposition =
    inlineable && !forceDownload
      ? `inline; filename="${encodeURIComponent(file.filename)}"`
      : `attachment; filename="${encodeURIComponent(file.filename)}"`;

  return new NextResponse(obj.body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": disposition,
      // Files don't change once uploaded; cache them privately for an hour.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
