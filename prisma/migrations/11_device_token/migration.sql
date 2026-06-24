-- Mobile push: Expo device tokens for the native client app.
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_expoPushToken_key" ON "DeviceToken"("expoPushToken");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");
