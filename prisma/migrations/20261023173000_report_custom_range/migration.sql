DROP INDEX IF EXISTS "Clientweeklyreport_clientid_weekstart_key";

CREATE UNIQUE INDEX "Clientweeklyreport_clientid_weekstart_weekend_key"
ON "Clientweeklyreport"("clientid", "weekstart", "weekend");
