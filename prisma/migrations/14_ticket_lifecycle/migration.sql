-- Ticket lifecycle: assignment + SLA timestamps.
ALTER TABLE "Ticket" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
