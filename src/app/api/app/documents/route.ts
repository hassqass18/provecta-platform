import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// The engagement's document hub — every client-visible file + deliverable data,
// tagged with the phase (milestone) it belongs to so the app can group/filter.
// Brain-pulled finals stay hidden until a human approves (clientVisible=false).
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ documents: [] });

  const rows = await prisma.document.findMany({
    where: { tenantId: user.tenantId, clientVisible: true },
    orderBy: [{ isFinal: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const milestoneIds = [...new Set(rows.map((d) => d.milestoneId).filter(Boolean) as string[])];
  const milestones = milestoneIds.length
    ? await prisma.milestone.findMany({ where: { id: { in: milestoneIds } }, select: { id: true, title: true } })
    : [];
  const phaseOf = Object.fromEntries(milestones.map((m) => [m.id, m.title]));

  const documents = rows.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    version: d.version,
    isFinal: d.isFinal,
    signed: d.signed,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt,
    milestoneId: d.milestoneId,
    phase: d.milestoneId ? phaseOf[d.milestoneId] ?? null : null,
  }));
  return NextResponse.json({ documents });
}
