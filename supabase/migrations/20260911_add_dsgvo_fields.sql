-- Phase 10d: DSGVO Rechtsgrundlage
-- contacted_at + trigger_ref für Nachweis Art. 6 Abs. 1 lit. f DSGVO

ALTER TABLE nexus_contacts 
ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trigger_ref TEXT;

COMMENT ON COLUMN nexus_contacts.contacted_at IS 
  'Timestamp der ersten Kontaktaufnahme (DSGVO Art. 6 Abs. 1 lit. f)';
COMMENT ON COLUMN nexus_contacts.trigger_ref IS 
  'Referenz auf den Trigger/das Signal fuer die Kontaktaufnahme';
