-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "origin" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'HUMAN';

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "history" JSONB NOT NULL DEFAULT '[]',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "lastInboundAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_tenantId_channel_address_key" ON "ConversationState"("tenantId", "channel", "address");

