import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { ingestTenantFinals } from "@/server/brain/ingest";
import { stageProjectFromTemplate } from "@/server/staging";

// P1C outbox worker: drains PENDING IngestJobs (brain pulls + project staging +
// git-sync reconciles). Idempotent handlers; optimistic claim avoids double-drain
// across overlapping ticks. (The W3 agent loop will extend this with DomainEvents.)
export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;

  const jobs = await prisma.ingestJob.findMany({
    where: { status: "PENDING" },
    orderBy: { runAt: "asc" },
    take: 10,
  });

  const results: { id: string; kind: string; status: string }[] = [];
  for (const job of jobs) {
    // optimistic claim — only one tick processes a given job
    const claimed = await prisma.ingestJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    try {
      if (job.kind === "PULL_FINALS" && job.tenantId) {
        await ingestTenantFinals(job.tenantId);
      } else if (job.kind === "STAGE_PROJECT" && job.tenantId) {
        const templateKey = (job.payload as { templateKey?: string } | null)?.templateKey ?? "onboarding";
        await stageProjectFromTemplate(job.tenantId, templateKey);
      } else if (job.kind === "GIT_SYNC") {
        const tenants = await prisma.tenant.findMany({ where: { brainFolder: { not: null } } });
        for (const t of tenants) await ingestTenantFinals(t.id);
      }
      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "DONE" } });
      results.push({ id: job.id, kind: job.kind, status: "DONE" });
    } catch (e) {
      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: String(e) } });
      results.push({ id: job.id, kind: job.kind, status: "FAILED" });
    }
  }

  return NextResponse.json({ ok: true, drained: results.length, results });
}
