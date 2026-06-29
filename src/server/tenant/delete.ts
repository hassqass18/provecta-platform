import { prisma } from "@/lib/db";

/**
 * Hard-delete a client/prospect tenant and its ENTIRE object graph. There are no
 * onDelete cascades in the schema, so we remove rows in FK-dependency order
 * inside one transaction (all-or-nothing). Audit rows are PRESERVED (the chain is
 * tamper-evident) — we only null the actorId of the tenant's users.
 *
 * SUPER_ADMIN only (enforced at the call sites). Irreversible.
 */
export async function deleteTenant(tenantId: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return { ok: false, error: "not found" };

  const engagements = await prisma.engagement.findMany({ where: { tenantId }, select: { id: true } });
  const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true } });
  const engagementIds = engagements.map((e) => e.id);
  const userIds = users.map((u) => u.id);
  const inEng = { engagementId: { in: engagementIds } };

  await prisma.$transaction(async (tx) => {
    // Grandchildren first (FK to Invoice / Ticket).
    await tx.payment.deleteMany({ where: { invoice: { tenantId } } });
    await tx.ticketMessage.deleteMany({ where: { ticket: { tenantId } } });

    // Engagement children (FK to Engagement / Milestone).
    await tx.task.deleteMany({ where: inEng });
    await tx.deliverable.deleteMany({ where: inEng });
    await tx.kpi.deleteMany({ where: inEng });
    await tx.sla.deleteMany({ where: inEng });
    await tx.ticket.deleteMany({ where: { tenantId } });
    await tx.invoice.deleteMany({ where: { tenantId } });
    await tx.milestone.deleteMany({ where: inEng });
    await tx.charter.deleteMany({ where: inEng });
    await tx.proposal.deleteMany({ where: inEng });
    await tx.document.deleteMany({ where: { tenantId } });

    // Loose tenant/engagement-scoped rows (no FK, but cleaned).
    await tx.transcript.deleteMany({ where: { tenantId } });
    await tx.communication.deleteMany({ where: { tenantId } });
    await tx.comment.deleteMany({ where: { tenantId } });
    await tx.approval.deleteMany({ where: { tenantId } });
    await tx.conversationState.deleteMany({ where: { tenantId } });
    await tx.engagementMetricSnapshot.deleteMany({ where: inEng });
    await tx.adoptionAssessment.deleteMany({ where: inEng });
    await tx.brainQuery.deleteMany({ where: inEng });
    await tx.envelope.deleteMany({ where: { tenantId } });
    await tx.ingestJob.deleteMany({ where: { tenantId } });
    await tx.deviceToken.deleteMany({ where: { OR: [{ tenantId }, { userId: { in: userIds } }] } });
    await tx.notification.deleteMany({ where: { userId: { in: userIds } } });

    // Preserve the audit chain: null the tenant's users' actorId rather than delete.
    await tx.auditLog.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } });

    // Parents.
    await tx.engagement.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  }, { timeout: 30_000, maxWait: 15_000 });

  return { ok: true, name: tenant.name };
}
