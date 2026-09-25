ALTER TABLE "users" ADD COLUMN "verified_human_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "world_agent_issuer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "world_agent_sub" text;--> statement-breakpoint
CREATE TABLE "human_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"city" text NOT NULL,
	"nullifier" numeric(78, 0) NOT NULL,
	"signal_hash" text,
	"issuer_schema_id" text,
	"expires_at_min" timestamp with time zone,
	"environment" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"city" text NOT NULL,
	"label" text NOT NULL,
	"ens_name" text NOT NULL,
	"labelhash" text NOT NULL,
	"registry" text NOT NULL,
	"resolver" text NOT NULL,
	"arrives_at" timestamp with time zone NOT NULL,
	"departs_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending_chain' NOT NULL,
	"chain_tx" text,
	"records_tx" text,
	"chain_verified_at" timestamp with time zone,
	"human_proof_id" uuid,
	"now_tx" text,
	"pay_address" text,
	"pay_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_time_order" CHECK (departs_at > arrives_at)
);--> statement-breakpoint
CREATE TABLE "gatherings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"city" text NOT NULL,
	"kind" text NOT NULL,
	"place_id" uuid,
	"area" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"seats" integer NOT NULL,
	"label" text NOT NULL,
	"ens_name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"split_status" text DEFAULT 'none' NOT NULL,
	"split_total_cents" integer,
	"split_currency" text,
	"chain_record_tx" text,
	"chain_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gatherings_seats_range" CHECK (seats >= 2 AND seats <= 8)
);--> statement-breakpoint
CREATE TABLE "gathering_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gathering_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"role" text NOT NULL,
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"approval_id" uuid,
	"share_cents" integer,
	"pay_address" text,
	"paid_tx" text,
	"paid_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendees_plus_ones_range" CHECK (plus_ones >= 0 AND plus_ones <= 1)
);--> statement-breakpoint
CREATE TABLE "agent_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"nonce" text NOT NULL,
	"code_verifier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"world_sub" text,
	"auth_time" timestamp with time zone,
	"result_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_approvals_nonce_unique" UNIQUE("nonce")
);--> statement-breakpoint
CREATE TABLE "ens_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"signer" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_owner" text,
	"last_error" text,
	"tx_hash" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "human_proofs" ADD CONSTRAINT "human_proofs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_city_cities_slug_fk" FOREIGN KEY ("city") REFERENCES "public"."cities"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_human_proof_id_human_proofs_id_fk" FOREIGN KEY ("human_proof_id") REFERENCES "public"."human_proofs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_city_cities_slug_fk" FOREIGN KEY ("city") REFERENCES "public"."cities"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_gathering_id_gatherings_id_fk" FOREIGN KEY ("gathering_id") REFERENCES "public"."gatherings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_approval_id_agent_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."agent_approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "human_proofs_lookup_idx" ON "human_proofs" USING btree ("action","city","nullifier");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_active_label_unique" ON "trips" USING btree ("city","label") WHERE status IN ('pending_chain','active');--> statement-breakpoint
CREATE UNIQUE INDEX "trips_active_user_unique" ON "trips" USING btree ("user_id","city") WHERE status IN ('pending_chain','active');--> statement-breakpoint
CREATE INDEX "trips_city_status_idx" ON "trips" USING btree ("city","status","departs_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gatherings_label_unique" ON "gatherings" USING btree ("city","label");--> statement-breakpoint
CREATE INDEX "gatherings_city_status_idx" ON "gatherings" USING btree ("city","status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendees_gathering_user_unique" ON "gathering_attendees" USING btree ("gathering_id","user_id");--> statement-breakpoint
CREATE INDEX "agent_approvals_user_idx" ON "agent_approvals" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ens_jobs_due_idx" ON "ens_jobs" USING btree ("status","run_after");
