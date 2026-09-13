ALTER TYPE "public"."project_status" ADD VALUE 'ACCEPTED_PENDING_QUOTE' BEFORE 'QUOTATION_SENT';--> statement-breakpoint
CREATE TABLE "project_builder_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"builder_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_builder_rejections" ADD CONSTRAINT "project_builder_rejections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_builder_rejections" ADD CONSTRAINT "project_builder_rejections_builder_id_users_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_builder_rejections_project_id_idx" ON "project_builder_rejections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_builder_rejections_builder_id_idx" ON "project_builder_rejections" USING btree ("builder_id");