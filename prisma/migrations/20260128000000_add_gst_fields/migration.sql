-- AlterTable
-- Add GST fields to Client model
DO $$
BEGIN
    -- Add isGST column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Client' AND column_name = 'isGST'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "isGST" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add gstNumber column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Client' AND column_name = 'gstNumber'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "gstNumber" TEXT;
    END IF;

    -- Add gstRate column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Client' AND column_name = 'gstRate'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "gstRate" DOUBLE PRECISION DEFAULT 18.0;
    END IF;
END $$;
