-- CreateTable
CREATE TABLE "ClientVideoMonth" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "rawCount" INTEGER NOT NULL DEFAULT 0,
    "editedCount" INTEGER NOT NULL DEFAULT 0,
    "postedCount" INTEGER NOT NULL DEFAULT 0,
    "lastShootDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientVideoMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientVideoMonth_clientId_monthKey_key" ON "ClientVideoMonth"("clientId", "monthKey");

-- CreateIndex
CREATE INDEX "ClientVideoMonth_clientId_idx" ON "ClientVideoMonth"("clientId");

-- CreateIndex
CREATE INDEX "ClientVideoMonth_monthKey_idx" ON "ClientVideoMonth"("monthKey");

-- AddForeignKey
ALTER TABLE "ClientVideoMonth" ADD CONSTRAINT "ClientVideoMonth_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
