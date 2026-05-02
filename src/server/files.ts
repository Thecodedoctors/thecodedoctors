"use server";

import { db, files, requests, users } from "@/db";
import { eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser, isStaff } from "@/lib/auth-helpers";
import { userBelongsToClient } from "@/lib/clients";
import { getUploadsBucket } from "@/lib/r2";
import { recordAudit } from "@/server/audit";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_UPLOAD = 10;

/** Allowed MIME types — tight whitelist. Patients send screenshots, PDFs,
 *  and the occasional log file. Code files are OK because they're text. */
const ALLOWED_PREFIXES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/zip",
];

export type FileRow = {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  uploaderUserId: string;
  uploaderName: string | null;
  createdAt: Date;
};

/* ──────────────────────────────────────────────────────────────────────────
   List
   ──────────────────────────────────────────────────────────────────────── */

export async function listFilesForRequest(requestId: string): Promise<FileRow[]> {
  const session = await requireUser();
  const allowed = await canAccessRequest(session.user.id, session.user.role, requestId);
  if (!allowed) return [];

  const rows = await db()
    .select({
      id: files.id,
      filename: files.filename,
      sizeBytes: files.sizeBytes,
      contentType: files.contentType,
      uploaderUserId: files.uploaderUserId,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.requestId, requestId))
    .orderBy(desc(files.createdAt));

  // Resolve uploader names — small N, single batched query
  if (rows.length === 0) return [];
  const uploaderIds = [...new Set(rows.map((r) => r.uploaderUserId))];
  const userRows = await db()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, uploaderIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    contentType: r.contentType,
    uploaderUserId: r.uploaderUserId,
    uploaderName: userById.get(r.uploaderUserId)?.name ?? null,
    createdAt: new Date(r.createdAt),
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
   Upload — server action
   ──────────────────────────────────────────────────────────────────────── */

export async function uploadFilesToRequest(formData: FormData): Promise<void> {
  const session = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;

  const allowed = await canAccessRequest(session.user.id, session.user.role, requestId);
  if (!allowed) return;

  const bucket = await getUploadsBucket();
  if (!bucket) {
    console.error("[files] R2 binding unavailable — upload skipped");
    return;
  }

  const fileEntries = formData.getAll("files");
  let uploadCount = 0;

  for (const entry of fileEntries) {
    if (uploadCount >= MAX_FILES_PER_UPLOAD) break;
    if (!(entry instanceof File)) continue;
    if (entry.size === 0) continue;
    if (entry.size > MAX_FILE_BYTES) {
      console.warn("[files] rejected oversized", entry.name, entry.size);
      continue;
    }
    if (!isAllowedType(entry.type)) {
      console.warn("[files] rejected type", entry.name, entry.type);
      continue;
    }

    const fileId = crypto.randomUUID();
    const safeName = sanitizeFilename(entry.name);
    const storageKey = `requests/${requestId}/${fileId}-${safeName}`;

    try {
      const arrayBuffer = await entry.arrayBuffer();
      await bucket.put(storageKey, arrayBuffer, {
        httpMetadata: { contentType: entry.type },
        customMetadata: {
          uploaderId: session.user.id,
          requestId,
          originalName: entry.name.slice(0, 200),
        },
      });

      await db().insert(files).values({
        id: fileId,
        requestId,
        uploaderUserId: session.user.id,
        filename: safeName,
        sizeBytes: entry.size,
        contentType: entry.type || "application/octet-stream",
        storageKey,
      });
      uploadCount++;

      await recordAudit({
        actorUserId: session.user.id,
        action: "file.upload",
        targetType: "request",
        targetId: requestId,
        after: { fileId, filename: safeName, sizeBytes: entry.size },
      });
    } catch (err) {
      console.error("[files] upload failed", entry.name, err);
    }
  }

  // Touch the request so the activity feed reflects the upload
  if (uploadCount > 0) {
    await db()
      .update(requests)
      .set({ updatedAt: new Date() })
      .where(eq(requests.id, requestId));
  }

  revalidatePath(`/dashboard/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
}

/* ──────────────────────────────────────────────────────────────────────────
   Delete — server action (only the uploader OR staff can delete)
   ──────────────────────────────────────────────────────────────────────── */

export async function deleteFile(formData: FormData): Promise<void> {
  const session = await requireUser();
  const fileId = String(formData.get("fileId") ?? "");
  if (!fileId) return;

  const rows = await db()
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (rows.length === 0) return;
  const file = rows[0];

  const staff = isStaff(session.user.role);
  if (!staff && file.uploaderUserId !== session.user.id) return;

  // Authorize on the request itself too
  const requestId = file.requestId;
  if (requestId) {
    const ok = await canAccessRequest(session.user.id, session.user.role, requestId);
    if (!ok) return;
  }

  // Delete from R2 first; if that fails, leave the row so we can retry.
  const bucket = await getUploadsBucket();
  if (bucket) {
    try {
      await bucket.delete(file.storageKey);
    } catch (err) {
      console.error("[files] R2 delete failed", err);
    }
  }

  await db().delete(files).where(eq(files.id, fileId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "file.delete",
    targetType: "request",
    targetId: requestId,
    before: { fileId, filename: file.filename },
  });

  if (requestId) {
    revalidatePath(`/dashboard/requests/${requestId}`);
    revalidatePath(`/admin/requests/${requestId}`);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────── */

async function canAccessRequest(
  userId: string,
  role: string | undefined,
  requestId: string
): Promise<boolean> {
  if (isStaff(role)) return true;
  const rows = await db()
    .select({ clientId: requests.clientId })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  if (rows.length === 0) return false;
  return userBelongsToClient(userId, rows[0].clientId);
}

function isAllowedType(type: string): boolean {
  if (!type) return false;
  return ALLOWED_PREFIXES.some((p) => type === p || type.startsWith(p + "+"));
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "untitled";
}
