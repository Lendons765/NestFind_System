export type PropertyType = "boarding_house" | "studio" | "apartment" | "condo" | "house" | "other";

// Matches the columns returned by GET /api/listings.
// mysql2 returns DECIMAL values as strings and booleans as 0/1.
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
  is_featured: number;
}

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
}

export interface SearchFilters {
  q: string;
  barangay: string;
  propertyType: string;
  maxRent: string;
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