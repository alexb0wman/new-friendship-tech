/** Public runtime bootstrap. Never add credentials to this browser-facing contract. */
export interface PublicAuthConfig {
  demo: boolean;
  enabled: boolean;
  appId: string | null;
}
