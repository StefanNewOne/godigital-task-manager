ALTER TABLE "ShootSession" DROP CONSTRAINT "ShootSession_groupId_fkey";

ALTER TABLE "ShootSession" ADD CONSTRAINT "ShootSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
