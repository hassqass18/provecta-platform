-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Kpi" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Sla" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'HUMAN';

