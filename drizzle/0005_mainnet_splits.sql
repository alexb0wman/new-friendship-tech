ALTER TABLE gatherings ADD COLUMN split_chain_id integer;
--> statement-breakpoint
ALTER TABLE gatherings ADD COLUMN split_token text;
--> statement-breakpoint
ALTER TABLE gatherings ADD COLUMN split_started_at timestamptz;
--> statement-breakpoint
ALTER TABLE gathering_attendees ADD COLUMN split_payer text;
--> statement-breakpoint
ALTER TABLE gathering_attendees ADD COLUMN split_min_block numeric(78,0);
--> statement-breakpoint
ALTER TABLE gathering_attendees ADD COLUMN split_settlement_key text UNIQUE;
--> statement-breakpoint
ALTER TABLE gathering_attendees ADD COLUMN split_error_code text;
-- Old pending splits have no frozen settlement chain and are deliberately not upgraded
-- to mainnet obligations. They need operator review rather than silently moving real funds.
