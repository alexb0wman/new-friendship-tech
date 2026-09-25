import type { ConciergeBrain } from "./brain";

/**
 * Owner extension point. Set CONCIERGE_BRAIN=custom and replace this file with a brain backed by
 * your inference stack (for example 0G compute). Keep the contract: read the context, return a
 * reply and proposals; never execute anything, never include wallets or contacts in the reply.
 * The plumbing in agent.ts turns each proposal into a World ID approval before anything happens.
 */
export function createBrain(): ConciergeBrain | undefined {
  return undefined;
}
