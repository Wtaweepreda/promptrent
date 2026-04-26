-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'tenant',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_state" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "current_flow" TEXT,
    "current_step" TEXT,
    "context" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "landlord_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "address" TEXT,
    "province" TEXT,
    "property_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leases" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "landlord_id" TEXT NOT NULL,
    "monthly_rent" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "due_day" INTEGER NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lease_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_address" TEXT NOT NULL,
    "property_nickname" TEXT NOT NULL,
    "monthly_rent" DECIMAL(12,2) NOT NULL,
    "due_day" INTEGER NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_token" TEXT NOT NULL,
    "invite_expires_at" TIMESTAMP(3) NOT NULL,
    "lease_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lease_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2),
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "days_late" INTEGER,
    "notes" TEXT,
    "is_disputed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renter_scores" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "grade_label" TEXT NOT NULL,
    "total_months" INTEGER NOT NULL,
    "on_time_months" INTEGER NOT NULL DEFAULT 0,
    "late_months" INTEGER NOT NULL DEFAULT 0,
    "missed_months" INTEGER NOT NULL DEFAULT 0,
    "avg_days_late" DECIMAL(5,2),
    "score_version" TEXT NOT NULL DEFAULT 'v1.0',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renter_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "trigger_event" TEXT,
    "score_version" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "payment_record_id" TEXT,
    "recipient_id" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "reminder_type" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "line_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "payment_record_id" TEXT NOT NULL,
    "raised_by" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_by" TEXT,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_tokens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accessed_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_line_user_id_key" ON "users"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_state_line_user_id_key" ON "conversation_state"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leases_invite_token_key" ON "leases"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "lease_requests_invite_token_key" ON "lease_requests"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "lease_requests_lease_id_key" ON "lease_requests"("lease_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_lease_id_period_year_period_month_key" ON "payment_records"("lease_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "renter_scores_tenant_id_lease_id_key" ON "renter_scores"("tenant_id", "lease_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_tokens_token_key" ON "share_tokens"("token");

-- AddForeignKey
ALTER TABLE "conversation_state" ADD CONSTRAINT "conversation_state_line_user_id_fkey" FOREIGN KEY ("line_user_id") REFERENCES "users"("line_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_requests" ADD CONSTRAINT "lease_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_requests" ADD CONSTRAINT "lease_requests_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renter_scores" ADD CONSTRAINT "renter_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renter_scores" ADD CONSTRAINT "renter_scores_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
