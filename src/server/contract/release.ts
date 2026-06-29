import { prisma } from "@/lib/db";
import { sendForSignature } from "@/lib/esign";
import { notifyTenantClients } from "@/server/notifications/fanout";

/**
 * Operator releases a reviewed engagement agreement for the client to sign
 * (shared by the web server action and the mobile API route). Respects the
 * wet-ink jurisdiction gate; on release the contract Document becomes
 * client-visible and the client is notified.
 */
export async function releaseContract(
  envelopeId: string,
  actorId: string | null,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const env = await prisma.envelope.findUnique({ where: { id: envelopeId } });
  if (!env) return { ok: false, error: "not found" };

  const status = await sendForSignature(envelopeId); // "SENT" | "WET_INK_REQUIRED"
  if (env.documentId) {
    await prisma.document.update({ where: { id: env.documentId }, data: { clientVisible: true } });
  }
  const msg =
    status === "WET_INK_REQUIRED"
      ? "Your engagement agreement requires a wet-ink signature — details in your workspace."
      : "Your engagement agreement is ready to review and sign.";
  await notifyTenantClients(env.tenantId, "UPDATE", msg).catch(() => {});
  await prisma.auditLog
    .create({ data: { actorId, action: "CONTRACT_RELEASED", entity: "Envelope", entityId: envelopeId, meta: status } })
    .catch(() => {});
  return { ok: true, status };
}
