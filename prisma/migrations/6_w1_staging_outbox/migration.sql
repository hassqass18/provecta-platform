-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "stagedFromTemplateKey" TEXT;

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "baselineDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProjectTemplateMilestone" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "dayOffset" INTEGER NOT NULL DEFAULT 0,
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,

    CONSTRAINT "ProjectTemplateMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTemplateKpi" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "ProjectTemplateKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_tenantId_stagedFromTemplateKey_key" ON "Engagement"("tenantId", "stagedFromTemplateKey");

