CREATE TYPE "public"."deposit_movement_type" AS ENUM('encaissement', 'retenue', 'restitution');--> statement-breakpoint
CREATE TYPE "public"."document_entity" AS ENUM('bail', 'bien', 'lot', 'locataire', 'proprietaire', 'etat_des_lieux', 'signalement', 'paiement');--> statement-breakpoint
CREATE TYPE "public"."due_status" AS ENUM('a_venir', 'partielle', 'payee', 'en_retard');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('brouillon', 'actif', 'preavis', 'termine');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('virement', 'especes');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('valide', 'annule');--> statement-breakpoint
CREATE TYPE "public"."receipt_kind" AS ENUM('quittance', 'recu');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin');--> statement-breakpoint
CREATE TYPE "public"."rule_status" AS ENUM('a_confirmer', 'valide');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text DEFAULT 'CG' NOT NULL,
	"plan" text DEFAULT 'essai' NOT NULL,
	"receipt_counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"status" "rule_status" DEFAULT 'a_confirmer' NOT NULL,
	"source" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"type" "deposit_movement_type" NOT NULL,
	"amount_xaf" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_movements_amount_positive" CHECK ("deposit_movements"."amount_xaf" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"entity_type" "document_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"period" date NOT NULL,
	"due_date" date NOT NULL,
	"amount_xaf" integer NOT NULL,
	"status" "due_status" DEFAULT 'a_venir' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dues_amount_positive" CHECK ("dues"."amount_xaf" > 0)
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" "lease_status" DEFAULT 'brouillon' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"rent_xaf" integer NOT NULL,
	"charges_xaf" integer DEFAULT 0 NOT NULL,
	"deposit_xaf" integer DEFAULT 0 NOT NULL,
	"payment_day" integer DEFAULT 5 NOT NULL,
	"revision_clause" boolean DEFAULT false NOT NULL,
	"notice_given_on" date,
	"terminated_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leases_rent_positive" CHECK ("leases"."rent_xaf" > 0),
	CONSTRAINT "leases_amounts_nonneg" CHECK ("leases"."charges_xaf" >= 0 AND "leases"."deposit_xaf" >= 0),
	CONSTRAINT "leases_payment_day" CHECK ("leases"."payment_day" BETWEEN 1 AND 28)
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"commission_pct" numeric(5, 2) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mandates_commission_range" CHECK ("mandates"."commission_pct" >= 0 AND "mandates"."commission_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"due_id" uuid NOT NULL,
	"amount_xaf" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"reference" text,
	"status" "payment_status" DEFAULT 'valide' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"idempotency_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_xaf" > 0),
	CONSTRAINT "payments_cancel_consistent" CHECK (("payments"."status" = 'annule') = ("payments"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" "receipt_kind" NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pdf_storage_key" text
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"label" text NOT NULL,
	"default_rent_xaf" integer DEFAULT 0 NOT NULL,
	"default_charges_xaf" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_due_id_dues_id_fk" FOREIGN KEY ("due_id") REFERENCES "public"."dues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_agency_created_idx" ON "audit_log" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "country_rules_uq" ON "country_rules" USING btree ("country","key");--> statement-breakpoint
CREATE INDEX "deposit_movements_lease_idx" ON "deposit_movements" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("agency_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "dues_agency_status_idx" ON "dues" USING btree ("agency_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "dues_lease_period_uq" ON "dues" USING btree ("lease_id","period");--> statement-breakpoint
CREATE INDEX "leases_agency_idx" ON "leases" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "leases_tenant_idx" ON "leases" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leases_one_active_per_unit_uq" ON "leases" USING btree ("unit_id") WHERE "leases"."status" IN ('actif', 'preavis');--> statement-breakpoint
CREATE INDEX "mandates_agency_idx" ON "mandates" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "mandates_owner_idx" ON "mandates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "owners_agency_idx" ON "owners" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "payments_due_idx" ON "payments" USING btree ("due_id");--> statement-breakpoint
CREATE INDEX "payments_agency_paid_on_idx" ON "payments" USING btree ("agency_id","paid_on");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_uq" ON "payments" USING btree ("agency_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "properties_agency_idx" ON "properties" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "properties_mandate_idx" ON "properties" USING btree ("mandate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_uq" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_agency_number_uq" ON "receipts" USING btree ("agency_id","number");--> statement-breakpoint
CREATE INDEX "tenants_agency_idx" ON "tenants" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "units_agency_idx" ON "units" USING btree ("agency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_property_label_uq" ON "units" USING btree ("property_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_agency_idx" ON "users" USING btree ("agency_id");