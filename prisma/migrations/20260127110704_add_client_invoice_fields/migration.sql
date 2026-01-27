-- AlterTable
-- Add columns only if they don't already exist
DO $$ 
BEGIN
    -- Add endDate column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Client' AND column_name = 'endDate'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "endDate" TIMESTAMP(3);
    END IF;

    -- Add monthlyAmount column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Client' AND column_name = 'monthlyAmount'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "monthlyAmount" DOUBLE PRECISION;
    END IF;

    -- Add nextPaymentDate column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Client' AND column_name = 'nextPaymentDate'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "nextPaymentDate" TIMESTAMP(3);
    END IF;

    -- Add lastPaymentDate column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Client' AND column_name = 'lastPaymentDate'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "lastPaymentDate" TIMESTAMP(3);
    END IF;
END $$;

-- CreateIndex
-- Create index only if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'Client' AND indexname = 'Client_nextPaymentDate_idx'
    ) THEN
        CREATE INDEX "Client_nextPaymentDate_idx" ON "Client"("nextPaymentDate");
    END IF;
END $$;
