ALTER TYPE "TaskStatus" ADD VALUE 'Locked';
ALTER TYPE "TaskStatus" ADD VALUE 'ToDo';
ALTER TYPE "TaskStatus" ADD VALUE 'WaitingOnInput';
ALTER TYPE "TaskStatus" ADD VALUE 'InReview';
ALTER TYPE "TaskStatus" ADD VALUE 'Done';
ALTER TYPE "TaskStatus" ADD VALUE 'Cancelled';

ALTER TYPE "UserRole" ADD VALUE 'COORDINATOR';

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

CREATE TABLE "Worktemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "teamid" TEXT,
    "section" TEXT,
    "triggertype" TEXT NOT NULL,
    "startswhen" TEXT,
    "repeat" TEXT,
    "timeorday" TEXT,
    "inputfrom" TEXT,
    "inputneeded" TEXT,
    "handoffto" TEXT,
    "donewhen" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "perclient" BOOLEAN NOT NULL DEFAULT false,
    "istimelock" BOOLEAN NOT NULL DEFAULT false,
    "needsconfirmation" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Worktemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Worktemplate_active_idx" ON "Worktemplate"("active");
CREATE INDEX "Worktemplate_teamid_idx" ON "Worktemplate"("teamid");
CREATE INDEX "Worktemplate_triggertype_idx" ON "Worktemplate"("triggertype");

CREATE TABLE "Worktemplateassignee" (
    "id" TEXT NOT NULL,
    "templateid" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    CONSTRAINT "Worktemplateassignee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Worktemplateassignee_templateid_userid_key" ON "Worktemplateassignee"("templateid", "userid");
CREATE INDEX "Worktemplateassignee_userid_idx" ON "Worktemplateassignee"("userid");

CREATE TABLE "Templatedependency" (
    "id" TEXT NOT NULL,
    "templateid" TEXT NOT NULL,
    "dependsonid" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    CONSTRAINT "Templatedependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Templatedependency_templateid_dependsonid_kind_key" ON "Templatedependency"("templateid", "dependsonid", "kind");
CREATE INDEX "Templatedependency_templateid_idx" ON "Templatedependency"("templateid");
CREATE INDEX "Templatedependency_dependsonid_idx" ON "Templatedependency"("dependsonid");

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projecttemplate" TEXT NOT NULL,
    "clientid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedon" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_clientid_idx" ON "Project"("clientid");
CREATE INDEX "Project_status_idx" ON "Project"("status");

CREATE TABLE "Appsetting" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedat" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appsetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Enginerun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enginerun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Enginerun_createdat_idx" ON "Enginerun"("createdat");

ALTER TABLE "User" ADD COLUMN "teamid" TEXT;
ALTER TABLE "User" ADD COLUMN "escalatestouserid" TEXT;
CREATE INDEX "User_teamid_idx" ON "User"("teamid");
CREATE INDEX "User_escalatestouserid_idx" ON "User"("escalatestouserid");

ALTER TABLE "Task" ADD COLUMN "templateid" TEXT;
ALTER TABLE "Task" ADD COLUMN "projectid" TEXT;
ALTER TABLE "Task" ADD COLUMN "periodkey" TEXT;
ALTER TABLE "Task" ADD COLUMN "revisioncount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "startedat" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "completedat" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "approvedbyid" TEXT;
ALTER TABLE "Task" ADD COLUMN "noinputflag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "waitingonuserid" TEXT;
ALTER TABLE "Task" ADD COLUMN "enginekey" TEXT;

CREATE UNIQUE INDEX "Task_enginekey_key" ON "Task"("enginekey");
CREATE INDEX "Task_templateid_idx" ON "Task"("templateid");
CREATE INDEX "Task_projectid_idx" ON "Task"("projectid");
CREATE INDEX "Task_periodkey_idx" ON "Task"("periodkey");
CREATE INDEX "Task_assignedToId_status_dueDate_idx" ON "Task"("assignedToId", "status", "dueDate");
CREATE INDEX "Task_templateid_clientId_periodkey_idx" ON "Task"("templateid", "clientId", "periodkey");

ALTER TABLE "activity_logs" ADD COLUMN "oldvalue" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "newvalue" TEXT;

ALTER TABLE "Worktemplate" ADD CONSTRAINT "Worktemplate_teamid_fkey" FOREIGN KEY ("teamid") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Worktemplateassignee" ADD CONSTRAINT "Worktemplateassignee_templateid_fkey" FOREIGN KEY ("templateid") REFERENCES "Worktemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Worktemplateassignee" ADD CONSTRAINT "Worktemplateassignee_userid_fkey" FOREIGN KEY ("userid") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Templatedependency" ADD CONSTRAINT "Templatedependency_templateid_fkey" FOREIGN KEY ("templateid") REFERENCES "Worktemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Templatedependency" ADD CONSTRAINT "Templatedependency_dependsonid_fkey" FOREIGN KEY ("dependsonid") REFERENCES "Worktemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientid_fkey" FOREIGN KEY ("clientid") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_teamid_fkey" FOREIGN KEY ("teamid") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_escalatestouserid_fkey" FOREIGN KEY ("escalatestouserid") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_templateid_fkey" FOREIGN KEY ("templateid") REFERENCES "Worktemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectid_fkey" FOREIGN KEY ("projectid") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_approvedbyid_fkey" FOREIGN KEY ("approvedbyid") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_waitingonuserid_fkey" FOREIGN KEY ("waitingonuserid") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Appsetting" ("id", "value", "updatedat")
VALUES
  ('NEW_ENGINE_ENABLED', 'true', CURRENT_TIMESTAMP),
  ('PUBLIC_BOARD_TOKEN', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
