-- Block users out of the back office / client app.
ALTER TABLE "User" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
