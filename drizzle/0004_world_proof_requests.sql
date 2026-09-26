CREATE TABLE world_proof_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  rp_context JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX world_proof_requests_user_idx ON world_proof_requests(user_id, expires_at);
--> statement-breakpoint
ALTER TABLE agent_approvals ADD COLUMN rp_context JSONB;
--> statement-breakpoint
CREATE UNIQUE INDEX users_world_identity_unique ON users(world_agent_issuer, world_agent_sub);
