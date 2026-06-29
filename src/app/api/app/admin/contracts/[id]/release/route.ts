import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { sendForSignature } from "@/lib/esign";
import { notifyTenantClients } from "@/server/notifications/fanout";

// Operator releases a reviewed engagement agreement for the client to sign.
// Respects the wet-ink jurisdiction gate; on release the contract Document
// becomes client-visible and the client is notified. id = envelope id.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const env = await prisma.envelope.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: "not found" }, { status: 404 });

  const status = await sendForSignature(id); // "SENT" or "WET_INK_REQUIRED"

  if (env.documentId) {
    await prisma.document.update({ where: { id: env.documentId }, data: { clientVisible: true } });
  }
  const msg =
    status === "WET_INK_REQUIRED"
      ? `Your engagement agreement requires a wet-ink signature — details in your workspace.`
      : `Your engagement agreement is ready to review and sign.`;
  await notifyTenantClients(env.tenantId, "UPDATE", msg).catch(() => {});
  await prisma.auditLog
    .create({ data: { actorId: admin.id, action: "CONTRACT_RELEASED", entity: "Envelope", entityId: id, meta: status } })
    .catch(() => {});

  return NextResponse.json({ ok: true, status });
}
