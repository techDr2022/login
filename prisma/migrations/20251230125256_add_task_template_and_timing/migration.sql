-- AlterTable
ALTER TABLE "Task" ADD COLUMN "taskType" TEXT,
ADD COLUMN "startDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_taskType_idx" ON "Task"("taskType");

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "durationHours" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_taskType_key" ON "TaskTemplate"("taskType");

-- CreateIndex
CREATE INDEX "TaskTemplate_taskType_idx" ON "TaskTemplate"("taskType");

-- CreateIndex
CREATE INDEX "TaskTemplate_isActive_idx" ON "TaskTemplate"("isActive");

