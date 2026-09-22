-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('dir', 'am', 'rez', 'scen', 'kam', 'mon', 'krea', 'diz', 'ana');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('video', 'graphic');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('aktiven', 'pauza', 'zavrsen');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('standarden', 'specificen');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('viber', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('mrtov', 'cekaSnimanje', 'brifing', 'dizajn', 'chekaRezija', 'montaza', 'vnatresno', 'kajKlient', 'zaObjavuvanje', 'objaveno', 'analitika', 'zavrseno', 'pauza', 'otkazano');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('podgotovka', 'scenarija', 'scenKajKlient', 'snimanje', 'gPodgotovka', 'zatvoren');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('predlog', 'free', 'reserved', 'used', 'missed');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('predlozeno', 'odobreno', 'odobrenoSoIzmeni', 'otfrleno');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('normalen', 'iten');

-- CreateEnum
CREATE TYPE "HolidayScope" AS ENUM ('global', 'client');

-- CreateEnum
CREATE TYPE "PublicationPlatform" AS ENUM ('fb', 'ig', 'tiktok');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('reel', 'post', 'story', 'carousel');

-- CreateEnum
CREATE TYPE "ResolveStatus" AS ENUM ('pending', 'resolved', 'failed', 'manual');

-- CreateEnum
CREATE TYPE "ApprovalObjectType" AS ENUM ('task', 'scenario', 'group');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('internal', 'client');

-- CreateEnum
CREATE TYPE "ApprovalOutcome" AS ENUM ('approved', 'approvedWithChanges', 'rejected', 'returned');

-- CreateEnum
CREATE TYPE "ApprovalSource" AS ENUM ('employee', 'clientPwa');

-- CreateEnum
CREATE TYPE "RevisionSource" AS ENUM ('internal', 'client');

-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('comment', 'systemNote');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('planned', 'active', 'closed');

-- CreateEnum
CREATE TYPE "PromotionDecision" AS ENUM ('organic', 'paid');

-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('group', 'task', 'revision', 'approval', 'comment');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('raw', 'final', 'graphic', 'scenarioDoc', 'briefRef', 'sharedMaterial', 'screenshot', 'preview', 'logo');

-- CreateEnum
CREATE TYPE "FileLifecycle" AS ENUM ('active', 'scheduledDeletion', 'deleted', 'archivedLocally');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('open', 'completed', 'aborted');

-- CreateEnum
CREATE TYPE "DeadlineScope" AS ENUM ('global', 'client');

-- CreateEnum
CREATE TYPE "DeadlineTarget" AS ENUM ('task', 'group');

-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('goScripterAi', 'graficarAi', 'aiCopywriter', 'claudeAssistant');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('potsetnik', 'alarm', 'kritichen');

-- CreateEnum
CREATE TYPE "OutboxKind" AS ENUM ('realtime', 'knowledge', 'notification');

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('clientProfile', 'scenario', 'brief', 'copy', 'clientFeedback', 'internalFeedback', 'comment', 'eventNarrative', 'metricSummary', 'processDoc', 'ruleDoc');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('internal', 'clientVisible');

-- CreateEnum
CREATE TYPE "EmbStatus" AS ENUM ('pending', 'done', 'failed', 'stale');

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "logoFileId" UUID,
    "color" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'aktiven',
    "contractStart" DATE NOT NULL,
    "contractMonths" INTEGER NOT NULL,
    "videosPerMonth" INTEGER NOT NULL DEFAULT 0,
    "graphicsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "usesMetaAds" BOOLEAN NOT NULL DEFAULT false,
    "metaAdAccountId" TEXT,
    "metaPageId" TEXT,
    "metaIgId" TEXT,
    "calendarType" "CalendarType" NOT NULL DEFAULT 'standarden',
    "approvalChannel" "Channel" NOT NULL DEFAULT 'viber',
    "coverageAlarmDays" INTEGER NOT NULL DEFAULT 7,
    "notes" TEXT,
    "defaultAssignees" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "roleAtClient" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isApprover" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "isScenaristToo" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacityNote" TEXT,
    "notificationPrefs" JSONB,
    "lastActiveAt" TIMESTAMP(3),
    "createdById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConfig" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "weekdays" INTEGER[],
    "publishTime" TEXT NOT NULL,
    "allowTwoPerDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "HolidayScope" NOT NULL DEFAULT 'global',
    "clientId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingSlot" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "date" DATE NOT NULL,
    "orderInDay" INTEGER NOT NULL DEFAULT 1,
    "status" "SlotStatus" NOT NULL DEFAULT 'predlog',
    "monthKey" TEXT NOT NULL,
    "carriedFromMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGroup" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" "GroupStatus" NOT NULL,
    "plannedCount" INTEGER NOT NULL DEFAULT 0,
    "scenaristId" UUID,
    "rezId" UUID,
    "kamId" UUID,
    "shootDate" TIMESTAMP(3),
    "shootLocation" TEXT,
    "scenaristNotes" TEXT,
    "scenarioDocVersion" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "rawDeleteAt" TIMESTAMP(3),
    "rawExtendedTimes" INTEGER NOT NULL DEFAULT 0,
    "localArchivePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "groupId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleIsAuto" BOOLEAN NOT NULL DEFAULT true,
    "status" "TaskStatus" NOT NULL,
    "pausedFromStatus" "TaskStatus",
    "slotId" UUID,
    "scenarioId" UUID,
    "assigneeId" UUID,
    "rezId" UUID,
    "kreaId" UUID,
    "brief" TEXT,
    "copy" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'normalen',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postUnavailable" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "pauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "groupId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "docVersion" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "body" TEXT,
    "notes" TEXT,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'predlozeno',
    "clientComment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "taskId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "returnedById" UUID,
    "role" "Role",
    "comment" TEXT NOT NULL,
    "source" "RevisionSource" NOT NULL,
    "fileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "objectType" "ApprovalObjectType" NOT NULL,
    "objectId" UUID NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "outcome" "ApprovalOutcome" NOT NULL,
    "enteredById" UUID,
    "enteredByRole" "Role",
    "onBehalfOfRole" "Role",
    "channel" "Channel",
    "comment" TEXT,
    "attachmentFileId" UUID,
    "source" "ApprovalSource" NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "taskId" UUID,
    "groupId" UUID,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[],
    "kind" "CommentKind" NOT NULL DEFAULT 'comment',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "taskId" UUID NOT NULL,
    "platform" "PublicationPlatform" NOT NULL,
    "postType" "PostType" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "permalink" TEXT,
    "externalRef" TEXT,
    "metaMediaId" TEXT,
    "resolveStatus" "ResolveStatus" NOT NULL DEFAULT 'pending',
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "metaCampaignId" TEXT,
    "objective" TEXT NOT NULL,
    "budget" DECIMAL(12,2) NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'planned',
    "analystId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "publicationId" UUID NOT NULL,
    "decision" "PromotionDecision" NOT NULL,
    "rationale" TEXT,
    "campaignId" UUID,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "publicationId" UUID,
    "campaignId" UUID,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    "reach" DECIMAL(14,2),
    "impressions" DECIMAL(14,2),
    "views" DECIMAL(14,2),
    "engagement" DECIMAL(14,2),
    "spend" DECIMAL(12,2),
    "cpr" DECIMAL(12,4),
    "ctr" DECIMAL(8,4),
    "frequency" DECIMAL(8,4),

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "ownerType" "FileOwnerType" NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "FileKind" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mime" TEXT NOT NULL,
    "version" INTEGER,
    "previewFileId" UUID,
    "lifecycle" "FileLifecycle" NOT NULL DEFAULT 'active',
    "deleteAt" TIMESTAMP(3),
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "fileAssetId" UUID NOT NULL,
    "r2UploadId" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateChange" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "taskId" UUID NOT NULL,
    "oldSlotId" UUID,
    "newSlotId" UUID,
    "reason" TEXT NOT NULL,
    "changedById" UUID,
    "changedByRole" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DateChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusDeadlineConfig" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "scope" "DeadlineScope" NOT NULL DEFAULT 'global',
    "clientId" UUID,
    "target" "DeadlineTarget" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "status" TEXT NOT NULL,
    "leadDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusDeadlineConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "clientId" UUID,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "ruleId" UUID NOT NULL,
    "taskId" UUID,
    "groupId" UUID,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "detail" JSONB,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleAssignment" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "clientId" UUID NOT NULL,
    "module" "ModuleKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" UUID,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "recipientId" UUID NOT NULL,
    "level" "NotificationLevel" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "taskId" UUID,
    "groupId" UUID,
    "clientId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channelsSent" JSONB,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "employeeId" UUID NOT NULL,
    "screen" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "eventType" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "clientId" UUID,
    "taskId" UUID,
    "groupId" UUID,
    "actorId" UUID,
    "actorRole" TEXT,
    "onBehalfOfRole" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oldValue" JSONB,
    "newValue" JSONB,
    "context" JSONB,
    "narrative" TEXT NOT NULL,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" UUID NOT NULL,
    "eventLogId" UUID NOT NULL,
    "kind" "OutboxKind" NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'godigital',
    "sourceType" "KnowledgeSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "clientId" UUID,
    "taskId" UUID,
    "groupId" UUID,
    "visibility" "Visibility" NOT NULL DEFAULT 'internal',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" vector(1024),
    "tsv" tsvector,
    "embeddingStatus" "EmbStatus" NOT NULL DEFAULT 'pending',
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConfig_clientId_contentType_key" ON "CalendarConfig"("clientId", "contentType");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_clientId_key" ON "Holiday"("date", "clientId");

-- CreateIndex
CREATE INDEX "PublishingSlot_clientId_monthKey_idx" ON "PublishingSlot"("clientId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingSlot_clientId_contentType_date_orderInDay_key" ON "PublishingSlot"("clientId", "contentType", "date", "orderInDay");

-- CreateIndex
CREATE UNIQUE INDEX "TaskGroup_clientId_contentType_monthKey_key" ON "TaskGroup"("clientId", "contentType", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "Task_slotId_key" ON "Task"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_scenarioId_key" ON "Task"("scenarioId");

-- CreateIndex
CREATE INDEX "Task_tenantId_status_idx" ON "Task"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_clientId_contentType_idx" ON "Task"("clientId", "contentType");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_groupId_ordinal_docVersion_key" ON "Scenario"("groupId", "ordinal", "docVersion");

-- CreateIndex
CREATE INDEX "Revision_taskId_idx" ON "Revision"("taskId");

-- CreateIndex
CREATE INDEX "Approval_objectType_objectId_idx" ON "Approval"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");

-- CreateIndex
CREATE INDEX "Comment_groupId_idx" ON "Comment"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_taskId_platform_key" ON "Publication"("taskId", "platform");

-- CreateIndex
CREATE INDEX "Campaign_clientId_idx" ON "Campaign"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_publicationId_key" ON "Promotion"("publicationId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_publicationId_capturedAt_idx" ON "MetricSnapshot"("publicationId", "capturedAt");

-- CreateIndex
CREATE INDEX "MetricSnapshot_campaignId_capturedAt_idx" ON "MetricSnapshot"("campaignId", "capturedAt");

-- CreateIndex
CREATE INDEX "FileAsset_ownerType_ownerId_idx" ON "FileAsset"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "DateChange_taskId_idx" ON "DateChange"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "StatusDeadlineConfig_scope_clientId_target_contentType_stat_key" ON "StatusDeadlineConfig"("scope", "clientId", "target", "contentType", "status");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_idx" ON "AutomationRule"("tenantId");

-- CreateIndex
CREATE INDEX "AutomationRun_ruleId_idx" ON "AutomationRun"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleAssignment_clientId_module_key" ON "ModuleAssignment"("clientId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "SavedView_employeeId_screen_idx" ON "SavedView"("employeeId", "screen");

-- CreateIndex
CREATE INDEX "EventLog_tenantId_objectType_objectId_idx" ON "EventLog"("tenantId", "objectType", "objectId");

-- CreateIndex
CREATE INDEX "EventLog_tenantId_occurredAt_idx" ON "EventLog"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "Outbox_kind_processedAt_idx" ON "Outbox"("kind", "processedAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_clientId_sourceType_occurredAt_idx" ON "KnowledgeChunk"("clientId", "sourceType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_sourceType_sourceId_contentHash_key" ON "KnowledgeChunk"("sourceType", "sourceId", "contentHash");

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConfig" ADD CONSTRAINT "CalendarConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingSlot" ADD CONSTRAINT "PublishingSlot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGroup" ADD CONSTRAINT "TaskGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PublishingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAssignment" ADD CONSTRAINT "ModuleAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_eventLogId_fkey" FOREIGN KEY ("eventLogId") REFERENCES "EventLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────── GoDigital инваријанти во база (CLAUDE.md §15.5, PRD §4.4) ───────────

-- isScenaristToo дозволено само за Режисер.
ALTER TABLE "Employee" ADD CONSTRAINT "employee_scenarist_only_rez"
  CHECK ("isScenaristToo" = false OR "role" = 'rez');

-- pgvector HNSW индекс за семантичко пребарување (Фаза B4).
CREATE INDEX "knowledge_chunk_embedding_hnsw" ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- GIN индекс за full-text (tsv).
CREATE INDEX "knowledge_chunk_tsv_gin" ON "KnowledgeChunk" USING gin ("tsv");

-- Append-only (EventLog/MetricSnapshot/Revision/Approval): без UPDATE/DELETE за app role.
-- ЗАБЕЛЕШКА (TD-5): бара двоуложен setup (app role ≠ owner). Во dev со единствен сопственички
-- role REVOKE нема ефект врз сопственикот; се активира во deployment фаза.
-- REVOKE UPDATE, DELETE ON "EventLog", "MetricSnapshot", "Revision", "Approval" FROM "gd_app";
