-- NeXus Premium Tiers
-- Datum: 2026-09-10
-- Fuegt premium_tier und stripe_price_id zu ai_settings hinzu

BEGIN;

-- Neue Spalten hinzufuegen (idempotent)
DO $$ BEGIN
  ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS premium_tier TEXT DEFAULT 'free';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Bestehende Premium-User auf 'pro' setzen (Fallback)
UPDATE ai_settings SET premium_tier = 'pro' WHERE is_premium = true AND premium_tier = 'free';

NOTIFY pgrst, 'reload schema';

COMMIT;
