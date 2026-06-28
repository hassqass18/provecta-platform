import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";

/**
 * Object storage for uploaded files. Uses Vercel Blob when keyed
 * (BLOB_READ_WRITE_TOKEN), otherwise falls back to a DB-backed store (FileBlob)
 * so uploads work immediately. The stored ref is persisted in Document.url:
 *   "blob:<https url>"  → Vercel Blob
 *   "db:<FileBlob id>"  → database fallback
 * Clients never receive the raw blob URL — reads are streamed server-side
 * through the audited download endpoint.
 */

export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export type StoredRef = { ref: string; sizeBytes: number; contentType: string };

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function storeFile(name: string, bytes: Buffer, contentType: string): Promise<StoredRef> {
  if (blobConfigured()) {
    const res = await put(`docs/${safeName(name)}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { ref: `blob:${res.url}`, sizeBytes: bytes.length, contentType };
  }
  const fb = await prisma.fileBlob.create({
    data: { name: safeName(name), contentType, sizeBytes: bytes.length, data: new Uint8Array(bytes) },
  });
  return { ref: `db:${fb.id}`, sizeBytes: bytes.length, contentType };
}

export type ReadResult = { bytes: Buffer; contentType: string; name?: string };

export async function readFile(ref: string | null | undefined): Promise<ReadResult | null> {
  if (!ref) return null;
  if (ref.startsWith("db:")) {
    const fb = await prisma.fileBlob.findUnique({ where: { id: ref.slice(3) } });
    if (!fb) return null;
    return { bytes: Buffer.from(fb.data), contentType: fb.contentType, name: fb.name };
  }
  if (ref.startsWith("blob:")) {
    try {
      const r = await fetch(ref.slice(5));
      if (!r.ok) return null;
      return { bytes: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get("content-type") || "application/octet-stream" };
    } catch {
      return null;
    }
  }
  // Legacy refs (git-ingested "urlRef" etc.) have no fetchable bytes.
  return null;
}

export function storageMode(): "vercel-blob" | "database" {
  return blobConfigured() ? "vercel-blob" : "database";
}
