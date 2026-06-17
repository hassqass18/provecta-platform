"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { proposalFromTranscript } from "@/lib/brain";
import { sendForSignature } from "@/lib/esign";

async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
}

// ── Proposal from transcript ──────────────────────────────────────────
export async function createProposalFromTranscript(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = String(formData.get("tenantId"));
  const title = String(formData.get("title") || "Untitled engagement").trim();
  const body = String(formData.get("transcript") || "").trim();
  if (!tenantId || !body) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  await prisma.transcript.create({ data: { tenantId, title, body, source: "DISCOVERY_CALL" } });
  const { bodyMd, suggestedBudgetMinor } = proposalFromTranscript(title, body);

  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;

  const eng = await prisma.engagement.create({
    data: {
      tenantId,
      name: title,
      code,
      status: "PROPOSED",
      summary: "Drafted from discovery transcript by the brain.",
      budgetMinor: suggestedBudgetMinor,
      currency: "USD",
      proposal: { create: { status: "DRAFT", amountMinor: suggestedBudgetMinor, currency: "USD", bodyMd } },
      charter: { create: { objectives: "(to refine)", sponsor: tenant.name } },
    },
  });
  await audit(admin.id, "PROPOSAL_FROM_TRANSCRIPT", "Engagement", eng.id, code);
  redirect(`/admin/engagements/${eng.id}`);
}

// ── E-signature ───────────────────────────────────────────────────────
export async function createEnvelope(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = String(formData.get("tenantId"));
  const title = String(formData.get("title") || "").trim();
  const signerName = String(formData.get("signerName") || "").trim();
  const signerEmail = String(formData.get("signerEmail") || "").trim();
  const country = String(formData.get("country") || "US");
  const docType = String(formData.get("docType") || "AGREEMENT");
  if (!tenantId || !title) return;
  const env = await prisma.envelope.create({
    data: { tenantId, title, signerName, signerEmail, country, docType },
  });
  await audit(admin.id, "ENVELOPE_CREATE", "Envelope", env.id);
  revalidatePath("/admin/esign");
}

export async function sendEnvelopeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const result = await sendForSignature(id);
  await audit(admin.id, "ENVELOPE_SEND", "Envelope", id, result);
  revalidatePath("/admin/esign");
}

export async function simulateSign(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.envelope.update({ where: { id }, data: { status: "SIGNED", completedAt: new Date() } });
  await audit(admin.id, "ENVELOPE_SIGNED", "Envelope", id);
  revalidatePath("/admin/esign");
}

export async function uploadWetInk(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const url = String(formData.get("url") || "uploaded://wet-ink.pdf");
  await prisma.envelope.update({ where: { id }, data: { status: "SIGNED", wetInkUrl: url, completedAt: new Date() } });
  await audit(admin.id, "ENVELOPE_WET_INK", "Envelope", id);
  revalidatePath("/admin/esign");
}

// ── Change management (ADKAR) ─────────────────────────────────────────
export async function saveAdkar(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = String(formData.get("engagementId"));
  const stakeholder = String(formData.get("stakeholder") || "Stakeholder").trim();
  const dims = ["awareness", "desire", "knowledge", "ability", "reinforcement"] as const;
  const data: Record<string, number> = {};
  for (const d of dims) data[d] = Math.max(1, Math.min(5, Number(formData.get(d)) || 3));
  await prisma.adoptionAssessment.create({
    data: { engagementId, stakeholder, ...(data as Record<(typeof dims)[number], number>) },
  });
  await audit(admin.id, "ADKAR_SAVE", "AdoptionAssessment", engagementId);
  revalidatePath("/admin/change");
}

// ── Autonomy ──────────────────────────────────────────────────────────
export async function setAutonomyState(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const state = String(formData.get("state"));
  await prisma.autonomyPolicy.update({ where: { id }, data: { state, updatedAt: new Date() } });
  await audit(admin.id, "AUTONOMY_SET", "AutonomyPolicy", id, state);
  revalidatePath("/admin/autonomy");
}
