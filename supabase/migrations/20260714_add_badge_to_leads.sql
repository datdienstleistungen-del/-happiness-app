ALTER TABLE leads ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'unknown';

COMMENT ON COLUMN leads.badge IS 'Context badge: gamer, creator, business, milestone, advice, privacy, builder, trader, realestate';
