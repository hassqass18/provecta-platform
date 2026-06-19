-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "prevHash" TEXT,
ADD COLUMN     "seq" INTEGER;

