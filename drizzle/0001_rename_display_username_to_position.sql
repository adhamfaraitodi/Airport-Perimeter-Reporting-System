ALTER TABLE "user" RENAME COLUMN "display_username" TO "position";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "position" SET DEFAULT 'Officer';--> statement-breakpoint
UPDATE "user" SET "position" = 'Officer' WHERE "position" IS NULL OR "position" NOT IN ('Officer', 'Chief', 'Chief Assistant', 'Departement Head', 'Supervisor');--> statement-breakpoint
UPDATE "user" SET "position" = 'Supervisor' WHERE "role" = 'OPERATOR';
