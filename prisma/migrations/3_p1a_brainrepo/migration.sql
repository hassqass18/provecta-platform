-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "brainFolder" TEXT;

-- CreateTable
CREATE TABLE "BrainRepo" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "pathPrefix" TEXT NOT NULL DEFAULT 'projects/staging',
    "finalConvention" TEXT NOT NULL DEFAULT 'FINAL_DIR_OR_FRONTMATTER',
    "lastSyncedSha" TEXT,
    "webhookSecret" TEXT,
    "authRef" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainRepo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrainRepo_owner_repo_branch_key" ON "BrainRepo"("owner", "repo", "branch");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_brainFolder_key" ON "Tenant"("brainFolder");

