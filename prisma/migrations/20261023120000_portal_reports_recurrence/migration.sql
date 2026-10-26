-- Additive only. Existing rows keep their data.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CLIENT';

CREATE TABLE "Clientportalaccess" (
    "id" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "clientid" TEXT NOT NULL,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Clientportalaccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Clientweeklyreport" (
    "id" TEXT NOT NULL,
    "clientid" TEXT NOT NULL,
    "weekstart" TIMESTAMP(3) NOT NULL,
    "weekend" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Clientweeklyreport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workflowtemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientid" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workflowtemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workflowstage" (
    "id" TEXT NOT NULL,
    "templateid" TEXT NOT NULL,
    "stageorder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "tasktype" TEXT,
    "offsethours" INTEGER NOT NULL DEFAULT 24,
    "assigneeuserid" TEXT,
    CONSTRAINT "Workflowstage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recurrencerule" (
    "id" TEXT NOT NULL,
    "clientid" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'Medium',
    "tasktype" TEXT,
    "cadence" TEXT NOT NULL,
    "weekday" INTEGER,
    "assigneeuserid" TEXT,
    "workflowtemplateid" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdbyid" TEXT NOT NULL,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recurrencerule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recurrencerun" (
    "id" TEXT NOT NULL,
    "ruleid" TEXT NOT NULL,
    "periodkey" TEXT NOT NULL,
    "taskid" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recurrencerun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN "clientvisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "clientrequestid" TEXT;
ALTER TABLE "Task" ADD COLUMN "deliverableurl" TEXT;
ALTER TABLE "Task" ADD COLUMN "workflowrunid" TEXT;
ALTER TABLE "Task" ADD COLUMN "workflowtemplateid" TEXT;
ALTER TABLE "Task" ADD COLUMN "stageorder" INTEGER;
ALTER TABLE "Task" ADD COLUMN "dependstaskid" TEXT;
ALTER TABLE "Task" ADD COLUMN "recurrenceperiodkey" TEXT;
ALTER TABLE "Task" ADD COLUMN "idempotencykey" TEXT;

CREATE UNIQUE INDEX "Clientportalaccess_userid_clientid_key" ON "Clientportalaccess"("userid", "clientid");
CREATE INDEX "Clientportalaccess_clientid_idx" ON "Clientportalaccess"("clientid");

CREATE UNIQUE INDEX "Clientweeklyreport_clientid_weekstart_key" ON "Clientweeklyreport"("clientid", "weekstart");
CREATE INDEX "Clientweeklyreport_clientid_idx" ON "Clientweeklyreport"("clientid");

CREATE INDEX "Workflowtemplate_clientid_idx" ON "Workflowtemplate"("clientid");
CREATE INDEX "Workflowtemplate_active_idx" ON "Workflowtemplate"("active");

CREATE UNIQUE INDEX "Workflowstage_templateid_stageorder_key" ON "Workflowstage"("templateid", "stageorder");
CREATE INDEX "Workflowstage_assigneeuserid_idx" ON "Workflowstage"("assigneeuserid");

CREATE INDEX "Recurrencerule_active_idx" ON "Recurrencerule"("active");
CREATE INDEX "Recurrencerule_clientid_idx" ON "Recurrencerule"("clientid");
CREATE INDEX "Recurrencerule_assigneeuserid_idx" ON "Recurrencerule"("assigneeuserid");

CREATE UNIQUE INDEX "Recurrencerun_ruleid_periodkey_key" ON "Recurrencerun"("ruleid", "periodkey");
CREATE INDEX "Recurrencerun_status_idx" ON "Recurrencerun"("status");

CREATE UNIQUE INDEX "Task_assignedById_idempotencykey_key" ON "Task"("assignedById", "idempotencykey");
CREATE INDEX "Task_clientId_clientvisible_idx" ON "Task"("clientId", "clientvisible");
CREATE INDEX "Task_clientrequestid_idx" ON "Task"("clientrequestid");
CREATE INDEX "Task_workflowrunid_idx" ON "Task"("workflowrunid");

ALTER TABLE "Clientportalaccess" ADD CONSTRAINT "Clientportalaccess_userid_fkey" FOREIGN KEY ("userid") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Clientportalaccess" ADD CONSTRAINT "Clientportalaccess_clientid_fkey" FOREIGN KEY ("clientid") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Clientweeklyreport" ADD CONSTRAINT "Clientweeklyreport_clientid_fkey" FOREIGN KEY ("clientid") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Workflowtemplate" ADD CONSTRAINT "Workflowtemplate_clientid_fkey" FOREIGN KEY ("clientid") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Workflowstage" ADD CONSTRAINT "Workflowstage_templateid_fkey" FOREIGN KEY ("templateid") REFERENCES "Workflowtemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workflowstage" ADD CONSTRAINT "Workflowstage_assigneeuserid_fkey" FOREIGN KEY ("assigneeuserid") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Recurrencerule" ADD CONSTRAINT "Recurrencerule_clientid_fkey" FOREIGN KEY ("clientid") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recurrencerule" ADD CONSTRAINT "Recurrencerule_assigneeuserid_fkey" FOREIGN KEY ("assigneeuserid") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recurrencerule" ADD CONSTRAINT "Recurrencerule_createdbyid_fkey" FOREIGN KEY ("createdbyid") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recurrencerule" ADD CONSTRAINT "Recurrencerule_workflowtemplateid_fkey" FOREIGN KEY ("workflowtemplateid") REFERENCES "Workflowtemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Recurrencerun" ADD CONSTRAINT "Recurrencerun_ruleid_fkey" FOREIGN KEY ("ruleid") REFERENCES "Recurrencerule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_clientrequestid_fkey" FOREIGN KEY ("clientrequestid") REFERENCES "ClientRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_workflowtemplateid_fkey" FOREIGN KEY ("workflowtemplateid") REFERENCES "Workflowtemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_dependstaskid_fkey" FOREIGN KEY ("dependstaskid") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
