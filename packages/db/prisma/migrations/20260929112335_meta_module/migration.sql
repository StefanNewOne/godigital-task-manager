-- CreateEnum
CREATE TYPE "MetaConnKind" AS ENUM ('adAccount', 'page', 'igAccount', 'pixel', 'catalog');

-- CreateEnum
CREATE TYPE "MetaAccessLevel" AS ENUM ('write', 'read', 'none');

-- CreateEnum
CREATE TYPE "ObjectiveKey" AS ENUM ('msg', 'thru', 'cart', 'buy', 'reach', 'traffic', 'lead', 'leadWeb');

-- CreateEnum
CREATE TYPE "MetaInsightLevel" AS ENUM ('campaign', 'adset', 'ad');

-- CreateEnum
CREATE TYPE "MetaConvChannel" AS ENUM ('messenger', 'instagram');

-- CreateEnum
CREATE TYPE "MetaCommentParent" AS ENUM ('ad', 'post');

-- CreateEnum
CREATE TYPE "MetaAlertSeverity" AS ENUM ('crit', 'high', 'mid', 'info');

-- CreateEnum
CREATE TYPE "MetaAlertState" AS ENUM ('new', 'seen', 'snoozed', 'resolved');

-- CreateEnum
CREATE TYPE "MetaPlanOp" AS ENUM ('O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'O11', 'O12');

-- CreateEnum
CREATE TYPE "MetaPlanStatus" AS ENUM ('pending', 'approved', 'syncing', 'done', 'rejected', 'mismatch', 'withdrawn');

-- CreateEnum
CREATE TYPE "MetaPlanVia" AS ENUM ('manual', 'assistant');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "metaCprAlertPct" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "metaFreqThreshold" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
ADD COLUMN     "metaMaxDailyBudget" DECIMAL(12,2),
ADD COLUMN     "metaNamingConvention" TEXT,
ADD COLUMN     "metaNotes" TEXT,
ADD COLUMN     "metaTargetMetric" TEXT,
ADD COLUMN     "metaTargetText" TEXT,
ADD COLUMN     "metaTargetValue" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "thumbnailFileId" UUID;

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "kind" "MetaConnKind" NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "accessLevel" "MetaAccessLevel" NOT NULL DEFAULT 'read',
    "igMessagesEnabled" BOOLEAN,
    "spendCap" DECIMAL(14,2),
    "amountSpent" DECIMAL(14,2),
    "accountStatus" TEXT,
    "disableReason" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "syncFailCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCampaign" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "objectiveKey" "ObjectiveKey",
    "buyingType" TEXT,
    "budgetStrategy" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "bidStrategy" TEXT,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "pausedExternally" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdSet" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "campaignId" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "optimizationGoal" TEXT,
    "conversionLocation" TEXT,
    "destination" TEXT,
    "targeting" JSONB,
    "placements" JSONB,
    "learningStage" TEXT,
    "learningStageSince" TIMESTAMP(3),
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAd" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "adSetId" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "reviewStatus" TEXT,
    "reviewFeedback" JSONB,
    "creativeId" TEXT,
    "sourcePostMetaId" TEXT,
    "publicationId" UUID,
    "cta" TEXT,
    "messageTemplate" TEXT,
    "enhancements" JSONB,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaInsightDaily" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "level" "MetaInsightLevel" NOT NULL,
    "objectMetaId" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "frequency" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "results" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "resultType" TEXT,
    "actions" JSONB,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MetaInsightDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaConversation" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "metaThreadId" TEXT NOT NULL,
    "channel" "MetaConvChannel" NOT NULL,
    "participantName" TEXT,
    "sourceAdMetaId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "waitingSince" TIMESTAMP(3),
    "topic" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaMessage" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "conversationId" UUID NOT NULL,
    "metaMessageId" TEXT NOT NULL,
    "fromPage" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT,
    "sentAt" TIMESTAMP(3),
    "viaTemplate" TEXT,
    "bodyPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaComment" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "metaCommentId" TEXT NOT NULL,
    "parentObjectType" "MetaCommentParent" NOT NULL,
    "parentMetaId" TEXT NOT NULL,
    "publicationId" UUID,
    "adId" UUID,
    "authorName" TEXT,
    "text" TEXT,
    "createdTime" TIMESTAMP(3),
    "isQuestion" BOOLEAN NOT NULL DEFAULT false,
    "isComplaint" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAlert" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "MetaAlertSeverity" NOT NULL,
    "objectType" TEXT,
    "objectMetaId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "deepLink" JSONB,
    "state" "MetaAlertState" NOT NULL DEFAULT 'new',
    "snoozedUntil" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaChangePlan" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "op" "MetaPlanOp" NOT NULL,
    "target" JSONB NOT NULL,
    "params" JSONB,
    "before" JSONB,
    "after" JSONB,
    "consequences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MetaPlanStatus" NOT NULL DEFAULT 'pending',
    "createdById" UUID NOT NULL,
    "createdVia" "MetaPlanVia" NOT NULL DEFAULT 'manual',
    "command" TEXT,
    "note" TEXT,
    "rejectNote" TEXT,
    "taskId" UUID,
    "promotionId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "markedDoneAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaChangePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaConnection_tenantId_clientId_idx" ON "MetaConnection"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_clientId_kind_metaId_key" ON "MetaConnection"("clientId", "kind", "metaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCampaign_metaId_key" ON "MetaCampaign"("metaId");

-- CreateIndex
CREATE INDEX "MetaCampaign_tenantId_clientId_idx" ON "MetaCampaign"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdSet_metaId_key" ON "MetaAdSet"("metaId");

-- CreateIndex
CREATE INDEX "MetaAdSet_tenantId_campaignId_idx" ON "MetaAdSet"("tenantId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAd_metaId_key" ON "MetaAd"("metaId");

-- CreateIndex
CREATE INDEX "MetaAd_tenantId_adSetId_idx" ON "MetaAd"("tenantId", "adSetId");

-- CreateIndex
CREATE INDEX "MetaAd_publicationId_idx" ON "MetaAd"("publicationId");

-- CreateIndex
CREATE INDEX "MetaInsightDaily_tenantId_clientId_date_idx" ON "MetaInsightDaily"("tenantId", "clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaInsightDaily_level_objectMetaId_date_key" ON "MetaInsightDaily"("level", "objectMetaId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConversation_metaThreadId_key" ON "MetaConversation"("metaThreadId");

-- CreateIndex
CREATE INDEX "MetaConversation_tenantId_clientId_idx" ON "MetaConversation"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaMessage_metaMessageId_key" ON "MetaMessage"("metaMessageId");

-- CreateIndex
CREATE INDEX "MetaMessage_tenantId_conversationId_idx" ON "MetaMessage"("tenantId", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaComment_metaCommentId_key" ON "MetaComment"("metaCommentId");

-- CreateIndex
CREATE INDEX "MetaComment_tenantId_clientId_idx" ON "MetaComment"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAlert_dedupeKey_key" ON "MetaAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "MetaAlert_tenantId_clientId_state_idx" ON "MetaAlert"("tenantId", "clientId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "MetaChangePlan_idempotencyKey_key" ON "MetaChangePlan"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MetaChangePlan_tenantId_clientId_status_idx" ON "MetaChangePlan"("tenantId", "clientId", "status");

-- CreateIndex
CREATE INDEX "MetaChangePlan_tenantId_createdById_idx" ON "MetaChangePlan"("tenantId", "createdById");

-- AddForeignKey
ALTER TABLE "MetaCampaign" ADD CONSTRAINT "MetaCampaign_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdSet" ADD CONSTRAINT "MetaAdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "MetaAdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaMessage" ADD CONSTRAINT "MetaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MetaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
