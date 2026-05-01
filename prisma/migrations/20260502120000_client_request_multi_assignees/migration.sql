-- CreateTable
CREATE TABLE "ClientRequestAssignee" (
    "id" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRequestAssignee_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single assignee into join rows
INSERT INTO "ClientRequestAssignee" ("id", "clientRequestId", "userId", "createdAt")
SELECT gen_random_uuid()::text, "id", "assignedToId", CURRENT_TIMESTAMP
FROM "ClientRequest"
WHERE "assignedToId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientRequestAssignee_clientRequestId_userId_key" ON "ClientRequestAssignee"("clientRequestId", "userId");

CREATE INDEX "ClientRequestAssignee_userId_idx" ON "ClientRequestAssignee"("userId");

-- AddForeignKey
ALTER TABLE "ClientRequestAssignee" ADD CONSTRAINT "ClientRequestAssignee_clientRequestId_fkey" FOREIGN KEY ("clientRequestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientRequestAssignee" ADD CONSTRAINT "ClientRequestAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy single assignee
ALTER TABLE "ClientRequest" DROP CONSTRAINT "ClientRequest_assignedToId_fkey";

ALTER TABLE "ClientRequest" DROP COLUMN "assignedToId";
