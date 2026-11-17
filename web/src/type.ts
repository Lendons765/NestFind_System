export type PropertyType = "boarding_house" | "studio" | "apartment" | "condo" | "house" | "other";

// Matches the columns returned by GET /api/listings.
// mysql2 returns DECIMAL values as strings and booleans as 0/1.


// Matches the columns returned by GET /api/listings/:id (no address).
export interface ListingDetail {
  id: string;
  title: string;
  description: string | null;
  city: string;
  barangay: string;
  property_type: PropertyType;
  monthly_rent: string | number;
  bedrooms: number | null;
  is_furnished: number;
  has_aircon: number;
  has_wifi: number;
  has_parking: number;
  has_gym: number;
  house_rules: string | null;
  verification: "unverified" | "pending" | "verified" | "rejected";
  walkthroughUrl: string | null;
}

export interface SearchFilters {
  q: string;
  barangay: string;
  propertyType: string;
  maxRent: string;
  bedrooms: string;
  sort: string;
  amenities: string[];
}

export interface InquiryInput {
  name: string;
  email: string;
  phone?: string;
  message: string;
  preferredAt?: string;
}

export interface InquiryResult {
  conversationId: string;
  status: string;
  viewingRequested: boolean;
}

export type Role = "tenant" | "owner" | "admin";

export interface AuthUser {
  id: string;
  role: Role;
  fullName: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface OwnerMessage {
  body: string;
  sentAt: string;
  senderName: string;
}

export interface OwnerViewing {
  id: string;
  scheduledAt: string;
  status: "requested" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
}

export interface OwnerInquiry {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  createdAt: string;
  messages: OwnerMessage[];
  viewings: OwnerViewing[];
}

export interface VerificationPending {
  status: "verification_sent";
  message: string;
}

export type OwnerListingStatus =
  | "draft"
  | "pending_verification"
  | "active"
  | "paused"
  | "rented"
  | "archived";

export interface OwnerListing {
  id: string;
  title: string;
  monthly_rent: string | number;
  status: OwnerListingStatus;
  published_at: string | null;
  barangay: string;
}

export interface PendingListing {
  id: string;
  title: string;
  monthly_rent: string | number;
  status: OwnerListingStatus;
  created_at: string;
  barangay: string;
  owner_name: string;
  owner_email: string;
}

export interface LocationOption {
  id: number;
  city: string;
  barangay: string;
}

export interface NewListingInput {
  title: string;
  propertyType: string;
  locationId: number;
  monthlyRent: number;
  bedrooms?: number;
  description?: string;
  addressLine?: string;
  houseRules?: string;
  isFurnished: boolean;
  hasAircon: boolean;
  hasWifi: boolean;
  hasParking: boolean;
  hasGym: boolean;
}

export interface ListingPhoto {
  id: string;
  url: string;
}

export interface OwnerListingRow {
  id: string;
  title: string;
  monthly_rent: string | number;
  status: OwnerListingStatus;
  verification: "unverified" | "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  published_at: string | null;
  barangay: string;
  photo_count: number;
  view_count: number;
  inquiry_count: number;
  applicant_count: number;
  new_applicant_count: number;
}

export interface OwnerListingDetail {
  id: string;
  title: string;
  description: string | null;
  property_type: string;
  monthly_rent: string | number;
  bedrooms: number | null;
  is_furnished: number;
  has_aircon: number;
  has_wifi: number;
  has_parking: number;
  has_gym: number;
  house_rules: string | null;
  address_line: string | null;
  location_id: number;
  status: OwnerListingStatus;
  verification: "unverified" | "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  photos: ListingPhoto[];
}

export interface ListingSummary {
  id: string;
  title: string;
  city: string;
  barangay: string;
  property_type: PropertyType;
  monthly_rent: string | number;
  bedrooms: number | null;
  has_aircon: number;
  has_wifi: number;
  has_parking: number;
  is_furnished: number;
  is_featured: number;
  verification: "unverified" | "pending" | "verified" | "rejected";
  cover_url: string | null;
}

export type ApplicationStatus = "submitted" | "under_review" | "approved" | "rejected" | "withdrawn";
export type LeaseStatus = "draft" | "sent" | "signed_by_tenant" | "fully_signed" | "active" | "ended" | "cancelled";

export interface ApplyInput {
  desiredMoveIn?: string;
  leaseTermMonths?: number;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  desired_move_in: string | null;
  lease_term_months: number | null;
  created_at: string;
  listing_id: string;
  title: string;
  barangay: string;
  lease_id: string | null;
}

export interface ListingApplicant {
  id: string;
  status: ApplicationStatus;
  desired_move_in: string | null;
  lease_term_months: number | null;
  created_at: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string | null;
  lease_id: string | null;
}

export interface LeaseInput {
  monthlyRent: number;
  depositAmount: number;
  startDate?: string;
  endDate?: string;
}

export interface LeaseRow {
  id: string;
  status: LeaseStatus;
  monthly_rent: string | number;
  deposit_amount: string | number;
  start_date: string | null;
  end_date: string | null;
  tenant_signed_at: string | null;
  owner_signed_at: string | null;
  title: string;
  barangay: string;
  address_line: string | null;
  tenant_name: string;
  owner_name: string;
  my_role: "tenant" | "owner";
}

export interface PublicStats {
  live_listings: number;
  barangays: number;
  owners: number;
  tenants: number;
}

export interface UserDashboard {
  role: "owner" | "tenant";
  stats: Record<string, number | null | undefined>;
  recent?: Array<{ tenant_name: string; title: string; created_at: string }>;
  upcoming?: Array<{ listing_id: string; title: string; scheduled_at: string; status: string }>;
}

export interface OwnerDashboard {
  totals: { listings: number; live: number; drafts: number; views: number };
  activity: {
    inquiries: number;
    applicants: number;
    new_applicants: number;
    viewing_requests: number;
    upcoming_viewings: number;
    leases_to_sign: number;
  };
  listings: {
    id: string;
    title: string;
    status: string;
    views: number;
    inquiries: number;
    applicants: number;
    viewings: number;
  }[];
  recentInquiries: { id: string; createdAt: string; title: string; tenantName: string }[];
  recentApplicants: { id: string; status: string; createdAt: string; title: string; tenantName: string }[];
  upcomingViewings: {
    id: string;
    scheduledAt: string;
    status: string;
    listingId: string;
    title: string;
    tenantName: string;
  }[];
}

export interface TenantSummary {
  applications: number;
  pending_applications: number;
  viewings_requested: number;
  viewings_confirmed: number;
  conversations: number;
  leases: number;
}

export interface TenantMessage {
  body: string;
  sentAt: string;
  fromMe: boolean;
  senderName: string;
}

export interface TenantConversation {
  id: string;
  listingId: string;
  listingTitle: string;
  barangay: string;
  ownerName: string;
  createdAt: string;
  messages: TenantMessage[];
}

export interface TenantViewing {
  id: string;
  scheduled_at: string;
  status: "requested" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  listing_id: string;
  title: string;
  barangay: string;
}