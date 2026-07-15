-- Schritt 4: Profiles Email-Spalte entfernen (Sicherheitsfix)
-- Email liegt sicher in auth.users (nicht abrufbar via REST)

ALTER TABLE profiles DROP COLUMN IF EXISTS email;
