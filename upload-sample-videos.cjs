// upload-sample-videos.js
// Fuehre aus mit: node upload-sample-videos.js

const fs = require('fs');
const https = require('https');
const path = require('path');

const CLOUDINARY_CLOUD = 'h3lhvkua';
const CLOUDINARY_PRESET = 'happiness_videos';
const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa';

const USERS = [
  '5ff67787-c948-49a6-b7fe-87d41b7bea9f',
  '028857e8-60da-42b8-8aed-944bca331f89',
  '14e2bbe2-d6ef-4cbf-b988-693116c5557a',
  'c91868d9-e414-46ef-be4a-968e58fee654',
  '976e6211-8931-425a-a171-0c062290181b',
  'c5e8b409-52e4-4203-8fb9-11e10bc5dc2b',
  '27abdb37-2fb5-48db-8ddd-7768b470c0a9',
  'a0000000-0000-0000-0000-000000000001',
];

const SAMPLE_VIDEOS = [
  { url: 'https://assets.mixkit.co/videos/6915/6915-720.mp4', caption: 'Katze spielt mit Ball - so suss!' },
  { url: 'https://assets.mixkit.co/videos/47711/47711-720.mp4', caption: 'Meine Katze heute Morgen' },
  { url: 'https://assets.mixkit.co/videos/22723/22723-720.mp4', caption: 'Wer kann schon widerstehen?' },
  { url: 'https://assets.mixkit.co/videos/6718/6718-720.mp4', caption: 'Skater Fail - fast geschafft' },
  { url: 'https://assets.mixkit.co/videos/33612/33612-720.mp4', caption: 'Autoprufung - Ups!' },
  { url: 'https://assets.mixkit.co/videos/45962/45962-720.mp4', caption: 'Wenn du am Training bist aber keiner hinschaut' },
  { url: 'https://assets.mixkit.co/videos/6567/6567-720.mp4', caption: ' lustiger Moment mit meiner Freundin' },
  { url: 'https://assets.mixkit.co/videos/14937/14937-720.mp4', caption: 'Ich wenn ich TikTok schaue um 3 Uhr nachts' },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          follow(response.headers.location);
        } else {
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on('finish', () => { file.close(); resolve(dest); });
          file.on('error', reject);
        }
      }).on('error', reject);
    };
    follow(url);
  });
}

async function uploadToCloudinary(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const parts = [];
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n${CLOUDINARY_PRESET}`));
    parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: video/mp4\r\n\r\n`));
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.secure_url) resolve(json.secure_url);
          else reject(new Error(json.error?.message || 'Upload failed'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function insertVideo(userId, videoUrl, caption) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, video_url: videoUrl, caption, file_path: 'cloudinary' }),
  });
  if (!res.ok) throw new Error(`DB insert failed: ${res.status} ${await res.text()}`);
}

async function main() {
  console.log(`Starte Upload von ${SAMPLE_VIDEOS.length} Videos...\n`);

  for (let i = 0; i < SAMPLE_VIDEOS.length; i++) {
    const { url, caption } = SAMPLE_VIDEOS[i];
    const userId = USERS[i % USERS.length];
    const tmpFile = path.join(__dirname, `tmp_video_${i}.mp4`);

    try {
      console.log(`[${i+1}/${SAMPLE_VIDEOS.length}] ${caption}`);
      console.log(`  -> Lade herunter...`);
      await downloadFile(url, tmpFile);

      const sizeMB = (fs.statSync(tmpFile).size / 1024 / 1024).toFixed(1);
      console.log(`  -> ${sizeMB}MB. Lade auf Cloudinary hoch...`);
      const videoUrl = await uploadToCloudinary(tmpFile);
      console.log(`  -> ${videoUrl}`);

      console.log(`  -> Speichere in Datenbank...`);
      await insertVideo(userId, videoUrl, caption);
      console.log(`  -> Fertig!\n`);

      fs.unlinkSync(tmpFile);
    } catch (err) {
      console.error(`  -> FEHLER: ${err.message}\n`);
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }

  console.log('Alle Videos hochgeladen! App neu laden.');
}

main();
