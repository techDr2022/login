-- CreateEnum (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoicePlanDuration') THEN
        CREATE TYPE "InvoicePlanDuration" AS ENUM ('ONE_MONTH', 'THREE_MONTHS', 'SIX_MONTHS');
    END IF;
END $$;

-- AlterTable (only if column doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Client' AND column_name = 'planDuration'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "planDuration" "InvoicePlanDuration";
    END IF;
END $$;
