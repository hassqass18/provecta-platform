import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { billingConfig } from "@/server/app-billing";

// Admin billing + contracts for one client: invoices, e-sign envelopes, and the
// live provider config (so the UI shows what's automated vs. gated on keys).
export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { clientId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [invoices, envelopes, engagements] = await Promise.all([
    prisma.invoice.findMany({ where: { tenantId: clientId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.envelope.findMany({ where: { tenantId: clientId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.engagement.findMany({ where: { tenantId: clientId }, select: { id: true, name: true } }),
  ]);

  return NextResponse.json({
    tenant,
    config: billingConfig(),
    engagements,
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, status: i.status, amountMinor: i.amountMinor, currency: i.currency, dueAt: i.dueAt, paidAt: i.paidAt })),
    envelopes: envelopes.map((e) => ({ id: e.id, title: e.title, status: e.status, signerName: e.signerName, signerEmail: e.signerEmail, docType: e.docType, provider: e.provider })),
  });
}
