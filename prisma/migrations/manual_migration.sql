-- Manual migration for client onboarding tables
-- Run this with: npx prisma db execute --file prisma/migrations/manual_migration.sql --schema prisma/schema.prisma

-- Create enums first
DO $$ BEGIN
    CREATE TYPE "ClientType" AS ENUM ('CLINIC', 'HOSPITAL', 'DOCTOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PreferredLanguage" AS ENUM ('TELUGU', 'ENGLISH', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientAccessType" AS ENUM ('GMB', 'WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientAssetType" AS ENUM ('LOGO', 'PHOTO', 'VIDEO', 'TEMPLATE', 'DOCUMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientAssetCategory" AS ENUM ('RECEPTION', 'CONSULTATION', 'OT_LAB_PHARMACY', 'EQUIPMENT', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ApprovalMode" AS ENUM ('WHATSAPP', 'EMAIL', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PerformanceTrackingMode" AS ENUM ('AUTO', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to Client table
ALTER TABLE "Client" 
ADD COLUMN IF NOT EXISTS "type" "ClientType" DEFAULT 'CLINIC',
ADD COLUMN IF NOT EXISTS "status" "ClientStatus" DEFAULT 'ONBOARDING',
ADD COLUMN IF NOT EXISTS "primaryContactName" TEXT,
ADD COLUMN IF NOT EXISTS "phonePrimary" TEXT,
ADD COLUMN IF NOT EXISTS "phoneWhatsApp" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "addressLine" TEXT,
ADD COLUMN IF NOT EXISTS "area" TEXT,
ADD COLUMN IF NOT EXISTS "city" TEXT,
ADD COLUMN IF NOT EXISTS "pincode" TEXT,
ADD COLUMN IF NOT EXISTS "googleMapLink" TEXT,
ADD COLUMN IF NOT EXISTS "workingDays" JSONB,
ADD COLUMN IF NOT EXISTS "workingTimings" TEXT,
ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "scopeFinalised" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "preferredLanguage" "PreferredLanguage" DEFAULT 'ENGLISH';

-- Create indexes on Client
CREATE INDEX IF NOT EXISTS "Client_status_idx" ON "Client"("status");
CREATE INDEX IF NOT EXISTS "Client_type_idx" ON "Client"("type");

-- Create client_doctors table
CREATE TABLE IF NOT EXISTS "client_doctors" (
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

CREATE INDEX IF NOT EXISTS "client_doctors_clientId_idx" ON "client_doctors"("clientId");

-- Create client_services table
CREATE TABLE IF NOT EXISTS "client_services" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "priorityRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_services_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_services_clientId_idx" ON "client_services"("clientId");

-- Create client_usps table
CREATE TABLE IF NOT EXISTS "client_usps" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "uspText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_usps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_usps_clientId_idx" ON "client_usps"("clientId");

-- Create client_accesses table
CREATE TABLE IF NOT EXISTS "client_accesses" (
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

CREATE INDEX IF NOT EXISTS "client_accesses_clientId_idx" ON "client_accesses"("clientId");
CREATE INDEX IF NOT EXISTS "client_accesses_type_idx" ON "client_accesses"("type");

-- Create client_assets table
CREATE TABLE IF NOT EXISTS "client_assets" (
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

CREATE INDEX IF NOT EXISTS "client_assets_clientId_idx" ON "client_assets"("clientId");
CREATE INDEX IF NOT EXISTS "client_assets_type_idx" ON "client_assets"("type");
CREATE INDEX IF NOT EXISTS "client_assets_category_idx" ON "client_assets"("category");

-- Create client_branding table
CREATE TABLE IF NOT EXISTS "client_branding" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "brandColors" JSONB,
    "designerName" TEXT,
    "templateBaseCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_branding_clientId_key" ON "client_branding"("clientId");

-- Create client_targeting table
CREATE TABLE IF NOT EXISTS "client_targeting" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "client_targeting_clientId_key" ON "client_targeting"("clientId");

-- Create client_competitors table
CREATE TABLE IF NOT EXISTS "client_competitors" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "googleMapLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_competitors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_competitors_clientId_idx" ON "client_competitors"("clientId");

-- Create client_marketing_requirements table
CREATE TABLE IF NOT EXISTS "client_marketing_requirements" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "client_marketing_requirements_clientId_key" ON "client_marketing_requirements"("clientId");

-- Create client_approval_settings table
CREATE TABLE IF NOT EXISTS "client_approval_settings" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "client_approval_settings_clientId_key" ON "client_approval_settings"("clientId");

-- Create client_kpi_monthly table
CREATE TABLE IF NOT EXISTS "client_kpi_monthly" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "client_kpi_monthly_clientId_month_key" ON "client_kpi_monthly"("clientId", "month");
CREATE INDEX IF NOT EXISTS "client_kpi_monthly_clientId_idx" ON "client_kpi_monthly"("clientId");
CREATE INDEX IF NOT EXISTS "client_kpi_monthly_month_idx" ON "client_kpi_monthly"("month");

-- Create client_tasks table
CREATE TABLE IF NOT EXISTS "client_tasks" (
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

CREATE INDEX IF NOT EXISTS "client_tasks_clientId_idx" ON "client_tasks"("clientId");
CREATE INDEX IF NOT EXISTS "client_tasks_month_idx" ON "client_tasks"("month");
CREATE INDEX IF NOT EXISTS "client_tasks_status_idx" ON "client_tasks"("status");
CREATE INDEX IF NOT EXISTS "client_tasks_assignedToId_idx" ON "client_tasks"("assignedToId");

-- Create task_templates table
CREATE TABLE IF NOT EXISTS "task_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Monthly Fixed Template',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- Create task_template_items table
CREATE TABLE IF NOT EXISTS "task_template_items" (
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

CREATE INDEX IF NOT EXISTS "task_template_items_templateId_idx" ON "task_template_items"("templateId");
CREATE INDEX IF NOT EXISTS "task_template_items_order_idx" ON "task_template_items"("order");

-- Add foreign key constraints
ALTER TABLE "client_doctors" ADD CONSTRAINT "client_doctors_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_usps" ADD CONSTRAINT "client_usps_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_accesses" ADD CONSTRAINT "client_accesses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_branding" ADD CONSTRAINT "client_branding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_targeting" ADD CONSTRAINT "client_targeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_competitors" ADD CONSTRAINT "client_competitors_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_marketing_requirements" ADD CONSTRAINT "client_marketing_requirements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_approval_settings" ADD CONSTRAINT "client_approval_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_kpi_monthly" ADD CONSTRAINT "client_kpi_monthly_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

