-- AlterEnum
-- Add 'HalfDay' to AttendanceStatus enum
-- Check if value already exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'HalfDay' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AttendanceStatus')
    ) THEN
        ALTER TYPE "AttendanceStatus" ADD VALUE 'HalfDay';
    END IF;
END $$;

