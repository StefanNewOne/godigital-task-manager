-- Google најава (ADR-002): опционо врзување на Employee со Google subject.
ALTER TABLE "Employee" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "Employee_googleSub_key" ON "Employee"("googleSub");
