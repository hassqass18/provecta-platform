import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { ingestTenantFinals } from "@/server/brain/ingest";
import { stageProjectFromTemplate } from "@/server/staging";
import { processEvent } from "@/server/agent/runner";
import { runProspectResearch } from "@/server/research/run";
import { generateProposalForEngagement } from "@/server/proposal/generate";
import { runContractIssue } from "@/server/contract/issue";

// Research / proposal jobs run the LLM (~50s) — allow the full window.
export const maxDuration = 60;

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
      } else if (job.kind === "RESEARCH" && job.tenantId) {
        const p = (job.payload as { company?: string; contact?: string; domain?: string; engagementId?: string } | null) ?? {};
        await runProspectResearch({
          tenantId: job.tenantId,
          engagementId: p.engagementId ?? null,
          input: { company: p.company ?? "Prospect", contact: p.contact ?? null, domain: p.domain ?? null },
        });
        // Chain proposal generation (separate invocation — two LLM calls won't
        // fit one 60s function) so the research brief grounds the proposal.
        if (p.engagementId) {
          await prisma.ingestJob.create({
            data: { tenantId: job.tenantId, kind: "PROPOSAL", status: "PENDING", payload: { engagementId: p.engagementId } },
          });
        }
      } else if (job.kind === "PROPOSAL") {
        const engagementId = (job.payload as { engagementId?: string } | null)?.engagementId;
        if (engagementId) await generateProposalForEngagement(engagementId);
      } else if (job.kind === "CONTRACT") {
        const engagementId = (job.payload as { engagementId?: string } | null)?.engagementId;
        if (engagementId) await runContractIssue(engagementId);
      }
      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "DONE" } });
      results.push({ id: job.id, kind: job.kind, status: "DONE" });
    } catch (e) {
      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: String(e) } });
      results.push({ id: job.id, kind: job.kind, status: "FAILED" });
    }
  }

  // P3A: drain the DomainEvent spine through the agent loop (planner→exec→critic).
  const events = await prisma.domainEvent.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10 });
  const agentRuns: { event: string; runStatus: string }[] = [];
  for (const ev of events) {
    const claimed = await prisma.domainEvent.updateMany({
      where: { id: ev.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    try {
      const r = await processEvent({ id: ev.id, type: ev.type, entity: ev.entity, entityId: ev.entityId, payload: ev.payload });
      await prisma.domainEvent.update({ where: { id: ev.id }, data: { status: "PROCESSED", processedAt: new Date() } });
      agentRuns.push({ event: ev.type, runStatus: r.status });
    } catch (e) {
      await prisma.domainEvent.update({ where: { id: ev.id }, data: { status: "FAILED", lastError: String(e) } });
      agentRuns.push({ event: ev.type, runStatus: "FAILED" });
    }
  }

  return NextResponse.json({ ok: true, drained: results.length, results, agentRuns });
}
