-- DB-backed file store (fallback before Vercel Blob is keyed) + Document mime type.
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Document" ADD COLUMN "mimeType" TEXT;
