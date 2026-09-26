-- DropForeignKey
ALTER TABLE "CalendarConfig" DROP CONSTRAINT "CalendarConfig_clientId_fkey";

-- AlterTable: clientId nullable (null = СТАНДАРДЕН календар за tenant).
ALTER TABLE "CalendarConfig" ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CalendarConfig" ADD CONSTRAINT "CalendarConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Партиален unique за СТАНДАРДНИОТ календар: еден по contentType кога clientId IS NULL
-- (@@unique([clientId, contentType]) не важи за NULL бидејќи Postgres ги третира NULL како различни).
CREATE UNIQUE INDEX "calendar_config_standard_unique" ON "CalendarConfig" ("contentType") WHERE "clientId" IS NULL;
