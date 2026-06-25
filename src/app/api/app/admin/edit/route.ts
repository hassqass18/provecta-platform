import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { resolveTarget } from "@/server/collab";
import { notifyTenantClients } from "@/server/notifications/fanout";

// Admin edit of any engagement object. Whitelisted fields per entity; a
// client-visible change (status / visibility) notifies the client.
const schema = z.object({
  entity: z.enum(["MILESTONE", "DELIVERABLE", "TASK", "DOCUMENT"]),
  id: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
});

const ALLOWED: Record<string, string[]> = {
  MILESTONE: ["title", "detail", "phaseSummary", "status", "dueDate", "clientVisible", "approvalStatus"],
  DELIVERABLE: ["title", "detail", "kind", "status", "isFinal", "clientVisible", "approvalStatus"],
  TASK: ["title", "status"],
  DOCUMENT: ["name", "isFinal", "clientVisible"],
};

function clean(entity: string, fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED[entity]) {
    if (!(k in fields)) continue;
    let v = fields[k];
    if (k === "dueDate") v = v ? new Date(String(v)) : null;
    out[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid edit." }, { status: 400 });
  const { entity, id, fields } = parsed.data;
  const data = clean(entity, fields);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No editable fields." }, { status: 400 });

  if (entity === "MILESTONE") {
    if (data.status === "COMPLETED") data.completedAt = new Date();
    await prisma.milestone.update({ where: { id }, data });
  } else if (entity === "DELIVERABLE") {
    await prisma.deliverable.update({ where: { id }, data });
  } else if (entity === "TASK") {
    await prisma.task.update({ where: { id }, data });
  } else {
    await prisma.document.update({ where: { id }, data });
  }

  // Notify the client when something they can see changes.
  if ("status" in data || "clientVisible" in data || "isFinal" in data) {
    const ttype = entity === "TASK" || entity === "DOCUMENT" ? null : (entity as "MILESTONE" | "DELIVERABLE");
    if (ttype) {
      const ref = await resolveTarget(ttype, id);
      if (ref) await notifyTenantClients(ref.tenantId, "UPDATE", `Provecta updated “${ref.label}”`);
    }
  }
  return NextResponse.json({ ok: true });
}
