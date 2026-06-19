import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";
import { brainGitConfig } from "@/lib/brain-git";
import { ingestTenantFinals } from "@/server/brain/ingest";
import { prisma } from "@/lib/db";

// Scheduled reconcile: re-ingest FINAL deliverables for every brain-backed
// tenant (drift safety net alongside the push webhook). Inert until configured.

export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;

  const cfg = brainGitConfig();
  const repo = await prisma.brainRepo.findFirst();
  if (!cfg || !repo) return NextResponse.json({ skipped: "brain git not configured" });

  const tenants = await prisma.tenant.findMany({ where: { brainFolder: { not: null } } });
  const results: Array<Record<string, unknown>> = [];

  for (const tenant of tenants) {
    try {
      const result = await ingestTenantFinals(tenant.id);
      results.push({ tenant: tenant.id, ...result });
    } catch (e) {
      results.push({ tenant: tenant.id, error: String(e) });
    }
  }

  try {
    await prisma.brainRepo.update({ where: { id: repo.id }, data: { lastSyncedAt: new Date() } });
  } catch {
    // Non-fatal: a failed timestamp update must not fail the reconcile.
  }

  return NextResponse.json({ ok: true, results });
}
