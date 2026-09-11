-- Phase 10: Email Research Fields
-- Added: 2026-09-11
-- Note: nexus_contacts uses first_name + last_name, not name

-- Add email research fields to nexus_contacts
ALTER TABLE nexus_contacts 
ADD COLUMN IF NOT EXISTS email_source TEXT,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Index for email queries
CREATE INDEX IF NOT EXISTS idx_nexus_contacts_email 
  ON nexus_contacts(email) WHERE email IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN nexus_contacts.email_source IS 
  'How the email was found: pattern, smtp_check, manual, website, etc.';
COMMENT ON COLUMN nexus_contacts.email_verified_at IS 
  'Timestamp when the email was last verified via SMTP check';
COMMENT ON COLUMN nexus_contacts.ai_confidence IS 
  'Confidence score (0-100) for the contact data, including email guess confidence';
