-- Add enum types for new marketing requirement choices (idempotent)
DO $$ BEGIN
  CREATE TYPE "WebsiteRequirementStatus" AS ENUM ('NEEDED', 'NOT_NEEDED', 'HAS_OLD_WEBSITE', 'REVAMP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PresenceStatus" AS ENUM ('HAVE_ALREADY', 'NEED_TO_CREATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend client_marketing_requirements with detailed onboarding fields
ALTER TABLE "client_marketing_requirements"
ADD COLUMN IF NOT EXISTS "postersPerMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "videosPerMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "websiteRequirement" "WebsiteRequirementStatus" NOT NULL DEFAULT 'NOT_NEEDED',
ADD COLUMN IF NOT EXISTS "appointmentBookingRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "telehealthRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "gmbStatus" "PresenceStatus" NOT NULL DEFAULT 'HAVE_ALREADY',
ADD COLUMN IF NOT EXISTS "socialCreationStatus" "PresenceStatus" NOT NULL DEFAULT 'HAVE_ALREADY',
ADD COLUMN IF NOT EXISTS "blogsPerMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "linkedInCreationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "otherServices" TEXT;
