import { prisma } from "@/lib/db";
import { brainGitConfig, listFinalsForFolder } from "@/lib/brain-git";

// P1A — ingest FINAL deliverables from the brain git repo into a tenant's
// document set. Firm/admin operation: uses the bypass `prisma` client (it spans
// BrainRepo + Tenant + Document). Brain docs are written source=BRAIN and
// clientVisible=false (await human approval — client-approval finality), and
// NEVER clobber source=HUMAN rows (P0-PROV).

export type IngestResult = {
  skipped?: string;
  finalsFound: number;
  created: number;
  updated: number;
  unchanged: number;
};

export async function ingestTenantFinals(tenantId: string): Promise<IngestResult> {
  const cfg = brainGitConfig();
  if (!cfg) return { skipped: "GITHUB_BRAIN_TOKEN/BRAIN_REPO_* not configured", finalsFound: 0, created: 0, updated: 0, unchanged: 0 };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.brainFolder) return { skipped: "tenant has no brainFolder", finalsFound: 0, created: 0, updated: 0, unchanged: 0 };

  const finals = await listFinalsForFolder(cfg, tenant.brainFolder);
  let created = 0, updated = 0, unchanged = 0;

  for (const f of finals) {
    const urlRef = `git:${f.fullPath}@${f.sha}`; // content-addressed: sha changes ⇒ new version
    const existing = await prisma.document.findFirst({
      where: { tenantId, name: f.name, source: "BRAIN" },
    });
    if (!existing) {
      await prisma.document.create({
        data: {
          tenantId,
          name: f.name,
          kind: f.name.toLowerCase().endsWith(".md") ? "DOCUMENT" : "MEDIA",
          isFinal: true,
          clientVisible: false, // await human approval
          source: "BRAIN",
          url: urlRef,
          sizeBytes: f.sizeBytes,
        },
      });
      created++;
    } else if (existing.url === urlRef) {
      unchanged++;
    } else {
      // Superseded final → new version. Never touch HUMAN rows (we filtered source=BRAIN).
      await prisma.document.update({
        where: { id: existing.id },
        data: { url: urlRef, version: existing.version + 1, sizeBytes: f.sizeBytes, isFinal: true },
      });
      updated++;
    }
  }

  await prisma.auditLog.create({
    data: { action: "BRAIN_INGEST", entity: "Tenant", entityId: tenantId, meta: `finals=${finals.length} created=${created} updated=${updated}` },
  });

  return { finalsFound: finals.length, created, updated, unchanged };
}
