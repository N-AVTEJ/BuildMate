ALTER TYPE "public"."project_status" ADD VALUE 'CANCELLED';--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "pre_dispute_status" "project_status";--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "project_status_history" ADD COLUMN "reason" text;