ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS daily_package_settings JSONB DEFAULT '{
  "topic": "",
  "platform": "tiktok",
  "tone": "authentisch",
  "duration": 30,
  "language": "de"
}'::jsonb;
