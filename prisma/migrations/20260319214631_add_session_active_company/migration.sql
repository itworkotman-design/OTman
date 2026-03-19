-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeCompanyId" TEXT;

-- CreateIndex
CREATE INDEX "Session_activeCompanyId_idx" ON "Session"("activeCompanyId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
