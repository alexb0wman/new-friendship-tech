export type PlanKey = "all_access_30d";
export type Category = "Eat" | "Coffee" | "Drink" | "Work" | "Culture" | "Outdoors" | "Meet";
export type ContentSection = "travel" | "art" | "music" | "tech";
export type ContentKind = "story" | "playlist" | "opportunity" | "company" | "perk";
export type ContentStatus = "draft" | "published" | "archived";
export interface ContentItem {
  id: string;
  slug: string;
  kind: ContentKind;
  section: ContentSection;
  title: string;
  summary: string;
  body: string;
  sourceUrl: string;
  city: string | null;
  tags: string[];
  status: ContentStatus;
  featuredRank: number | null;
  fixture: boolean;
  publishedAt: string;
  updatedAt: string;
  saved?: boolean;
}
export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";
export type InvoiceStatus =
  | "quoted"
  | "submitted"
  | "confirming"
  | "settled"
  | "failed"
  | "expired"
  | "review_required"
  | "refunded";
export interface PublicMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  interests: string[];
  city: string;
  neighborhood: string;
  intents: string[];
  host: boolean;
  ensName: string | null;
  fixture: boolean;
  tripName: string | null;
  verifiedHuman: boolean;
  now: NowRecord | null;
}
export interface Place {
  id: string;
  slug: string;
  city: string;
  name: string;
  neighborhood: string;
  category: Category;
  note: string;
  tags: string[];
  mapUrl: string;
  sourceUrl: string;
  price: string | null;
  preview: boolean;
  fixture: boolean;
  artwork: string;
  reviewedAt: string | null;
  reasons?: string[];
  saved?: boolean;
  locked?: boolean;
}
export interface City {
  slug: string;
  name: string;
  timezone: string;
  published: boolean;
}
export interface Entitlement {
  id: string;
  startsAt: string;
  endsAt: string;
  source: string;
}
export interface Me {
  user: PublicMember & {
    visible: boolean;
    onboarded: boolean;
    admin: boolean;
    verifiedHuman: boolean;
    worldAgentLinked: boolean;
  };
  membership: {
    active: boolean;
    current: Entitlement | null;
    paidThrough: string | null;
    remainingRequests: number;
  };
  walletAddresses: string[];
  hasContact: boolean;
  demo: boolean;
}
export interface ApiErrorShape {
  code: string;
  message: string;
  retryable: boolean;
  correlationId: string;
}
export interface NowPost {
  id: string;
  kind: string;
  neighborhood: string;
  note: string;
  startsAt: string;
  expiresAt: string;
  owner: PublicMember;
  place: { id: string; name: string } | null;
  own: boolean;
}
export interface EventItem {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  startsAt: string;
  endsAt: string;
  registrationUrl: string;
  sourceUrl: string;
  accessNote: string;
  fixture: boolean;
  saved?: boolean;
}
export interface ConnectionItem {
  id: string;
  direction: "incoming" | "outgoing";
  status: RequestStatus;
  context: string;
  createdAt: string;
  expiresAt: string;
  member: PublicMember;
  contact: { type: string; value: string } | null;
}
export interface Invoice {
  payment?: import("./payment-types").MerchantPayment | null;
  id: string;
  status: InvoiceStatus;
  usdCents: number;
  quoteExpiresAt: string;
  createdAt: string;
  settledAt: string | null;
  sourceTx: string | null;
  destinationTx: string | null;
  failureCode: string | null;
  provider: string;
  demo: boolean;
}

// ENSv2 trips, tables, approvals and chain jobs.
export type TripStatus = "pending_chain" | "active" | "ended" | "expired" | "failed";
export type GatheringKind = "coffee" | "breakfast" | "lunch" | "dinner" | "drinks";
export type GatheringStatus = "open" | "full" | "closed" | "cancelled";
export type AttendeeStatus = "requested" | "approved" | "declined" | "left";
export type ApprovalAction =
  "agent.link" | "now.publish" | "table.request" | "table.approve" | "contact.reveal";
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "consumed";
export type EnsJobKind =
  "trip.register" | "trip.renew" | "trip.expire" | "record.set" | "table.write" | "split.verify";
export type EnsJobSigner = "operator" | "concierge" | "none";
export interface NowRecord {
  kind: string;
  area: string;
  until: string;
}
export interface TripDTO {
  id: string;
  city: string;
  label: string;
  name: string;
  status: TripStatus;
  arrivesAt: string;
  departsAt: string;
  chainTx: string | null;
  recordsTx: string | null;
  chainVerifiedAt: string | null;
  verifiedHuman: boolean;
  now: NowRecord | null;
  nowOnChain: boolean;
  payAddress: string | null;
  explorer: { name: string | null; tx: string | null };
}
export interface GatheringSummary {
  id: string;
  city: string;
  kind: GatheringKind;
  area: string;
  place: { id: string; slug: string; name: string } | null;
  startsAt: string;
  seats: number;
  seatsLeft: number;
  status: GatheringStatus;
  label: string;
  name: string;
  host: { name: string; displayName: string; verifiedHuman: boolean };
  chainRecordTx: string | null;
  chainVerifiedAt: string | null;
  mine: boolean;
  myStatus: AttendeeStatus | null;
  explorer: { name: string | null; tx: string | null };
}
export interface AttendeeDTO {
  id: string;
  name: string;
  displayName: string;
  role: "host" | "member";
  plusOnes: number;
  status: AttendeeStatus;
  verifiedHuman: boolean;
  shareCents: number | null;
  paidTx: string | null;
  paidVerifiedAt: string | null;
}
export interface SplitMine {
  shareCents: number;
  payTo: string;
  payToName: string;
  token: string;
  chainId: number | null;
  chainName: string;
  payer: string | null;
  errorCode: string | null;
  explorerTx: string | null;
  amountBaseUnits: string;
  paidTx: string | null;
  verified: boolean;
}
export interface GatheringDetail extends GatheringSummary {
  attendees: AttendeeDTO[];
  guests: number;
  split: {
    status: "none" | "pending" | "settled";
    totalCents: number | null;
    unitCents: number | null;
    hostCents: number | null;
    mine: SplitMine | null;
  };
  record: string | null;
}
export interface ApprovalDTO {
  id: string;
  action: ApprovalAction;
  summary: string;
  status: ApprovalStatus;
  url: string | null;
  expiresAt: string;
  resultId: string | null;
  simulated: boolean;
  proofRequest?: import("@/server/world/adapter").ProofRequestDTO | null;
}
