-- Schritt 1: Prüfen wie viele Duplikate es gibt
SELECT user_id, COUNT(*) as cnt 
FROM ai_profiles 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Schritt 2: Alle Duplikate löschen (neueste behalten)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM ai_profiles
)
DELETE FROM ai_profiles WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Schritt 3: Gleiches für ai_settings
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM ai_settings
)
DELETE FROM ai_settings WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Schritt 4: UNIQUE Constraints
CREATE UNIQUE INDEX IF NOT EXISTS ai_profiles_user_id_unique ON ai_profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_user_id_unique ON ai_settings (user_id);

-- Schritt 5: Verify - sollte 0 rows sein
SELECT user_id, COUNT(*) as cnt 
FROM ai_profiles 
GROUP BY user_id 
HAVING COUNT(*) > 1;
