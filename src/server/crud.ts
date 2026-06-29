"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { storeFile } from "@/server/storage";
import { deleteTenant } from "@/server/tenant/delete";
import { kickAgentTick } from "@/lib/agent-kick";
import { resetUserPassword, setUserBlocked } from "@/server/users/manage";

const SUPER_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

async function audit(actorId: string, action: string, entity: string, entityId?: string, meta?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dateOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(v) : null;
};
const dollarsToMinor = (fd: FormData, k: string) => Math.round((Number(fd.get(k)) || 0) * 100);

// Decode an uploaded file to plain text when it's a text format we can read
// directly (no binary parser). Returns null for pdf/docx/images/etc.
function decodeTextFile(bytes: Buffer, mime: string, name: string): string | null {
  const m = mime.toLowerCase();
  const textual =
    m.startsWith("text/") ||
    /(json|xml|csv|yaml|markdown)/.test(m) ||
    /\.(md|markdown|txt|text|csv|tsv|json|ya?ml|xml|html?|log|vtt|srt|rtf)$/i.test(name);
  if (!textual) return null;
  // Reject NUL-bearing buffers (mislabeled binary).
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return null;
  const text = bytes.toString("utf8").trim();
  return text.length ? text.slice(0, 200000) : null;
}

// ── Clients ───────────────────────────────────────────────────────────
export async function createClient(formData: FormData) {
  const admin = await requireAdmin();
  const name = str(formData, "name");
  if (!name) return;
  // Onboarding: the client's main point of communication. Inbound on this channel
  // (matched by channelAddress) routes to this client and is their pull source.
  const preferredChannel = str(formData, "preferredChannel") || null;
  const channelAddress = str(formData, "channelAddress") || null;
  const t = await prisma.tenant.create({
    data: { name, slug: slugify(name), type: "CLIENT", preferredChannel, channelAddress },
  });
  // P1C durable outbox: pull the client's brain finals + auto-stage an onboarding
  // project. Drained idempotently by /api/cron/agent-tick (Vercel-safe, retryable).
  await prisma.ingestJob.createMany({
    data: [
      { tenantId: t.id, kind: "PULL_FINALS", status: "PENDING" },
      { tenantId: t.id, kind: "STAGE_PROJECT", status: "PENDING", payload: { templateKey: "onboarding" } },
    ],
  });
  // Optional: create the client's login so they can use the app immediately.
  const contactEmail = str(formData, "contactEmail").toLowerCase();
  const contactName = str(formData, "contactName");
  let pwParam = "";
  if (contactEmail && !(await prisma.user.findUnique({ where: { email: contactEmail } }))) {
    const tempPassword = str(formData, "clientPassword") || `Provecta-${Math.random().toString(36).slice(2, 8)}`;
    await prisma.user.create({
      data: { email: contactEmail, name: contactName || name, passwordHash: await hash(tempPassword), role: "CLIENT", tenantId: t.id },
    });
    pwParam = `?login=${encodeURIComponent(contactEmail)}&pw=${encodeURIComponent(tempPassword)}`;
  }
  // Optional: capture consultation / discovery notes as the first transcript.
  const notes = str(formData, "notes");
  if (notes) {
    await prisma.transcript.create({ data: { tenantId: t.id, title: `${name} — initial consultation`, body: notes, source: "DISCOVERY_CALL" } });
  }
  // Optional: upload discovery transcript file(s) to seed the engagement. Each
  // file is stored as an internal Document; text-decodable ones (txt/md/vtt/srt/
  // csv/json) also become a Transcript so they ground the bRRAIn plan/proposal
  // generation. Binary files (pdf/docx) are attached but not text-extracted.
  const files = formData.getAll("transcriptFiles").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const fname = file.name || "transcript";
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const stored = await storeFile(fname, bytes, contentType);
    await prisma.document.create({
      data: {
        tenantId: t.id, name: fname, kind: "TRANSCRIPT", mimeType: contentType,
        url: stored.ref, sizeBytes: stored.sizeBytes, source: "HUMAN", clientVisible: false,
      },
    });
    const text = decodeTextFile(bytes, contentType, fname);
    if (text) {
      await prisma.transcript.create({
        data: { tenantId: t.id, title: fname.replace(/\.[^.]+$/, ""), body: text, source: "UPLOAD" },
      });
    }
  }
  await audit(admin.id, "CLIENT_CREATE", "Tenant", t.id, preferredChannel ? `${name} · ${preferredChannel}` : name);
  kickAgentTick(); // drain the staging (+ proposal if a transcript was provided) now
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${t.id}${pwParam}`);
}

// Hard-delete a client/prospect and its entire object graph (SUPER_ADMIN only).
// Irreversible — the confirm lives in the UI.
export async function deleteClient(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") return;
  const tenantId = str(formData, "tenantId");
  if (!tenantId) return;
  const r = await deleteTenant(tenantId);
  if (r.ok) await audit(admin.id, "CLIENT_DELETE", "Tenant", tenantId, r.name);
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

// ── User access controls (SUPER_ADMIN / ADMIN) ─────────────────────────
export async function resetUserPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!SUPER_ROLES.has(admin.role)) return;
  const userId = str(formData, "userId");
  const returnTo = str(formData, "returnTo") || "/admin/users";
  if (!userId) return;
  const r = await resetUserPassword(userId);
  if (r.ok) {
    await audit(admin.id, "USER_PASSWORD_RESET", "User", userId, r.email);
    redirect(`${returnTo}?pwuser=${encodeURIComponent(r.email!)}&pw=${encodeURIComponent(r.password!)}`);
  }
  redirect(returnTo);
}

export async function setUserBlockedAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!SUPER_ROLES.has(admin.role)) return;
  const userId = str(formData, "userId");
  const blocked = str(formData, "blocked") === "true";
  const returnTo = str(formData, "returnTo") || "/admin/users";
  if (!userId || userId === admin.id) return; // never block yourself
  await setUserBlocked(userId, blocked);
  await audit(admin.id, blocked ? "USER_BLOCKED" : "USER_UNBLOCKED", "User", userId);
  revalidatePath(returnTo);
  redirect(returnTo);
}

// ── Document upload (web back office) ──────────────────────────────────
export async function uploadClientDocument(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  const file = formData.get("file");
  if (!tenantId || !(file instanceof File) || file.size === 0) return;

  const name = str(formData, "name") || file.name || "document";
  const kind = str(formData, "kind") || "DOCUMENT";
  const engagementId = str(formData, "engagementId") || null;
  const clientVisible = String(formData.get("clientVisible") ?? "on") !== "off";
  const isFinal = formData.get("isFinal") != null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const stored = await storeFile(name, bytes, contentType);

  const doc = await prisma.document.create({
    data: {
      tenantId, engagementId, name, kind, mimeType: contentType,
      url: stored.ref, sizeBytes: stored.sizeBytes, isFinal, clientVisible, source: "HUMAN",
    },
  });
  await audit(admin.id, "DOCUMENT_UPLOAD", "Document", doc.id, name);
  revalidatePath(`/admin/clients/${tenantId}`);
}

// Approve a brain-pulled document for client visibility (client-approval finality).
export async function approveDocument(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  await prisma.document.update({ where: { id }, data: { clientVisible: true } });
  await audit(admin.id, "DOCUMENT_APPROVE", "Document", id);
  revalidatePath("/admin/brain");
}

// ── Engagements ───────────────────────────────────────────────────────
export async function createEngagement(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  const name = str(formData, "name");
  if (!tenantId || !name) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;
  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const eng = await prisma.engagement.create({
    data: {
      tenantId,
      name,
      code,
      status: str(formData, "status") || "ACTIVE",
      summary: str(formData, "summary") || null,
      budgetMinor: dollarsToMinor(formData, "budget"),
      currency: str(formData, "currency") || "USD",
      startDate: dateOrNull(formData, "startDate"),
      targetEndDate: dateOrNull(formData, "targetEndDate"),
      charter: str(formData, "objectives")
        ? { create: { objectives: str(formData, "objectives"), sponsor: str(formData, "sponsor") || tenant.name } }
        : undefined,
    },
  });
  await audit(admin.id, "ENGAGEMENT_CREATE", "Engagement", eng.id, code);
  redirect(`/admin/engagements/${eng.id}`);
}

export async function editEngagement(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  await prisma.engagement.update({
    where: { id },
    data: {
      name: str(formData, "name") || undefined,
      summary: str(formData, "summary") || null,
      budgetMinor: dollarsToMinor(formData, "budget"),
      startDate: dateOrNull(formData, "startDate"),
      targetEndDate: dateOrNull(formData, "targetEndDate"),
    },
  });
  await audit(admin.id, "ENGAGEMENT_EDIT", "Engagement", id);
  revalidatePath(`/admin/engagements/${id}`);
}

// ── Milestones & tasks ────────────────────────────────────────────────
export async function addMilestone(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  if (!engagementId || !title) return;
  const count = await prisma.milestone.count({ where: { engagementId } });
  const m = await prisma.milestone.create({
    data: {
      engagementId,
      title,
      description: str(formData, "description") || null,
      dueDate: dateOrNull(formData, "dueDate"),
      orderIndex: count + 1,
    },
  });
  await audit(admin.id, "MILESTONE_CREATE", "Milestone", m.id, title);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function addTask(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  if (!engagementId || !title) return;
  await prisma.task.create({
    data: {
      engagementId,
      milestoneId: str(formData, "milestoneId") || null,
      title,
      priority: str(formData, "priority") || "MEDIUM",
    },
  });
  await audit(admin.id, "TASK_CREATE", "Task", engagementId, title);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

// ── KPIs & SLAs ───────────────────────────────────────────────────────
export async function addKpi(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const label = str(formData, "label");
  if (!engagementId || !label) return;
  await prisma.kpi.create({
    data: {
      engagementId,
      label,
      value: Number(formData.get("value")) || 0,
      unit: str(formData, "unit") || null,
      target: formData.get("target") ? Number(formData.get("target")) : null,
    },
  });
  await audit(admin.id, "KPI_CREATE", "Kpi", engagementId, label);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function addSla(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const metric = str(formData, "metric");
  if (!engagementId || !metric) return;
  await prisma.sla.create({
    data: {
      engagementId,
      metric,
      target: str(formData, "target") || "—",
      status: str(formData, "status") || "MEETING",
    },
  });
  await audit(admin.id, "SLA_CREATE", "Sla", engagementId, metric);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

// ── Deliverables (P4) ─────────────────────────────────────────────────
const DELIVERABLE_KINDS = ["DELIVERABLE", "AUDIT", "ARCHITECTURE", "BUILD", "REPORT"];

export async function addDeliverable(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  if (!engagementId || !title) return;
  const kind = str(formData, "kind");
  const count = await prisma.deliverable.count({ where: { engagementId } });
  const d = await prisma.deliverable.create({
    data: {
      engagementId,
      milestoneId: str(formData, "milestoneId") || null,
      title,
      kind: DELIVERABLE_KINDS.includes(kind) ? kind : "DELIVERABLE",
      orderIndex: count + 1,
      clientVisible: false, // starts internal until reviewed & published
    },
  });
  await audit(admin.id, "DELIVERABLE_CREATE", "Deliverable", d.id, title);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

// Operator review → publish: mark DELIVERED and make it client-visible.
export async function publishDeliverable(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const engagementId = str(formData, "engagementId");
  if (!id) return;
  await prisma.deliverable.update({
    where: { id },
    data: { status: "DELIVERED", clientVisible: true },
  });
  await audit(admin.id, "DELIVERABLE_PUBLISH", "Deliverable", id);
  if (engagementId) revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function deleteDeliverable(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const engagementId = str(formData, "engagementId");
  if (!id) return;
  await prisma.deliverable.delete({ where: { id } });
  await audit(admin.id, "DELIVERABLE_DELETE", "Deliverable", id);
  if (engagementId) revalidatePath(`/admin/engagements/${engagementId}`);
}

// ── Invoices ──────────────────────────────────────────────────────────
export async function createInvoice(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  if (!tenantId) return;
  const count = await prisma.invoice.count();
  const number = `INV-2026-${String(count + 1).padStart(4, "0")}`;
  const inv = await prisma.invoice.create({
    data: {
      tenantId,
      engagementId: str(formData, "engagementId") || null,
      number,
      status: str(formData, "status") || "DRAFT",
      amountMinor: dollarsToMinor(formData, "amount"),
      currency: str(formData, "currency") || "USD",
      method: str(formData, "method") || null,
      issuedAt: new Date(),
      dueAt: dateOrNull(formData, "dueAt"),
    },
  });
  await audit(admin.id, "INVOICE_CREATE", "Invoice", inv.id, number);
  revalidatePath("/admin/invoices");
}

// ── Tickets (admin-created) ───────────────────────────────────────────
export async function createTicketAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  const subject = str(formData, "subject");
  if (!tenantId || !subject) return;
  const engagement = await prisma.engagement.findFirst({ where: { tenantId } });
  const t = await prisma.ticket.create({
    data: {
      tenantId,
      engagementId: engagement?.id,
      subject,
      channel: str(formData, "channel") || "PORTAL",
      status: "OPEN",
      priority: str(formData, "priority") || "MEDIUM",
      autonomyState: "SUGGEST",
      proposedAction: "Triage pending.",
    },
  });
  await audit(admin.id, "TICKET_CREATE", "Ticket", t.id, "admin");
  revalidatePath("/admin/tickets");
}
