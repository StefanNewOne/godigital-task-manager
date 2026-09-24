-- AlterTable
-- Задржува го извршителот по улога (монтажер/дизајнер) за да може да се врати истиот
-- при враќање (TD-8), исто како постоечките rezId/kreaId.
ALTER TABLE "Task" ADD COLUMN     "dizId" UUID,
ADD COLUMN     "monId" UUID;
