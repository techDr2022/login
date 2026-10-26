CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientid" TEXT NOT NULL,
    "actorid" TEXT,
    "type" TEXT NOT NULL,
    "entitytype" TEXT NOT NULL,
    "entityid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "link" TEXT,
    "isread" BOOLEAN NOT NULL DEFAULT false,
    "readat" TIMESTAMP(3),
    "isarchived" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "groupkey" TEXT,
    "idempotencykey" TEXT NOT NULL,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_idempotencykey_key" ON "Notification"("idempotencykey");
CREATE INDEX "Notification_recipientid_isread_createdat_idx" ON "Notification"("recipientid", "isread", "createdat");
CREATE INDEX "Notification_recipientid_createdat_idx" ON "Notification"("recipientid", "createdat");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientid_fkey" FOREIGN KEY ("recipientid") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorid_fkey" FOREIGN KEY ("actorid") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
