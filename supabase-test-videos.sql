-- 8 Videos per SQL einfuegen (RLS bypassed durch SQL Editor)
INSERT INTO videos (user_id, video_url, caption, file_path, created_at) VALUES
('5ff67787-c948-49a6-b7fe-87d41b7bea9f', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338125/ecyrovlf6wo3s2quzrs.mp4', 'Katze spielt mit Ball - so suss!', 'cloudinary', NOW() - INTERVAL '30 minutes'),
('028857e8-60da-42b8-8aed-944bca331f89', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338135/k4zox4834uemcrpc9z8o.mp4', 'Meine Katze heute Morgen', 'cloudinary', NOW() - INTERVAL '2 hours'),
('14e2bbe2-d6ef-4cbf-b988-693116c5557a', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338139/v2fiebrpw53rxzadmqmn.mp4', 'Wer kann schon widerstehen?', 'cloudinary', NOW() - INTERVAL '4 hours'),
('c91868d9-e414-46ef-be4a-968e58fee654', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338148/b2kdw9xwpi4rcgxkxoklu.mp4', 'Skater Fail - fast geschafft', 'cloudinary', NOW() - INTERVAL '6 hours'),
('976e6211-8931-425a-a171-0c062290181b', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338153/dbdseqb2f5jd83whiq5u.mp4', 'Autopruefung - Ups!', 'cloudinary', NOW() - INTERVAL '8 hours'),
('c5e8b409-52e4-4203-8fb9-11e10bc5dc2b', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338159/pwwaewljmxkjxkgmhwaw.mp4', 'Wenn du am Training bist aber keiner hinschaut', 'cloudinary', NOW() - INTERVAL '1 day'),
('27abdb37-2fb5-48db-8ddd-7768b470c0a9', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338135/k4zox4834uemcrpc9z8o.mp4', 'Lustiger Moment mit meiner Freundin', 'cloudinary', NOW() - INTERVAL '2 days'),
('028857e8-60da-42b8-8aed-944bca331f89', 'https://res.cloudinary.com/h3lhvkua/video/upload/v1783338148/b2kdw9xwpi4rcgxkxoklu.mp4', 'Ich wenn ich TikTok schaue um 3 Uhr nachts', 'cloudinary', NOW() - INTERVAL '3 days');
