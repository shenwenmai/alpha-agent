/**
 * YouTube 视频音频下载 + OpenAI Whisper 转写
 * Usage: node scripts/yt-transcribe.mjs <youtube-url>
 */
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VIDEO_URL = process.argv[2];

if (!VIDEO_URL) {
  console.error('Usage: node scripts/yt-transcribe.mjs <youtube-url>');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable');
  process.exit(1);
}

async function downloadAudio(url, outputPath) {
  console.log('📥 Downloading audio...');
  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title;
  console.log(`   Title: ${title}`);
  console.log(`   Duration: ${Math.round(info.videoDetails.lengthSeconds / 60)} minutes`);

  return new Promise((resolve, reject) => {
    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'lowestaudio', // smallest file for faster upload
    });
    const writer = fs.createWriteStream(outputPath);
    stream.pipe(writer);
    writer.on('finish', () => {
      const size = fs.statSync(outputPath).size;
      console.log(`   Saved: ${outputPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      resolve({ title, duration: info.videoDetails.lengthSeconds });
    });
    writer.on('error', reject);
    stream.on('error', reject);
  });
}

async function transcribeWithWhisper(audioPath) {
  console.log('🎙️ Transcribing with Whisper API...');

  const fileSize = fs.statSync(audioPath).size;
  console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

  // Whisper API accepts up to 25MB
  if (fileSize > 25 * 1024 * 1024) {
    console.error('   ❌ File too large (>25MB). Need to split.');
    return null;
  }

  const formData = new FormData();
  const audioBuffer = fs.readFileSync(audioPath);
  const blob = new Blob([audioBuffer], { type: 'audio/webm' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'zh');
  formData.append('response_format', 'verbose_json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`   ❌ Whisper API error: ${res.status}`, err);
    return null;
  }

  const data = await res.json();
  console.log(`   ✅ Transcription complete: ${data.text?.length || 0} chars`);
  return data;
}

async function main() {
  const audioPath = path.join(__dirname, '..', 'data', 'temp_audio.webm');

  // Ensure data dir exists
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

  // Step 1: Download audio
  const { title, duration } = await downloadAudio(VIDEO_URL, audioPath);

  // Step 2: Transcribe
  const result = await transcribeWithWhisper(audioPath);

  if (result) {
    // Save full transcript
    const outputPath = path.join(__dirname, '..', 'data', 'transcript_test.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      title,
      duration,
      url: VIDEO_URL,
      language: result.language,
      text: result.text,
      segments: result.segments?.map(s => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    }, null, 2), 'utf-8');

    console.log(`\n📄 Saved transcript to: ${outputPath}`);
    console.log(`\n--- First 500 chars ---`);
    console.log(result.text.slice(0, 500));
  }

  // Cleanup
  if (fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
    console.log('\n🗑️ Cleaned up temp audio file');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
