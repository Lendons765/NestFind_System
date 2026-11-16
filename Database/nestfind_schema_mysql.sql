CREATE DATABASE IF NOT EXISTS nestfind
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE nestfind;

CREATE TABLE users (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    auth_id         VARCHAR(255) UNIQUE,
    role            ENUM('tenant', 'owner', 'admin') NOT NULL DEFAULT 'tenant',
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(32) UNIQUE,
    password_hash VARCHAR(255) NULL,
    avatar_url      TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE owner_profiles (
    user_id           CHAR(36) PRIMARY KEY,
    business_name     VARCHAR(255),
    is_founding_owner BOOLEAN NOT NULL DEFAULT FALSE,
    unit_count        INT NOT NULL DEFAULT 0 CHECK (unit_count >= 0),
    created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_owner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tenant_profiles (
    user_id         CHAR(36) PRIMARY KEY,
    budget_min      DECIMAL(12,2),
    budget_max      DECIMAL(12,2),
    preferred_city  VARCHAR(100) DEFAULT 'Cebu City',
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_tenant_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE locations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    city            VARCHAR(100) NOT NULL,
    barangay        VARCHAR(100) NOT NULL,
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    UNIQUE KEY uq_location_city_barangay (city, barangay)
) ENGINE=InnoDB;

CREATE TABLE listings (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_id        CHAR(36) NOT NULL,
    location_id     INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    property_type   ENUM('boarding_house', 'studio', 'apartment', 'condo', 'house', 'other') NOT NULL,
    address_line    VARCHAR(255),
    monthly_rent    DECIMAL(12,2) NOT NULL CHECK (monthly_rent > 0),
    bedrooms        SMALLINT CHECK (bedrooms >= 0),
    is_furnished    BOOLEAN NOT NULL DEFAULT FALSE,
    has_aircon      BOOLEAN NOT NULL DEFAULT FALSE,
    has_wifi        BOOLEAN NOT NULL DEFAULT FALSE,
    has_parking     BOOLEAN NOT NULL DEFAULT FALSE,
    has_gym         BOOLEAN NOT NULL DEFAULT FALSE,
    house_rules     TEXT,
    status          ENUM('draft', 'pending_verification', 'active', 'paused', 'rented', 'archived') NOT NULL DEFAULT 'draft',
    verification    ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'unverified',
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    featured_until  DATETIME(3),
    view_count      INT NOT NULL DEFAULT 0,
    published_at    DATETIME(3),
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_listings_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_listings_location FOREIGN KEY (location_id) REFERENCES locations(id),
    INDEX idx_listings_search (status, location_id, property_type, monthly_rent),
    INDEX idx_listings_owner (owner_id)
) ENGINE=InnoDB;

CREATE TABLE listing_media (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    listing_id      CHAR(36) NOT NULL,
    media_type      ENUM('photo', 'video', 'tour_360') NOT NULL,
    storage_url     TEXT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_listing_media_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    INDEX idx_listing_media_listing (listing_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE conversations (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    listing_id      CHAR(36) NOT NULL,
    tenant_id       CHAR(36) NOT NULL,
    owner_id        CHAR(36) NOT NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_conversation (listing_id, tenant_id),
    CONSTRAINT fk_conversations_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    conversation_id CHAR(36) NOT NULL,
    sender_id       CHAR(36) NOT NULL,
    body            TEXT NOT NULL,
    read_at         DATETIME(3),
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id),
    INDEX idx_messages_conversation (conversation_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE viewings (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    listing_id      CHAR(36) NOT NULL,
    tenant_id       CHAR(36) NOT NULL,
    scheduled_at    DATETIME(3) NOT NULL,
    status          ENUM('requested', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'requested',
    notes           TEXT,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_viewings_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_viewings_tenant FOREIGN KEY (tenant_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE applications (
    id                CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    listing_id        CHAR(36) NOT NULL,
    tenant_id         CHAR(36) NOT NULL,
    status            ENUM('submitted', 'under_review', 'approved', 'rejected', 'withdrawn') NOT NULL DEFAULT 'submitted',
    desired_move_in   DATE,
    lease_term_months SMALLINT CHECK (lease_term_months > 0),
    created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_application (listing_id, tenant_id),
    CONSTRAINT fk_applications_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_tenant FOREIGN KEY (tenant_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE background_checks (
    id                CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    application_id    CHAR(36) NOT NULL,
    provider          VARCHAR(100) NOT NULL,
    provider_ref      VARCHAR(255) NOT NULL,
    result            ENUM('clear', 'flagged', 'pending'),
    requested_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at      DATETIME(3),
    consent_given_at  DATETIME(3) NOT NULL,
    CONSTRAINT fk_background_checks_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE leases (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    application_id      CHAR(36) NOT NULL UNIQUE,
    listing_id          CHAR(36) NOT NULL,
    tenant_id           CHAR(36) NOT NULL,
    owner_id            CHAR(36) NOT NULL,
    status              ENUM('draft', 'sent', 'signed_by_tenant', 'fully_signed', 'active', 'ended', 'cancelled') NOT NULL DEFAULT 'draft',
    monthly_rent        DECIMAL(12,2) NOT NULL CHECK (monthly_rent > 0),
    deposit_amount      DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    start_date          DATE,
    end_date            DATE,
    document_url        TEXT,
    esign_provider_ref  VARCHAR(255),
    tenant_signed_at    DATETIME(3),
    owner_signed_at     DATETIME(3),
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_leases_application FOREIGN KEY (application_id) REFERENCES applications(id),
    CONSTRAINT fk_leases_listing FOREIGN KEY (listing_id) REFERENCES listings(id),
    CONSTRAINT fk_leases_tenant FOREIGN KEY (tenant_id) REFERENCES users(id),
    CONSTRAINT fk_leases_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT chk_lease_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
) ENGINE=InnoDB;

CREATE TABLE subscriptions (
    id                    CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_id              CHAR(36) NOT NULL,
    plan                  ENUM('free', 'pro', 'premium') NOT NULL DEFAULT 'free',
    status                ENUM('active', 'past_due', 'cancelled') NOT NULL DEFAULT 'active',
    current_period_start  DATETIME(3),
    current_period_end    DATETIME(3),
    created_at            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_subscriptions_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payments (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id         CHAR(36) NOT NULL,
    payment_type    ENUM('subscription', 'featured_boost', 'deposit', 'background_check', 'lease_fee') NOT NULL,
    amount          DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'PHP',
    status          ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    provider        VARCHAR(100) NOT NULL,
    provider_ref    VARCHAR(255) UNIQUE,
    listing_id      CHAR(36),
    lease_id