-- DropForeignKey
ALTER TABLE "Publication" DROP CONSTRAINT "Publication_taskId_fkey";

-- AlterTable: taskId nullable + clientId за account-ниво (backfill) објави.
ALTER TABLE "Publication" ADD COLUMN     "clientId" UUID,
ALTER COLUMN "taskId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Партиален unique за backfill-ирани (account-ниво) објави: една по (clientId, platform, externalRef).
CREATE UNIQUE INDEX "publication_backfill_unique" ON "Publication" ("clientId", "platform", "externalRef") WHERE "taskId" IS NULL;
