-- CreateTable
CREATE TABLE "attendance_holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_holidays_date_key" ON "attendance_holidays"("date");

-- CreateIndex
CREATE INDEX "attendance_holidays_date_idx" ON "attendance_holidays"("date");

-- AddForeignKey
ALTER TABLE "attendance_holidays" ADD CONSTRAINT "attendance_holidays_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed existing public holidays (migrated from lib/attendance-holidays.ts)
INSERT INTO "attendance_holidays" ("id", "date", "name", "createdAt") VALUES
  ('holiday_2025_01_14', '2025-01-14', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_01_26', '2025-01-26', 'Republic Day', CURRENT_TIMESTAMP),
  ('holiday_2025_03_04', '2025-03-04', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_03_26', '2025-03-26', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_03_30', '2025-03-30', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_03_31', '2025-03-31', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_06_07', '2025-06-07', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_08_09', '2025-08-09', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_08_15', '2025-08-15', 'Independence Day', CURRENT_TIMESTAMP),
  ('holiday_2025_10_20', '2025-10-20', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_11_08', '2025-11-08', 'Public Holiday', CURRENT_TIMESTAMP),
  ('holiday_2025_12_25', '2025-12-25', 'Christmas', CURRENT_TIMESTAMP)
ON CONFLICT ("date") DO NOTHING;
