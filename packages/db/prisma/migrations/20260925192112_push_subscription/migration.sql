-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "employeeId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_employeeId_idx" ON "PushSubscription"("tenantId", "employeeId");
