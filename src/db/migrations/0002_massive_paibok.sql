CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"link_type" text DEFAULT 'PRIMARY' NOT NULL,
	"notes" text,
	"linked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "original_mime_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "original_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "thumbnail_path" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "display_title" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "category" text DEFAULT 'GENERAL_EVIDENCE' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verification_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verification_notes" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doc_links_entity_idx" ON "document_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "doc_links_doc_idx" ON "document_links" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "docs_module_idx" ON "documents" USING btree ("module");--> statement-breakpoint
CREATE INDEX "docs_entity_idx" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "docs_verification_idx" ON "documents" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "docs_category_idx" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "docs_created_at_idx" ON "documents" USING btree ("created_at");