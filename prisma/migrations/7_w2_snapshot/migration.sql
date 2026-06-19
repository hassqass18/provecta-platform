-- CreateTable
CREATE TABLE "EngagementMetricSnapshot" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "milestonesComplete" INTEGER NOT NULL DEFAULT 0,
    "milestonesTotal" INTEGER NOT NULL DEFAULT 0,
    "budgetSpentMinor" INTEGER NOT NULL DEFAULT 0,
    "slaAttainmentPct" INTEGER NOT NULL DEFAULT 100,
    "openTickets" INTEGER NOT NULL DEFAULT 0,
    "daysRemaining" INTEGER,
    "ragOverall" TEXT NOT NULL DEFAULT 'GREEN',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngagementMetricSnapshot_engagementId_key" ON "EngagementMetricSnapshot"("engagementId");


-- P2A: RLS for the tenant-scoped snapshot (scope via parent engagement).
GRANT SELECT ON "EngagementMetricSnapshot" TO app_rls;
ALTER TABLE "EngagementMetricSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EngagementMetricSnapshot" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EngagementMetricSnapshot"
  USING ("engagementId" IN (SELECT "id" FROM "Engagement" WHERE "tenantId" = current_setting('app.current_org', true)));