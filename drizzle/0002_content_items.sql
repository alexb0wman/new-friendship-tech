CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"source_url" text NOT NULL,
	"city" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured_rank" integer,
	"fixture" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "content_items_section_idx" ON "content_items" USING btree ("section","status","kind");--> statement-breakpoint
ALTER TABLE "saves" ADD COLUMN "content_id" uuid;--> statement-breakpoint
ALTER TABLE "saves" ADD CONSTRAINT "saves_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saves_content_unique" ON "saves" USING btree ("user_id","content_id");--> statement-breakpoint
ALTER TABLE "saves" DROP CONSTRAINT "saves_one_target";--> statement-breakpoint
ALTER TABLE "saves" ADD CONSTRAINT "saves_one_target" CHECK ((place_id IS NULL)::int + (event_id IS NULL)::int + (content_id IS NULL)::int = 2);
