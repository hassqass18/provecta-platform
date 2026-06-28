import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDocSig } from "@/lib/doc-link";
import { readFile } from "@/server/storage";

// Universal signed document download: /d/<id>?exp&sig. Verifies the signature,
// logs the access, and streams the bytes (blob fetched server-side, so the raw
// storage URL is never exposed). Issued only to authorized callers via the
// /link endpoints (or server-rendered in the web back office).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp") || 0);
  const sig = url.searchParams.get("sig") || "";
  if (!verifyDocSig(id, exp, sig)) {
    return NextResponse.json({ error: "link expired or invalid" }, { status: 403 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const file = await readFile(doc.url);
  if (!file) return NextResponse.json({ error: "no file content" }, { status: 404 });

  // Audit the access.
  await prisma.auditLog.create({ data: { action: "DOCUMENT_DOWNLOAD", entity: "Document", entityId: id } }).catch(() => {});

  const fileName = doc.name.includes(".") ? doc.name : `${doc.name}`;
  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "content-type": doc.mimeType || file.contentType || "application/octet-stream",
      "content-disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
