-- Phase 10: Email Research Fields
-- Added: 2026-09-11
-- email_confidence: INTEGER (40-90), getrennt von ai_confidence

ALTER TABLE nexus_contacts 
ADD COLUMN IF NOT EXISTS email_confidence INTEGER,
ADD COLUMN IF NOT EXISTS email_source TEXT,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_nexus_contacts_email 
  ON nexus_contacts(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN nexus_contacts.email_confidence IS 
  'Pattern-Guess Confidence (40-90), getrennt von ai_confidence';
COMMENT ON COLUMN nexus_contacts.email_source IS 
  'How the email was found: pattern, smtp_check, manual, website';
COMMENT ON COLUMN nexus_contacts.email_verified_at IS 
  'Timestamp when the email was last verified via SMTP check';
