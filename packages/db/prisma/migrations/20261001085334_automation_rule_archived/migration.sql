-- NOTE(TD-9): DROP INDEX за pgvector индексите намерно отстранет (raw SQL во init; drift лажна тревога).
-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "archivedAt" TIMESTAMP(3);
