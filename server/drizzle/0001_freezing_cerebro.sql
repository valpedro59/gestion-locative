ALTER TYPE "public"."role" ADD VALUE 'agent';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;