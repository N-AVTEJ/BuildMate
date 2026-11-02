CREATE TYPE "public"."builder_application_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'ORDER_CREATED' BEFORE 'PROOF_SUBMITTED';--> statement-breakpoint
CREATE TABLE "builder_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"resume_url" text NOT NULL,
	"github_url" text,
	"message" text,
	"status" "builder_application_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_status_history" ALTER COLUMN "changed_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_order_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_signature" varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
CREATE INDEX "builder_applications_status_idx" ON "builder_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "builder_applications_email_idx" ON "builder_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "builder_applications_created_at_idx" ON "builder_applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "change_requests_project_id_idx" ON "change_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_requests_status_idx" ON "change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deliverables_project_id_idx" ON "deliverables" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "disputes_project_id_idx" ON "disputes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_raised_by_idx" ON "disputes" USING btree ("raised_by");--> statement-breakpoint
CREATE INDEX "messages_project_id_idx" ON "messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "messages_sender_id_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "payment_proofs_payment_id_idx" ON "payment_proofs" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_project_id_idx" ON "payments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_razorpay_order_id_idx" ON "payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "progress_updates_project_id_idx" ON "progress_updates" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "progress_updates_builder_id_idx" ON "progress_updates" USING btree ("builder_id");--> statement-breakpoint
CREATE INDEX "project_requirements_project_id_idx" ON "project_requirements" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_status_history_project_id_idx" ON "project_status_history" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_client_id_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "projects_builder_id_idx" ON "projects" USING btree ("builder_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_project_code_idx" ON "projects" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "quotations_project_id_idx" ON "quotations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scope_versions_project_id_idx" ON "scope_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");