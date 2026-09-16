ALTER TABLE "projects" ADD COLUMN "advance_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "final_advance_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_type_unique" UNIQUE("project_id","type");