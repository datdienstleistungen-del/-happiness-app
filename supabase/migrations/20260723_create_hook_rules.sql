create table if not exists hook_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  pattern_de text not null,
  severity text check (severity in ('critical', 'moderate')) not null,
  fix_instruction text not null,
  applies_to_step text default 'video_concept',
  active boolean default true,
  created_at timestamptz default now()
);

alter table hook_rules enable row level security;

create policy "hook_rules_select_authenticated" 
  on hook_rules for select 
  to authenticated 
  using (active = true);

insert into hook_rules (rule_key, pattern_de, severity, fix_instruction) values
('static_start', 'Standbild oder unbewegte Szene in den ersten 0-1 Sek', 'critical', 
 'Szene 1 muss aktive Bewegung zeigen (Person geht/trainiert/greift etwas), kein Stillstand. Harter Schnitt oder Zoom spätestens bei 0,5 Sek.'),
('setup_not_hook', 'Ankündigungssatz statt Konflikt/Pointe im Intro-Text', 'critical',
 'Erster gesprochener/geschriebener Satz muss direkt Konflikt, Ergebnis oder überraschende Behauptung enthalten, kein zeitlicher Rückblick als Einstieg.'),
('no_face_contact', 'Person schaut nicht in Kamera im ersten Frame (Talking-Head-Format)', 'moderate',
 'Wenn Person im Bild: Blickkontakt zur Kamera in Szene 1 sicherstellen.'),
('silent_open', 'Kein Sound/Musik/Sprache in den ersten 0,5 Sek', 'critical',
 'Audio (Voiceover, Musik-Beat oder Umgebungsgeräusch) muss ab Frame 1 einsetzen, keine Stille.'),
('branding_first', 'Logo, Intro-Animation oder Kanalname vor dem eigentlichen Content', 'critical',
 'Branding-Elemente ausschließlich am Ende oder als kleines Overlay während der Handlung platzieren, niemals vor Sekunde 1.'),
('slow_establish', 'Langsamer Kamera-Zoom oder Establishing-Shot statt direktem Einstieg', 'moderate',
 'Video beginnt mitten in der Aktion (in medias res), keine einleitende Totale oder langsame Kamerafahrt.'),
('no_cut_first_3s', 'Kein Schnitt oder Perspektivwechsel innerhalb der ersten 3 Sekunden', 'moderate',
 'Mindestens ein Schnitt, Zoom oder Perspektivwechsel innerhalb der ersten 3 Sekunden einplanen.');
