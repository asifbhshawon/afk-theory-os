CREATE TABLE "calendar_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#7D9472' NOT NULL,
	"icon" text DEFAULT 'Calendar',
	"description" text,
	"is_shared" boolean DEFAULT true NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "calendar_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_entry_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"entry_type" text DEFAULT 'NOTE' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"scope" text DEFAULT 'COMPANY' NOT NULL,
	"visibility" text DEFAULT 'PUBLIC' NOT NULL,
	"category_id" uuid,
	"venture_id" uuid,
	"production_order_id" uuid,
	"sales_order_id" uuid,
	"purchase_order_id" uuid,
	"assigned_partner_id" uuid,
	"owner_user_id" uuid NOT NULL,
	"tags" jsonb,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_view" text DEFAULT 'MONTH' NOT NULL,
	"first_day_of_week" integer DEFAULT 6 NOT NULL,
	"default_category_ids" jsonb,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	CONSTRAINT "calendar_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_recurrence_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_entry_id" uuid NOT NULL,
	"original_date" timestamp with time zone NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"override_title" text,
	"override_start_date" timestamp with time zone,
	"override_end_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_entry_id" uuid NOT NULL,
	"frequency" text DEFAULT 'WEEKLY' NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"days_of_week" jsonb,
	"day_of_month" integer,
	"until_date" timestamp with time zone,
	"max_occurrences" integer
);
--> statement-breakpoint
ALTER TABLE "calendar_categories" ADD CONSTRAINT "calendar_categories_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_checklist_items" ADD CONSTRAINT "calendar_checklist_items_calendar_entry_id_calendar_entries_id_fk" FOREIGN KEY ("calendar_entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_category_id_calendar_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."calendar_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_assigned_partner_id_partners_id_fk" FOREIGN KEY ("assigned_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_preferences" ADD CONSTRAINT "calendar_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_recurrence_exceptions" ADD CONSTRAINT "calendar_recurrence_exceptions_calendar_entry_id_calendar_entries_id_fk" FOREIGN KEY ("calendar_entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_recurrence_rules" ADD CONSTRAINT "calendar_recurrence_rules_calendar_entry_id_calendar_entries_id_fk" FOREIGN KEY ("calendar_entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cal_categories_slug_idx" ON "calendar_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cal_categories_archived_idx" ON "calendar_categories" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "cal_checklist_entry_idx" ON "calendar_checklist_items" USING btree ("calendar_entry_id");--> statement-breakpoint
CREATE INDEX "cal_entries_start_idx" ON "calendar_entries" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "cal_entries_end_idx" ON "calendar_entries" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "cal_entries_type_idx" ON "calendar_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "cal_entries_status_idx" ON "calendar_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cal_entries_scope_idx" ON "calendar_entries" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "cal_entries_owner_idx" ON "calendar_entries" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "cal_entries_cat_idx" ON "calendar_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "cal_entries_venture_idx" ON "calendar_entries" USING btree ("venture_id");--> statement-breakpoint
CREATE INDEX "cal_entries_archived_idx" ON "calendar_entries" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "cal_exceptions_entry_idx" ON "calendar_recurrence_exceptions" USING btree ("calendar_entry_id","original_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cal_recurrence_entry_idx" ON "calendar_recurrence_rules" USING btree ("calendar_entry_id");