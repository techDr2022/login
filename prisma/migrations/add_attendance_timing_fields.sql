-- Migration to add early/late sign in/out tracking fields to attendances table
-- Run this with: npx prisma db execute --file prisma/migrations/add_attendance_timing_fields.sql --schema prisma/schema.prisma

-- Add new columns to attendances table
ALTER TABLE "attendances" 
ADD COLUMN IF NOT EXISTS "earlySignInMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "lateSignInMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "earlyLogoutMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "lateLogoutMinutes" INTEGER;

