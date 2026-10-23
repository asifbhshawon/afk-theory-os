CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"field_key" text NOT NULL,
	"field_label" text NOT NULL,
	"data_type" text NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"help_text" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"value_text" text,
	"value_numeric" numeric(18, 4),
	"value_date" timestamp with time zone,
	"value_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venture_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"participation_mode" text DEFAULT 'EQUAL' NOT NULL,
	"effective_date" timestamp with time zone DEFAULT now() NOT NULL,
	"waterfall_rules" jsonb,
	"loss_recovery_policy" text DEFAULT 'PROPORTIONAL' NOT NULL,
	"notes" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venture_allocation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"snapshot_number" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_revenue" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"returns_and_allowances" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"net_revenue" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"cogs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"direct_expenses" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"shared_allocated_expenses" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"operating_reserve_retained" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"net_distributable" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"calculation_basis_json" jsonb NOT NULL,
	"is_settled" boolean DEFAULT false NOT NULL,
	"calculated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venture_allocation_snapshots_snapshot_number_unique" UNIQUE("snapshot_number")
);
--> statement-breakpoint
CREATE TABLE "venture_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"contribution_type" text DEFAULT 'CASH' NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"description" text NOT NULL,
	"valuation_basis" text,
	"payment_account_id" uuid,
	"journal_entry_id" uuid,
	"status" text DEFAULT 'CONFIRMED' NOT NULL,
	"contributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by_user_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "venture_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"journal_entry_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"allocation_basis" text DEFAULT 'DIRECT' NOT NULL,
	"memo" text NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"allocated_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "venture_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"venture_id" uuid NOT NULL,
	"partner_id" uuid,
	"contact_id" uuid,
	"name" text NOT NULL,
	"is_external" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'INVESTOR' NOT NULL,
	"investment_commitment" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"actual_cash_contributed" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"approved_non_cash_value" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"investment_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"profit_sharing_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"loss_sharing_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"capital_recovery_priority" integer DEFAULT 1 NOT NULL,
	"voting_weight" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"responsibilities" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venture_product_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"product_id" uuid,
	"collection_id" uuid,
	"notes" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venture_settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"gross_entitlement" numeric(18, 2) NOT NULL,
	"capital_recovered" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"profit_distributed" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"losses_carried_forward" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"reinvested_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"net_cash_paid" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"payment_reference" text,
	"status" text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venture_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_number" text NOT NULL,
	"venture_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"settlement_type" text DEFAULT 'FULL' NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"payment_account_id" uuid,
	"journal_entry_id" uuid,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venture_settlements_settlement_number_unique" UNIQUE("settlement_number")
);
--> statement-breakpoint
CREATE TABLE "venture_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venture_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ventures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_number" text NOT NULL,
	"title" text NOT NULL,
	"type_code" text NOT NULL,
	"stage" text DEFAULT 'IDEA' NOT NULL,
	"description" text,
	"target_budget" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"actual_budget" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" text DEFAULT 'BDT' NOT NULL,
	"start_date" timestamp with time zone,
	"target_date" timestamp with time zone,
	"closed_date" timestamp with time zone,
	"manager_user_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ventures_venture_number_unique" UNIQUE("venture_number")
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stages_json" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_definitions_workflow_type_unique" UNIQUE("workflow_type")
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "production_orders" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_lines" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_agreements" ADD CONSTRAINT "venture_agreements_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_agreements" ADD CONSTRAINT "venture_agreements_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_allocation_snapshots" ADD CONSTRAINT "venture_allocation_snapshots_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_allocation_snapshots" ADD CONSTRAINT "venture_allocation_snapshots_agreement_id_venture_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."venture_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_allocation_snapshots" ADD CONSTRAINT "venture_allocation_snapshots_calculated_by_user_id_users_id_fk" FOREIGN KEY ("calculated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_contributions" ADD CONSTRAINT "venture_contributions_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_contributions" ADD CONSTRAINT "venture_contributions_participant_id_venture_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."venture_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_contributions" ADD CONSTRAINT "venture_contributions_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_contributions" ADD CONSTRAINT "venture_contributions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_contributions" ADD CONSTRAINT "venture_contributions_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_cost_allocations" ADD CONSTRAINT "venture_cost_allocations_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_cost_allocations" ADD CONSTRAINT "venture_cost_allocations_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_cost_allocations" ADD CONSTRAINT "venture_cost_allocations_allocated_by_user_id_users_id_fk" FOREIGN KEY ("allocated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_participants" ADD CONSTRAINT "venture_participants_agreement_id_venture_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."venture_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_participants" ADD CONSTRAINT "venture_participants_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_participants" ADD CONSTRAINT "venture_participants_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_participants" ADD CONSTRAINT "venture_participants_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_product_links" ADD CONSTRAINT "venture_product_links_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_product_links" ADD CONSTRAINT "venture_product_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_product_links" ADD CONSTRAINT "venture_product_links_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlement_lines" ADD CONSTRAINT "venture_settlement_lines_settlement_id_venture_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."venture_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlement_lines" ADD CONSTRAINT "venture_settlement_lines_participant_id_venture_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."venture_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlements" ADD CONSTRAINT "venture_settlements_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlements" ADD CONSTRAINT "venture_settlements_snapshot_id_venture_allocation_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."venture_allocation_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlements" ADD CONSTRAINT "venture_settlements_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlements" ADD CONSTRAINT "venture_settlements_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venture_settlements" ADD CONSTRAINT "venture_settlements_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventures" ADD CONSTRAINT "ventures_type_code_venture_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."venture_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventures" ADD CONSTRAINT "ventures_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventures" ADD CONSTRAINT "ventures_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_fields_entity_idx" ON "custom_field_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "custom_fields_key_idx" ON "custom_field_definitions" USING btree ("entity_type","field_key");--> statement-breakpoint
CREATE INDEX "custom_values_entity_idx" ON "custom_field_values" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "custom_values_def_idx" ON "custom_field_values" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "venture_agreements_venture_idx" ON "venture_agreements" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_agreements_status_idx" ON "venture_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venture_snapshots_venture_idx" ON "venture_allocation_snapshots" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_snapshots_number_idx" ON "venture_allocation_snapshots" USING btree ("snapshot_number");--> statement-breakpoint
CREATE INDEX "venture_contributions_venture_idx" ON "venture_contributions" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_contributions_participant_idx" ON "venture_contributions" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "venture_cost_allocations_venture_idx" ON "venture_cost_allocations" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_participants_agreement_idx" ON "venture_participants" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "venture_participants_venture_idx" ON "venture_participants" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_participants_partner_idx" ON "venture_participants" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "venture_product_links_venture_idx" ON "venture_product_links" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_product_links_product_idx" ON "venture_product_links" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "venture_settlement_lines_settlement_idx" ON "venture_settlement_lines" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "venture_settlement_lines_participant_idx" ON "venture_settlement_lines" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "venture_settlements_venture_idx" ON "venture_settlements" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "venture_settlements_number_idx" ON "venture_settlements" USING btree ("settlement_number");--> statement-breakpoint
CREATE INDEX "ventures_number_idx" ON "ventures" USING btree ("venture_number");--> statement-breakpoint
CREATE INDEX "ventures_stage_idx" ON "ventures" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "ventures_type_idx" ON "ventures" USING btree ("type_code");--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_lines" ADD CONSTRAINT "sales_lines_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lots_venture_idx" ON "inventory_lots" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "journal_lines_venture_idx" ON "journal_lines" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "sales_lines_order_idx" ON "sales_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_lines_lot_idx" ON "sales_lines" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "sales_lines_venture_idx" ON "sales_lines" USING btree ("venture_id");