-- AlterEnum
-- Add 'HalfDay' to AttendanceStatus enum
-- Note: This will fail if the value already exists, but that's expected behavior
ALTER TYPE "AttendanceStatus" ADD VALUE 'HalfDay';

