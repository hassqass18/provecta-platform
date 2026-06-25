import { prisma } from "@/lib/db";
import { esignProvider, requiresWetInk } from "@/lib/esign";
import { notifyTenantClients } from "@/server/notifications/fanout";

/**
 * Billing + contracts for the admin app. Manual recording (mark paid / mark
 * signed) works today; the automated provider "send" is honestly gated — we
 * never mark something SENT unless a real provider could deliver it.
 */

export function paymentsConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY || process.env.MPESA_CONSUMER_KEY || process.env.FLUTTERWAVE_SECRET_KEY);
}
export function esignConfigured(): boolean {
  return esignProvider() !== "STUB";
}
export function billingConfig() {
  return { payments: paymentsConfigured(), esign: esignConfigured(), esignProvider: esignProvider() };
}

export async function createInvoice(input: {
  tenantId: string; engagementId?: string | null; amountMinor: number; currency?: string; dueAt?: string | null; memo?: string | null;
}) {
  const count = await prisma.invoice.count();
  const number = `INV-2026-${String(count + 1).padStart(4, "0")}`;
  return prisma.invoice.create({
    data: {
      tenantId: input.tenantId,
      engagementId: input.engagementId ?? null,
      number,
      status: "DRAFT",
      amountMinor: input.amountMinor,
      currency: input.currency || "USD",
      issuedAt: new Date(),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    },
  });
}

export async function invoiceAction(id: string, action: "SEND" | "MARK_PAID" | "VOID") {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) throw new Error("invoice not found");

  if (action === "SEND") {
    if (!paymentsConfigured()) return { ok: false, gated: true, message: "Add a payments key (STRIPE_SECRET_KEY) to send a live payment link." };
    await prisma.invoice.update({ where: { id }, data: { status: "SENT", issuedAt: inv.issuedAt ?? new Date() } });
    await notifyTenantClients(inv.tenantId, "UPDATE", `Invoice ${inv.number} is ready — ${(inv.amountMinor / 100).toLocaleString()} ${inv.currency}`);
    return { ok: true, status: "SENT" };
  }
  if (action === "MARK_PAID") {
    await prisma.$transaction([
      prisma.payment.create({ data: { invoiceId: id, amountMinor: inv.amountMinor, currency: inv.currency, method: "MANUAL" } }),
      prisma.invoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } }),
    ]);
    await notifyTenantClients(inv.tenantId, "UPDATE", `Payment received for invoice ${inv.number} — thank you`);
    return { ok: true, status: "PAID" };
  }
  await prisma.invoice.update({ where: { id }, data: { status: "VOID" } });
  return { ok: true, status: "VOID" };
}

export async function createEnvelope(input: {
  tenantId: string; engagementId?: string | null; title: string; signerName: string; signerEmail: string; docType?: string; country?: string;
}) {
  return prisma.envelope.create({
    data: {
      tenantId: input.tenantId,
      engagementId: input.engagementId ?? null,
      title: input.title,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      docType: input.docType || "AGREEMENT",
      country: input.country || "US",
      status: "DRAFT",
      provider: esignProvider(),
    },
  });
}

export async function envelopeAction(id: string, action: "SEND" | "MARK_SIGNED" | "DECLINE") {
  const env = await prisma.envelope.findUnique({ where: { id } });
  if (!env) throw new Error("envelope not found");

  if (action === "SEND") {
    // Wet-ink jurisdictions are a legitimate state regardless of provider.
    if (await requiresWetInk(env.country, env.docType)) {
      await prisma.envelope.update({ where: { id }, data: { status: "WET_INK_REQUIRED" } });
      return { ok: true, status: "WET_INK_REQUIRED" };
    }
    if (!esignConfigured()) return { ok: false, gated: true, message: "Add an e-sign key (DROPBOX_SIGN_API_KEY / DOCUSIGN_INTEGRATION_KEY) to send for signature." };
    await prisma.envelope.update({ where: { id }, data: { status: "SENT", provider: esignProvider(), sentAt: new Date() } });
    await notifyTenantClients(env.tenantId, "UPDATE", `“${env.title}” is ready for your signature`);
    return { ok: true, status: "SENT" };
  }
  if (action === "MARK_SIGNED") {
    await prisma.envelope.update({ where: { id }, data: { status: "SIGNED", completedAt: new Date() } });
    await notifyTenantClients(env.tenantId, "UPDATE", `“${env.title}” is fully signed`);
    return { ok: true, status: "SIGNED" };
  }
  await prisma.envelope.update({ where: { id }, data: { status: "DECLINED" } });
  return { ok: true, status: "DECLINED" };
}
