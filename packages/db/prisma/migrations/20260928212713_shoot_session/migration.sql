-- CreateEnum
CREATE TYPE "ShootKind" AS ENUM ('primary', 'additional');

-- CreateTable
CREATE TABLE "ShootSession" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "groupId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "kind" "ShootKind" NOT NULL DEFAULT 'additional',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShootSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShootSession_tenantId_date_idx" ON "ShootSession"("tenantId", "date");

-- CreateIndex
CREATE INDEX "ShootSession_groupId_idx" ON "ShootSession"("groupId");

-- AddForeignKey
ALTER TABLE "ShootSession" ADD CONSTRAINT "ShootSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
