ALTER TABLE "User" ADD COLUMN "department" TEXT;

CREATE INDEX "User_department_idx" ON "User"("department");

UPDATE "User"
SET "department" = CASE
  WHEN LOWER(TRIM("name")) IN ('gowthami', 'gouthami', 'jagadeesh') THEN 'Marketing'
  WHEN LOWER(TRIM("name")) = 'rohith' THEN 'Video Editing'
  WHEN LOWER(TRIM("name")) = 'chaithanya' THEN 'Graphic Design'
  WHEN LOWER(TRIM("name")) = 'shaheena' THEN 'Content Writing'
  WHEN LOWER(TRIM("name")) IN ('raghu', 'shiva prasad') THEN 'Website Development'
  ELSE "department"
END
WHERE "department" IS NULL
  AND LOWER(TRIM("name")) IN (
    'gowthami',
    'gouthami',
    'jagadeesh',
    'rohith',
    'chaithanya',
    'shaheena',
    'raghu',
    'shiva prasad'
  );
