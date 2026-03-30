-- Create EmployeeSalary table safely without touching existing tables
CREATE TABLE IF NOT EXISTS "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- Ensure unique and supporting indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalary_userId_monthKey_key" ON "EmployeeSalary"("userId", "monthKey");
CREATE INDEX IF NOT EXISTS "EmployeeSalary_monthKey_idx" ON "EmployeeSalary"("monthKey");
CREATE INDEX IF NOT EXISTS "EmployeeSalary_isActive_idx" ON "EmployeeSalary"("isActive");
CREATE INDEX IF NOT EXISTS "EmployeeSalary_userId_idx" ON "EmployeeSalary"("userId");

-- Ensure foreign key exists (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmployeeSalary_userId_fkey'
    ) THEN
        ALTER TABLE "EmployeeSalary"
        ADD CONSTRAINT "EmployeeSalary_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;
