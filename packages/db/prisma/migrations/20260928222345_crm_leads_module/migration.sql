-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('novLid', 'analiza', 'ponudaIzr', 'ponudaOdob', 'ponudaKlient', 'sostanok', 'dogIzr', 'dogOdob', 'dogKlient', 'strategija', 'aktivacija', 'aktiviran', 'izguben');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'sales';

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "name" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'novLid',
    "source" TEXT NOT NULL,
    "agentId" UUID NOT NULL,
    "person" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "pkgHint" TEXT NOT NULL DEFAULT '—',
    "pkgVideos" INTEGER NOT NULL DEFAULT 0,
    "pkgGraphics" INTEGER NOT NULL DEFAULT 0,
    "pkgMeta" BOOLEAN NOT NULL DEFAULT false,
    "pkgStart" TEXT,
    "pkgMonths" INTEGER NOT NULL DEFAULT 0,
    "pkgCalType" "CalendarType" NOT NULL DEFAULT 'specificen',
    "meetingDate" TIMESTAMP(3),
    "meetingTime" TEXT,
    "meetingPlace" TEXT,
    "meetingHeld" BOOLEAN NOT NULL DEFAULT false,
    "meetingNotes" TEXT,
    "meetingAudioFileId" UUID,
    "analysisFileId" UUID,
    "signedFileId" UUID,
    "strategyFileId" UUID,
    "fableFileId" UUID,
    "lostFromStatus" "LeadStatus",
    "lossReason" TEXT,
    "lossNote" TEXT,
    "team" JSONB,
    "activatedClientId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadOffer" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "leadId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "fileId" UUID,
    "ret" TEXT,
    "clientRet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContract" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "leadId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "fileId" UUID,
    "ret" TEXT,
    "clientRet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlanEntry" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "leadId" UUID NOT NULL,
    "monthKey" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Lead_tenantId_agentId_idx" ON "Lead"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "LeadOffer_tenantId_leadId_idx" ON "LeadOffer"("tenantId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadOffer_leadId_version_key" ON "LeadOffer"("leadId", "version");

-- CreateIndex
CREATE INDEX "LeadContract_tenantId_leadId_idx" ON "LeadContract"("tenantId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadContract_leadId_version_key" ON "LeadContract"("leadId", "version");

-- CreateIndex
CREATE INDEX "ContentPlanEntry_tenantId_leadId_idx" ON "ContentPlanEntry"("tenantId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlanEntry_leadId_monthKey_day_key" ON "ContentPlanEntry"("leadId", "monthKey", "day");

-- AddForeignKey
ALTER TABLE "LeadOffer" ADD CONSTRAINT "LeadOffer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContract" ADD CONSTRAINT "LeadContract_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanEntry" ADD CONSTRAINT "ContentPlanEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
