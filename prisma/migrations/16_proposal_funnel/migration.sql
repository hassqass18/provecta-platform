-- Proposal acquisition funnel: public accept-link token + declined timestamp.
-- (Document.kind / IngestJob.kind gain RESEARCH/CONTRACT values — free-text
--  string columns, no DDL needed.)
ALTER TABLE "Proposal" ADD COLUMN "declinedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "acceptToken" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "acceptTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Proposal_acceptToken_key" ON "Proposal"("acceptToken");
