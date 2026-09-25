export type PlanKey = "all_access_30d";
export type Category = "Eat" | "Coffee" | "Drink" | "Work" | "Culture" | "Outdoors" | "Meet";
export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";
export type InvoiceStatus = "quoted" | "submitted" | "confirming" | "settled" | "failed" | "expired" | "review_required" | "refunded";
export interface PublicMember {
  id: string; name: string; role: string; bio: string; interests: string[];
  city: string; neighborhood: string; intents: string[]; host: boolean;
  ensName: string | null; fixture: boolean;
}
export interface Place {
  id: string; slug: string; city: string; name: string; neighborhood: string;
  category: Category; note: string; tags: string[]; mapUrl: string; sourceUrl: string;
  price: string | null; preview: boolean; fixture: boolean; artwork: string;
  reviewedAt: string | null; reasons?: string[]; saved?: boolean;
}
export interface City { slug: string; name: string; timezone: string; published: boolean; }
export interface Entitlement { id: string; startsAt: string; endsAt: string; source: string; }
export interface Me {
  user: PublicMember & { visible: boolean; onboarded: boolean; admin: boolean };
  membership: { active: boolean; current: Entitlement | null; paidThrough: string | null; remainingRequests: number };
  walletAddresses: string[]; hasContact: boolean; demo: boolean;
}
export interface ApiErrorShape { code: string; message: string; retryable: boolean; correlationId: string; }
export interface NowPost {
  id: string; kind: string; neighborhood: string; note: string; startsAt: string;
  expiresAt: string; owner: PublicMember; place: { id: string; name: string } | null; own: boolean;
}
export interface EventItem {
  id: string; title: string; city: string; neighborhood: string; startsAt: string;
  endsAt: string; registrationUrl: string; sourceUrl: string; accessNote: string;
  fixture: boolean; saved?: boolean;
}
export interface ConnectionItem {
  id: string; direction: "incoming" | "outgoing"; status: RequestStatus;
  context: string; createdAt: string; expiresAt: string; member: PublicMember;
  contact: { type: string; value: string } | null;
}
export interface Invoice {
  id: string; status: InvoiceStatus; usdCents: number; quoteExpiresAt: string;
  createdAt: string; settledAt: string | null; sourceTx: string | null;
  destinationTx: string | null; failureCode: string | null; provider: string; demo: boolean;
}
