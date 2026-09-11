-- Phase 10: Email Research Fields
-- Added: 2026-09-11

-- Add email research fields to nexus_contacts
ALTER TABLE nexus_contacts 
ADD COLUMN IF NOT EXISTS email_confidence TEXT DEFAULT 'unknown' 
  CHECK (email_confidence IN ('verified', 'guessed', 'unknown')),
ADD COLUMN IF NOT EXISTS email_source TEXT,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Index for email confidence queries
CREATE INDEX IF NOT EXISTS idx_nexus_contacts_email_confidence 
  ON nexus_contacts(email_confidence);

-- Comment for clarity
COMMENT ON COLUMN nexus_contacts.email_confidence IS 
  'verified: SMTP-check confirmed existence; guessed: pattern-based guess without verification; unknown: no email found';
COMMENT ON COLUMN nexus_contacts.email_source IS 
  'How the email was found: pattern, smtp_check, manual, website, etc.';
COMMENT ON COLUMN nexus_contacts.email_verified_at IS 
  'Timestamp when the email was last verified via SMTP check';
