-- CreateTable
CREATE TABLE "PageSnapshot" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followers" INTEGER,
    "engagement" INTEGER,
    "pageViews" INTEGER,
    "newFollows" INTEGER,
    "videoViews" INTEGER,
    "reactions" INTEGER,
    "raw" JSONB NOT NULL,

    CONSTRAINT "PageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageSnapshot_clientId_capturedAt_idx" ON "PageSnapshot"("clientId", "capturedAt");

-- AddForeignKey
ALTER TABLE "PageSnapshot" ADD CONSTRAINT "PageSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
