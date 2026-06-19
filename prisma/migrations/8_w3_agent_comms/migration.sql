-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actionCategory" TEXT NOT NULL,
    "riskClass" TEXT NOT NULL DEFAULT 'REVERSIBLE',
    "autonomyState" TEXT NOT NULL DEFAULT 'SUGGEST',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "inputJson" JSONB,
    "outputJson" JSONB,
    "criticScore" INTEGER,
    "auditLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "retries" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "brainQueryId" TEXT,
    "autonomyState" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentStep" ADD CONSTRAINT "AgentStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- P3B: RLS for the tenant-scoped Communication ledger (client mirror read).
GRANT SELECT ON "Communication" TO app_rls;
ALTER TABLE "Communication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Communication" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Communication"
  USING ("tenantId" = current_setting('app.current_org', true));