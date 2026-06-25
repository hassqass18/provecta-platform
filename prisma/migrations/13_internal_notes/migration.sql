-- Internal notes: staff-only comments never shown to clients.
ALTER TABLE "Comment" ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT false;
