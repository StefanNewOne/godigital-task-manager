-- Фаза D: magic-link токен за клиентски PWA (ClientContact). Само hash (§12), еднократен, TTL.
-- CreateTable
CREATE TABLE "ClientMagicToken" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientContactId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMagicToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientMagicToken_clientContactId_idx" ON "ClientMagicToken"("clientContactId");

-- CreateIndex
CREATE INDEX "ClientMagicToken_tenantId_idx" ON "ClientMagicToken"("tenantId");

-- AddForeignKey
ALTER TABLE "ClientMagicToken" ADD CONSTRAINT "ClientMagicToken_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
