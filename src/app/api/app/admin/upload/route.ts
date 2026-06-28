import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { storeFile } from "@/server/storage";
import { notifyTenantClients } from "@/server/notifications/fanout";

// Upload a file into a client's workspace. Multipart: `file` + metadata.
// Stores the bytes (Vercel Blob or DB), creates the Document, optionally files
// it under a phase/deliverable and surfaces it to the client.
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const tenantId = String(form.get("tenantId") || "");
  if (!(file instanceof File) || !tenantId) {
    return NextResponse.json({ error: "file and tenantId are required" }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  const name = String(form.get("name") || file.name || "document");
  const kind = String(form.get("kind") || "DOCUMENT");
  const clientVisible = String(form.get("clientVisible") ?? "true") === "true";
  const isFinal = String(form.get("isFinal") ?? "false") === "true";
  const engagementId = (form.get("engagementId") as string) || null;
  const milestoneId = (form.get("milestoneId") as string) || null;
  const deliverableId = (form.get("deliverableId") as string) || null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const stored = await storeFile(name, bytes, contentType);

  const doc = await prisma.document.create({
    data: {
      tenantId,
      engagementId,
      milestoneId,
      deliverableId,
      name,
      kind,
      mimeType: contentType,
      url: stored.ref,
      sizeBytes: stored.sizeBytes,
      isFinal,
      clientVisible,
      source: "HUMAN",
    },
  });

  if (clientVisible) {
    await notifyTenantClients(tenantId, "UPDATE", `New document available: ${name}`);
  }

  return NextResponse.json({ ok: true, id: doc.id, name, sizeBytes: stored.sizeBytes });
}
