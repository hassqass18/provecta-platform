-- Drill-down depth + client collaboration (comments / approvals).

-- Milestone: deep phase content + client sign-off state.
ALTER TABLE "Milestone" ADD COLUMN "detail" TEXT;
ALTER TABLE "Milestone" ADD COLUMN "phaseSummary" TEXT;
ALTER TABLE "Milestone" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'NONE';

-- Deliverable: nest under a milestone + rich write-up + sign-off state.
ALTER TABLE "Deliverable" ADD COLUMN "milestoneId" TEXT;
ALTER TABLE "Deliverable" ADD COLUMN "detail" TEXT;
ALTER TABLE "Deliverable" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'DELIVERABLE';
ALTER TABLE "Deliverable" ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Deliverable" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Deliverable" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "Deliverable" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Document: optional filing under a phase / deliverable.
ALTER TABLE "Document" ADD COLUMN "milestoneId" TEXT;
ALTER TABLE "Document" ADD COLUMN "deliverableId" TEXT;

-- Comments.
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Comment_targetType_targetId_idx" ON "Comment"("targetType", "targetId");
CREATE INDEX "Comment_tenantId_idx" ON "Comment"("tenantId");

-- Approvals.
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Approval_targetType_targetId_idx" ON "Approval"("targetType", "targetId");
CREATE INDEX "Approval_tenantId_idx" ON "Approval"("tenantId");
