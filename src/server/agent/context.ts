import { prisma } from "@/lib/db";

// Per-client FACTUAL context for the agent prompt. This is the client's OWN data
// (their engagement status, milestones, KPIs, SLAs, open invoices, shareable
// docs) — safe to reference back to them. Bypass `prisma` is fine: every read is
// explicitly scoped to `tenantId`.

export interface ContextMilestone {
  title: string;
  status: string;
  dueDate: Date | null;
}

export interface ContextKpi {
  label: string;
  value: number;
  unit: string | null;
}

export interface ContextSla {
  metric: string;
  target: string;
  status: string;
}

export interface ContextInvoice {
  number: string;
  amountMinor: number;
  status: string;
  dueAt: Date | null;
}

export interface ContextEngagement {
  name: string;
  code: string;
  status: string;
  budgetMinor: number;
  currency: string;
  milestones: ContextMilestone[];
  kpis: ContextKpi[];
  slas: ContextSla[];
  openInvoices: ContextInvoice[];
}

export interface ClientContext {
  tenantName: string;
  preferredChannel: string | null;
  engagement: ContextEngagement | null;
  shareableDocuments: string[]; // names only
}

const OPEN_INVOICE_STATUSES = ["SENT", "OVERDUE"];

/**
 * Compact, client-safe factual snapshot for `tenantId`: tenant identity +
 * preferred channel, the latest active engagement (with milestones, KPIs, SLAs
 * and open invoices), and the names of the client's shareable (final +
 * client-visible) documents.
 */
export async function getClientContext(tenantId: string): Promise<ClientContext> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, preferredChannel: true },
  });

  const raw = await prisma.engagement.findFirst({
    where: { tenantId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { orderIndex: "asc" }, select: { title: true, status: true, dueDate: true } },
      kpis: { select: { label: true, value: true, unit: true } },
      slas: { select: { metric: true, target: true, status: true } },
      invoices: {
        where: { status: { in: OPEN_INVOICE_STATUSES } },
        orderBy: { dueAt: "asc" },
        select: { number: true, amountMinor: true, status: true, dueAt: true },
      },
    },
  });

  const shareable = await prisma.document.findMany({
    where: { tenantId, isFinal: true, clientVisible: true },
    orderBy: { createdAt: "desc" },
    select: { name: true },
  });

  const engagement: ContextEngagement | null = raw
    ? {
        name: raw.name,
        code: raw.code,
        status: raw.status,
        budgetMinor: raw.budgetMinor,
        currency: raw.currency,
        milestones: raw.milestones,
        kpis: raw.kpis,
        slas: raw.slas,
        openInvoices: raw.invoices,
      }
    : null;

  return {
    tenantName: tenant?.name ?? "Unknown client",
    preferredChannel: tenant?.preferredChannel ?? null,
    engagement,
    shareableDocuments: shareable.map((d) => d.name),
  };
}

function fmtMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "no date";
}

/** Format the client context into a concise plain-text block for the system prompt. */
export function renderClientContext(ctx: ClientContext): string {
  const lines: string[] = [];
  lines.push("CLIENT-FACING FACTS (safe to share)");
  lines.push(`Client: ${ctx.tenantName}`);
  lines.push(`Preferred channel: ${ctx.preferredChannel ?? "unspecified"}`);

  const e = ctx.engagement;
  if (!e) {
    lines.push("Active engagement: none on record.");
  } else {
    lines.push("");
    lines.push(`Engagement: ${e.name} (${e.code}) — status ${e.status}`);
    lines.push(`Budget: ${fmtMoney(e.budgetMinor, e.currency)}`);

    if (e.milestones.length > 0) {
      lines.push("Milestones:");
      for (const m of e.milestones) lines.push(`  - ${m.title} [${m.status}] due ${fmtDate(m.dueDate)}`);
    } else {
      lines.push("Milestones: none.");
    }

    if (e.kpis.length > 0) {
      lines.push("KPIs:");
      for (const k of e.kpis) lines.push(`  - ${k.label}: ${k.value}${k.unit ? ` ${k.unit}` : ""}`);
    }

    if (e.slas.length > 0) {
      lines.push("SLAs:");
      for (const s of e.slas) lines.push(`  - ${s.metric}: target ${s.target} [${s.status}]`);
    }

    if (e.openInvoices.length > 0) {
      lines.push("Open invoices:");
      for (const i of e.openInvoices) {
        lines.push(`  - ${i.number}: ${fmtMoney(i.amountMinor, e.currency)} [${i.status}] due ${fmtDate(i.dueAt)}`);
      }
    } else {
      lines.push("Open invoices: none.");
    }
  }

  lines.push("");
  if (ctx.shareableDocuments.length > 0) {
    lines.push("Shareable documents (final, client-visible):");
    for (const name of ctx.shareableDocuments) lines.push(`  - ${name}`);
  } else {
    lines.push("Shareable documents: none.");
  }

  return lines.join("\n");
}
