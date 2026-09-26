/**
 * Enhanced Access Control role bitmaps for the ENSv2 Permissioned Registry and
 * Permissioned Resolver. Values follow https://docs.ens.domains/ensv2/enhanced-access-control
 * and the per-contract role tables. Each regular role has an admin variant at role << 128.
 * Verify against RegistryRolesLib / ResolverRolesLib in ensdomains/contracts-v2 before a live run.
 */
export const REGISTRY = {
  ROLE_REGISTRAR: 1n << 0n,
  ROLE_REGISTER_RESERVED: 1n << 4n,
  ROLE_SET_PARENT: 1n << 8n,
  ROLE_UNREGISTER: 1n << 12n,
  ROLE_RENEW: 1n << 16n,
  ROLE_SET_SUBREGISTRY: 1n << 20n,
  ROLE_SET_RESOLVER: 1n << 24n,
  ROLE_SET_URI: 1n << 36n,
  ROLE_UPGRADE: 1n << 124n,
} as const;
export const RESOLVER = {
  ROLE_SET_ADDRESS: 1n << 0n,
  ROLE_SET_TEXT: 1n << 4n,
  ROLE_SET_CONTENTHASH: 1n << 8n,
  ROLE_SET_ABI: 1n << 12n,
  ROLE_SET_INTERFACE: 1n << 16n,
  ROLE_SET_NAME: 1n << 20n,
  ROLE_SET_DATA: 1n << 24n,
  ROLE_LINK: 1n << 28n,
  ROLE_CAN_NAME: 1n << 120n,
  ROLE_UPGRADE: 1n << 124n,
} as const;
export const admin = (role: bigint) => role << 128n;
/** Transfer permission is admin-only; there is no regular ROLE_CAN_TRANSFER. */
export const ROLE_CAN_TRANSFER_ADMIN = (1n << 28n) << 128n;
/** Every regular and admin role, the bitmap the docs use for a fresh proxy owner. */
export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
/** Trip owners may point their name at their own resolver and delegate that, nothing else: no transfer, no sub-trips. */
export const TRIP_OWNER_BITMAP = REGISTRY.ROLE_SET_RESOLVER | admin(REGISTRY.ROLE_SET_RESOLVER);
/** Operator-owned anchors (tokyo, tables, concierge) get the ETH Registrar's registration bitmap. */
export const OWNER_BITMAP =
  REGISTRY.ROLE_SET_SUBREGISTRY |
  admin(REGISTRY.ROLE_SET_SUBREGISTRY) |
  REGISTRY.ROLE_SET_RESOLVER |
  admin(REGISTRY.ROLE_SET_RESOLVER) |
  ROLE_CAN_TRANSFER_ADMIN;
/** The only text keys the concierge wallet may write, granted per key with grantSetterRoles. */
export const CONCIERGE_TEXT_KEYS = ["friendship.now", "friendship.table"] as const;
export type ConciergeTextKey = (typeof CONCIERGE_TEXT_KEYS)[number];
export const isConciergeKey = (key: string): key is ConciergeTextKey =>
  (CONCIERGE_TEXT_KEYS as readonly string[]).includes(key);
export const hasRole = (bitmap: bigint, role: bigint) => (bitmap & role) === role;
