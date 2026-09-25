-- CreateTable
CREATE TABLE "MonthlyPlan" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "monthKey" TEXT NOT NULL,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPlanClient" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "monthlyPlanId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MonthlyPlanClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyPlan_tenantId_monthKey_idx" ON "MonthlyPlan"("tenantId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPlan_tenantId_monthKey_key" ON "MonthlyPlan"("tenantId", "monthKey");

-- CreateIndex
CREATE INDEX "MonthlyPlanClient_tenantId_clientId_idx" ON "MonthlyPlanClient"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPlanClient_monthlyPlanId_clientId_key" ON "MonthlyPlanClient"("monthlyPlanId", "clientId");

-- AddForeignKey
ALTER TABLE "MonthlyPlanClient" ADD CONSTRAINT "MonthlyPlanClient_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
