-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('Present', 'Late', 'Absent');

-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('OFFICE', 'WFH', 'LEAVE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('Pending', 'InProgress', 'Review', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "ChatThreadType" AS ENUM ('TASK', 'DIRECT', 'TEAM');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('CLINIC', 'HOSPITAL', 'DOCTOR');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('TELUGU', 'ENGLISH', 'BOTH');

-- CreateEnum
CREATE TYPE "ClientAccessType" AS ENUM ('GMB', 'WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ClientAssetType" AS ENUM ('LOGO', 'PHOTO', 'VIDEO', 'TEMPLATE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ClientAssetCategory" AS ENUM ('RECEPTION', 'CONSULTATION', 'OT_LAB_PHARMACY', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('WHATSAPP', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "PerformanceTrackingMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3),
    "logoutTime" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'Present',
    "mode" "AttendanceMode" NOT NULL DEFAULT 'OFFICE',
    "earlySignInMinutes" INTEGER,
    "lateSignInMinutes" INTEGER,
    "earlyLogoutMinutes" INTEGER,
    "lateLogoutMinutes" INTEGER,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doctorOrHospitalName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "services" TEXT[],
    "accountManagerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ClientType" DEFAULT 'CLINIC',
    "status" "ClientStatus" NOT NULL DEFAULT 'ONBOARDING',
    "primaryContactName" TEXT,
    "phonePrimary" TEXT,
    "phoneWhatsApp" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "area" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "googleMapLink" TEXT,
    "workingDays" JSONB,
    "workingTimings" TEXT,
    "startDate" TIMESTAMP(3),
    "scopeFinalised" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "preferredLanguage" "PreferredLanguage" DEFAULT 'ENGLISH',

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'Medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'Pending',
    "assignedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "clientId" TEXT,
    "dueDate" TIMESTAMP(3),
    "timeSpent" DOUBLE PRECISION DEFAULT 0,
    "rejectionFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "type" "ChatThreadType" NOT NULL,
    "taskId" TEXT,
    "user1Id" TEXT,
    "user2Id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_unread_counts" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chat_unread_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_doctors" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "qualification" TEXT,
    "specialization" TEXT,
    "experienceYears" INTEGER,
    "registrationNumber" TEXT,
    "languagesSpoken" JSONB,
    "photoAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_services" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "priorityRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_usps" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "uspText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_usps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_accesses" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientAccessType" NOT NULL,
    "loginUrl" TEXT,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_assets" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientAssetType" NOT NULL,
    "category" "ClientAssetCategory",
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_branding" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "brandColors" JSONB,
    "designerName" TEXT,
    "templateBaseCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_targeting" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "primaryLocation" TEXT,
    "nearbyAreas" JSONB,
    "mainKeywords" JSONB,
    "exampleKeywords" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_targeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_competitors" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "googleMapLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_marketing_requirements" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "gmbOptimisation" BOOLEAN NOT NULL DEFAULT false,
    "websiteSeo" BOOLEAN NOT NULL DEFAULT false,
    "socialPostsPerWeek" INTEGER NOT NULL DEFAULT 0,
    "socialPostsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "reelsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "googleAds" BOOLEAN NOT NULL DEFAULT false,
    "metaAds" BOOLEAN NOT NULL DEFAULT false,
    "reviewManagement" BOOLEAN NOT NULL DEFAULT false,
    "posters" BOOLEAN NOT NULL DEFAULT false,
    "videos" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_marketing_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_approval_settings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "pointOfContactName" TEXT,
    "approvalTimeHours" INTEGER,
    "approvalMode" "ApprovalMode",
    "performanceTrackingMode" "PerformanceTrackingMode" DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_approval_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_kpi_monthly" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "gmbCalls" INTEGER NOT NULL DEFAULT 0,
    "directionRequests" INTEGER NOT NULL DEFAULT 0,
    "websiteClicks" INTEGER NOT NULL DEFAULT 0,
    "leadsGenerated" INTEGER NOT NULL DEFAULT 0,
    "reportStatus" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_kpi_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tasks" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'Pending',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "checklist" JSONB,
    "createdFromTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Monthly Fixed Template',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'Medium',
    "dueDateOffset" INTEGER,
    "checklist" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "attendances_userId_idx" ON "attendances"("userId");

-- CreateIndex
CREATE INDEX "attendances_date_idx" ON "attendances"("date");

-- CreateIndex
CREATE INDEX "attendances_mode_idx" ON "attendances"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_userId_date_key" ON "attendances"("userId", "date");

-- CreateIndex
CREATE INDEX "Client_accountManagerId_idx" ON "Client"("accountManagerId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_type_idx" ON "Client"("type");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_taskId_key" ON "chat_threads"("taskId");

-- CreateIndex
CREATE INDEX "chat_threads_type_idx" ON "chat_threads"("type");

-- CreateIndex
CREATE INDEX "chat_threads_taskId_idx" ON "chat_threads"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_user1Id_user2Id_key" ON "chat_threads"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "chat_messages_threadId_idx" ON "chat_messages"("threadId");

-- CreateIndex
CREATE INDEX "chat_messages_senderId_idx" ON "chat_messages"("senderId");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "chat_unread_counts_userId_idx" ON "chat_unread_counts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_unread_counts_threadId_userId_key" ON "chat_unread_counts"("threadId", "userId");

-- CreateIndex
CREATE INDEX "client_doctors_clientId_idx" ON "client_doctors"("clientId");

-- CreateIndex
CREATE INDEX "client_services_clientId_idx" ON "client_services"("clientId");

-- CreateIndex
CREATE INDEX "client_usps_clientId_idx" ON "client_usps"("clientId");

-- CreateIndex
CREATE INDEX "client_accesses_clientId_idx" ON "client_accesses"("clientId");

-- CreateIndex
CREATE INDEX "client_accesses_type_idx" ON "client_accesses"("type");

-- CreateIndex
CREATE INDEX "client_assets_clientId_idx" ON "client_assets"("clientId");

-- CreateIndex
CREATE INDEX "client_assets_type_idx" ON "client_assets"("type");

-- CreateIndex
CREATE INDEX "client_assets_category_idx" ON "client_assets"("category");

-- CreateIndex
CREATE UNIQUE INDEX "client_branding_clientId_key" ON "client_branding"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_targeting_clientId_key" ON "client_targeting"("clientId");

-- CreateIndex
CREATE INDEX "client_competitors_clientId_idx" ON "client_competitors"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_marketing_requirements_clientId_key" ON "client_marketing_requirements"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_approval_settings_clientId_key" ON "client_approval_settings"("clientId");

-- CreateIndex
CREATE INDEX "client_kpi_monthly_clientId_idx" ON "client_kpi_monthly"("clientId");

-- CreateIndex
CREATE INDEX "client_kpi_monthly_month_idx" ON "client_kpi_monthly"("month");

-- CreateIndex
CREATE UNIQUE INDEX "client_kpi_monthly_clientId_month_key" ON "client_kpi_monthly"("clientId", "month");

-- CreateIndex
CREATE INDEX "client_tasks_clientId_idx" ON "client_tasks"("clientId");

-- CreateIndex
CREATE INDEX "client_tasks_month_idx" ON "client_tasks"("month");

-- CreateIndex
CREATE INDEX "client_tasks_status_idx" ON "client_tasks"("status");

-- CreateIndex
CREATE INDEX "client_tasks_assignedToId_idx" ON "client_tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "task_template_items_templateId_idx" ON "task_template_items"("templateId");

-- CreateIndex
CREATE INDEX "task_template_items_order_idx" ON "task_template_items"("order");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_unread_counts" ADD CONSTRAINT "chat_unread_counts_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_doctors" ADD CONSTRAINT "client_doctors_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_usps" ADD CONSTRAINT "client_usps_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_accesses" ADD CONSTRAINT "client_accesses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_branding" ADD CONSTRAINT "client_branding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_targeting" ADD CONSTRAINT "client_targeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_competitors" ADD CONSTRAINT "client_competitors_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_marketing_requirements" ADD CONSTRAINT "client_marketing_requirements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_approval_settings" ADD CONSTRAINT "client_approval_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_kpi_monthly" ADD CONSTRAINT "client_kpi_monthly_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
