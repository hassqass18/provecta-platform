import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { listComments } from "@/server/collab";
import { draftDeliverable, type DeliverableKind } from "@/lib/brain";
import { getEngagementMaterials } from "@/server/rag/engagement-context";
import { notifyTenantClients } from "@/server/notifications/fanout";

// Drafting a deliverable runs the LLM (~40s); allow the function the full window.
export const maxDuration = 60;

// Admin full review of a deliverable across ANY tenant — full write-up,
// attached documents, and the complete thread incl. internal notes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const d = await prisma.deliverable.findUnique({
    where: { id },
    include: { engagement: { select: { name: true, tenant: { select: { name: true } } } } },
  });
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [documents, comments] = await Promise.all([
    prisma.document.findMany({
      where: { OR: [{ deliverableId: id }, ...(d.documentId ? [{ id: d.documentId }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    listComments("DELIVERABLE", id, { includeInternal: true }),
  ]);

  return NextResponse.json({
    deliverable: {
      id: d.id, title: d.title, kind: d.kind, version: d.version, detail: d.detail,
      isFinal: d.isFinal, status: d.status, approvalStatus: d.approvalStatus,
      clientVisible: d.clientVisible, milestoneId: d.milestoneId, engagementId: d.engagementId,
      client: d.engagement.tenant.name, engagementName: d.engagement.name,
    },
    documents: documents.map((x) => ({ id: x.id, name: x.name, kind: x.kind, isFinal: x.isFinal, clientVisible: x.clientVisible, createdAt: x.createdAt })),
    comments,
  });
}

const actionSchema = z.object({ action: z.enum(["DRAFT", "PUBLISH"]) });

// Mobile cockpit P4 actions on a deliverable:
//  - DRAFT:   bRRAIn drafts/re-drafts the real content into Deliverable.detail
//             (internal — clientVisible is untouched until an operator publishes)
//  - PUBLISH: mark DELIVERED + visible to the client, and notify them
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const d = await prisma.deliverable.findUnique({
    where: { id },
    include: { engagement: { include: { charter: true, tenant: { select: { id: true } } } } },
  });
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (parsed.data.action === "PUBLISH") {
    await prisma.deliverable.update({ where: { id }, data: { status: "DELIVERED", clientVisible: true } });
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "DELIVERABLE_PUBLISH", entity: "Deliverable", entityId: id } });
    await notifyTenantClients(d.engagement.tenant.id, "UPDATE", `New deliverable available: ${d.title}`).catch(() => {});
    return NextResponse.json({ ok: true, status: "DELIVERED", clientVisible: true });
  }

  // DRAFT / re-draft — mirrors draftDeliverableAction on the web.
  const phase = d.milestoneId
    ? await prisma.milestone.findUnique({ where: { id: d.milestoneId }, select: { title: true } })
    : null;
  const materials = await getEngagementMaterials(d.engagementId, d.engagement.tenant.id, { maxChars: 14000 });
  const { detail, provider } = await draftDeliverable(
    {
      title: d.title,
      kind: d.kind as DeliverableKind,
      phaseTitle: phase?.title ?? null,
      engagementName: d.engagement.name,
      charter: d.engagement.charter,
      materials: materials || null,
    },
    { engagementId: d.engagementId },
  );
  await prisma.deliverable.update({ where: { id }, data: { detail } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "DELIVERABLE_DRAFTED", entity: "Deliverable", entityId: id, meta: `${provider} · ${detail.length} chars` } });
  const skeleton = detail.includes("Draft skeleton");
  return NextResponse.json({ ok: true, chars: detail.length, skeleton, detail });
}
