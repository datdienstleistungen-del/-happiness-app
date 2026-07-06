-- ============================================
-- SICHERHEITSFIX: Email-Spalte aus profiles entfernen
-- Email liegt sicher in auth.users (nicht abrufbar via REST)
-- ============================================

ALTER TABLE profiles DROP COLUMN email;
