-- CreateEnum
CREATE TYPE "ClientRequestType" AS ENUM ('POSTER', 'VIDEO', 'POSTER_AND_VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'NOT_DOING');

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "clientId" TEXT,
    "clientName" TEXT,
    "contactPhone" TEXT,
    "requestType" "ClientRequestType" NOT NULL DEFAULT 'OTHER',
    "summary" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ClientRequestStatus" NOT NULL DEFAULT 'NEW',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientRequest_status_idx" ON "ClientRequest"("status");

-- CreateIndex
CREATE INDEX "ClientRequest_receivedAt_idx" ON "ClientRequest"("receivedAt");

-- CreateIndex
CREATE INDEX "ClientRequest_clientId_idx" ON "ClientRequest"("clientId");

-- CreateIndex
CREATE INDEX "ClientRequest_createdById_idx" ON "ClientRequest"("createdById");

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
