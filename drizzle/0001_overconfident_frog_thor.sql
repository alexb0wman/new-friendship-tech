CREATE TABLE "ens_write_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"wallet" text NOT NULL,
	"resolver" text NOT NULL,
	"chain_id" integer NOT NULL,
	"calldata" text NOT NULL,
	"description" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"tx_hash" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ens_write_intents_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
ALTER TABLE "ens_write_intents" ADD CONSTRAINT "ens_write_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ens_intents_user_idx" ON "ens_write_intents" USING btree ("user_id","expires_at");