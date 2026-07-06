-- Fehlende Profile anlegen (ON CONFLICT verhindert Fehler)
INSERT INTO profiles (id, name, username) VALUES
('5ff67787-c948-49a6-b7fe-87d41b7bea9f', 'Lena Becker', 'lena.b'),
('14e2bbe2-d6ef-4cbf-b988-693116c5557a', 'Sara Yilmaz', 'sara.y'),
('27abdb37-2fb5-48db-8ddd-7768b470c0a9', 'Harro Goerndt', 'harro.g'),
('c5e8b409-52e4-4203-8fb9-11e10bc5dc2b', 'Tarek Hassan', 'tarek.h')
ON CONFLICT (id) DO NOTHING;

-- Bestehende Profile aktualisieren
UPDATE profiles SET name = 'Marco Silva', username = 'marco.s' WHERE id = '028857e8-60da-42b8-8aed-944bca331f89';
UPDATE profiles SET name = 'Jonas Weber', username = 'jonas.w' WHERE id = 'c91868d9-e414-46ef-be4a-968e58fee654';
UPDATE profiles SET name = 'Mia Novak', username = 'mia.n' WHERE id = '976e6211-8931-425a-a171-0c062290181b';

-- Alte Harro-Posts loeschen
DELETE FROM posts WHERE user_id = '27abdb37-2fb5-48db-8ddd-7768b470c0a9';

-- 20 Posts von verschiedenen Usern
INSERT INTO posts (user_id, content, created_at) VALUES
('5ff67787-c948-49a6-b7fe-87d41b7bea9f', 'Fruehstueck steht! Pancakes mit frischen Beeren.', NOW() - INTERVAL '10 minutes'),
('028857e8-60da-42b8-8aed-944bca331f89', 'Gestern 5km gelaufen. Fuehle mich wie neugeboren!', NOW() - INTERVAL '25 minutes'),
('14e2bbe2-d6ef-4cbf-b988-693116c5557a', 'Mein neues Hobby: Stricken. Ist so entspannend!', NOW() - INTERVAL '1 hour'),
('c91868d9-e414-46ef-be4a-968e58fee654', 'Kaffee und ein gutes Buch - perfekter Sonntag.', NOW() - INTERVAL '2 hours'),
('976e6211-8931-425a-a171-0c062290181b', 'Hab heute die Wohnung umgestaltet!', NOW() - INTERVAL '3 hours'),
('c5e8b409-52e4-4203-8fb9-11e10bc5dc2b', 'Erstes Mal Kochen ohne Rezept. Lief super!', NOW() - INTERVAL '4 hours'),
('5ff67787-c948-49a6-b7fe-87d41b7bea9f', 'Lueft mal raus! Der Fruehling ruft.', NOW() - INTERVAL '5 hours'),
('028857e8-60da-42b8-8aed-944bca331f89', 'Fitnessstudio seit 3 Monaten. Fortschritte!', NOW() - INTERVAL '6 hours'),
('14e2bbe2-d6ef-4cbf-b988-693116c5557a', 'Heute mit Freundinnen Kaffee getrunken.', NOW() - INTERVAL '8 hours'),
('c91868d9-e414-46ef-be4a-968e58fee654', 'Spaziergang im Park. Baeume bluehen wieder.', NOW() - INTERVAL '10 hours'),
('976e6211-8931-425a-a171-0c062290181b', 'Kind hat selber Tisch gedeckt!', NOW() - INTERVAL '1 day'),
('c5e8b409-52e4-4203-8fb9-11e10bc5dc2b', 'Nachhilfe fuer meinen Sohn. Mathe ist schwer.', NOW() - INTERVAL '1 day'),
('5ff67787-c948-49a6-b7fe-87d41b7bea9f', 'Wochenende: Wandern und Entspannen.', NOW() - INTERVAL '2 days'),
('028857e8-60da-42b8-8aed-944bca331f89', 'Danke an diese Community!', NOW() - INTERVAL '2 days'),
('14e2bbe2-d6ef-4cbf-b988-693116c5557a', 'Heute Abend selbstgemachte Pizza.', NOW() - INTERVAL '3 days'),
('c91868d9-e414-46ef-be4a-968e58fee654', 'Mein Garten wird richtig schoen.', NOW() - INTERVAL '3 days'),
('976e6211-8931-425a-a171-0c062290181b', 'Endlich Wochenende!', NOW() - INTERVAL '4 days'),
('c5e8b409-52e4-4203-8fb9-11e10bc5dc2b', 'Mein Sohn hat sein erstes Wort gesagt!', NOW() - INTERVAL '5 days'),
('5ff67787-c948-49a6-b7fe-87d41b7bea9f', 'Yoga morgens aendert alles!', NOW() - INTERVAL '5 days'),
('028857e8-60da-42b8-8aed-944bca331f89', 'Kleine Pause vom Alltag.', NOW() - INTERVAL '6 days');
