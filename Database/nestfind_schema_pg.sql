-- NestFind PostgreSQL schema (PostgreSQL 13 or newer)
-- Run once on an empty database.

-- Enum types
CREATE TYPE user_role AS ENUM ('tenant', 'owner', 'admin');
CREATE TYPE property_type AS ENUM ('boarding_house', 'studio', 'apartment', 'condo', 'house', 'other');
CREATE TYPE listing_status AS ENUM ('draft', 'pending_verification', 'active', 'paused', 'rented', 'archived');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE media_type AS ENUM ('photo', 'video', 'tour_360');
CREATE TYPE viewing_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE application_status AS ENUM ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn');
CREATE TYPE background_result AS ENUM ('clear', 'flagged', 'pending');
CREATE TYPE lease_status AS ENUM ('draft', 'sent', 'signed_by_tenant', 'fully_signed', 'active', 'ended', 'cancelled');
CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled');
CREATE TYPE payment_type AS ENUM ('subscription', 'featured_boost', 'deposit', 'background_check', 'lease_fee');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Keeps updated_at current, replacing MySQL's ON UPDATE CURRENT_TIMESTAMP
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'tenant',
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash VARCHAR(255),
  avatar_url TEXT,
  is_verified SMALLINT NOT NULL DEFAULT 0,
  email_verified_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE owner_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  is_founding_owner SMALLINT NOT NULL DEFAULT 0,
  unit_count INT NOT NULL DEFAULT 0 CHECK (unit_count >= 0),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  preferred_city VARCHAR(100) DEFAULT 'Cebu City',
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  barangay VARCHAR(100) NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  UNIQUE (city, barangay)
);

-- Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES locations(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_type property_type NOT NULL,
  address_line VARCHAR(255),
  monthly_rent NUMERIC(12,2) NOT NULL CHECK (monthly_rent > 0),
  bedrooms SMALLINT CHECK (bedrooms >= 0),
  is_furnished SMALLINT NOT NULL DEFAULT 0,
  has_aircon SMALLINT NOT NULL DEFAULT 0,
  has_wifi SMALLINT NOT NULL DEFAULT 0,
  has_parking SMALLINT NOT NULL DEFAULT 0,
  has_gym SMALLINT NOT NULL DEFAULT 0,
  house_rules TEXT,
  status listing_status NOT NULL DEFAULT 'draft',
  verification verification_status NOT NULL DEFAULT 'unverified',
  rejection_reason VARCHAR(500),
  is_featured SMALLINT NOT NULL DEFAULT 0,
  featured_until TIMESTAMP(3),
  view_count INT NOT NULL DEFAULT 0,
  published_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_listings_search ON listings (status, location_id, property_type, monthly_rent);
CREATE INDEX idx_listings_owner ON listings (owner_id);
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE listing_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  storage_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_listing_media_listing ON listing_media (listing_id, sort_order);

-- Messaging
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, tenant_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

-- Viewings
CREATE TABLE viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id),
  scheduled_at TIMESTAMP(3) NOT NULL,
  status viewing_status NOT NULL DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_viewings_updated BEFORE UPDATE ON viewings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Applications and screening
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id),
  status application_status NOT NULL DEFAULT 'submitted',
  desired_move_in DATE,
  lease_term_months SMALLINT CHECK (lease_term_months > 0),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, tenant_id)
);
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  provider_ref VARCHAR(255) NOT NULL,
  result background_result,
  requested_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP(3),
  consent_given_at TIMESTAMP(3) NOT NULL
);

-- Leases
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  tenant_id UUID NOT NULL REFERENCES users(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  status lease_status NOT NULL DEFAULT 'draft',
  monthly_rent NUMERIC(12,2) NOT NULL CHECK (monthly_rent > 0),
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  start_date DATE,
  end_date DATE,
  document_url TEXT,
  esign_provider_ref VARCHAR(255),
  tenant_signed_at TIMESTAMP(3),
  owner_signed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lease_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);
CREATE TRIGGER trg_leases_updated BEFORE UPDATE ON leases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Subscriptions and payments
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP(3),
  current_period_end TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  payment_type payment_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  status payment_status NOT NULL DEFAULT 'pending',
  provider VARCHAR(100) NOT NULL,
  provider_ref VARCHAR(255) UNIQUE,
  listing_id UUID REFERENCES listings(id),
  lease_id UUID REFERENCES leases(id),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Reviews and audit log
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewee_id UUID NOT NULL REFERENCES users(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE (lease_id, reviewer_id)
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Email links (account claim and password reset)
CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('claim', 'reset')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  used_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Saved places
CREATE TABLE saved_listings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);