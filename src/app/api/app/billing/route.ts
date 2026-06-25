import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// The client's own invoices + contracts (read-only). Pay/sign actions go live
// once the payment + e-sign rails are keyed; until then this is a status view.
// Reads via the bypass client with an explicit tenant filter (the Envelope model
// is outside the app_rls grant/policy set), strictly scoped to the verified user.
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ invoices: [], contracts: [] });

  const tenantId = user.tenantId;
  const [invoices, envelopes] = await Promise.all([
    prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.envelope.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return NextResponse.json({
    invoices: invoices
      .filter((i) => i.status !== "DRAFT" && i.status !== "VOID")
      .map((i) => ({ id: i.id, number: i.number, status: i.status, amountMinor: i.amountMinor, currency: i.currency, dueAt: i.dueAt, paidAt: i.paidAt })),
    contracts: envelopes
      .filter((e) => e.status !== "DRAFT")
      .map((e) => ({ id: e.id, title: e.title, status: e.status, docType: e.docType })),
  });
}
